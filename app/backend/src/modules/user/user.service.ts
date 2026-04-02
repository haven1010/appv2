/**
 * Layer: Backend Service
 * Responsibility: Implements the User application service for the User module, including business rules, side effects, and persistence coordination.
 * Notes: Keep comments focused on intent, invariants, side effects, and cross-module contracts.
 */
import { Injectable, BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, DataSource, EntityManager } from 'typeorm';
import { SysUser, UserRole, RegisterMode } from './entities/sys-user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { CreateProxyRegistrationDto } from './dto/create-proxy-registration.dto';
import {
  ProxyRegistrationCase,
  ProxyRegistrationStatus,
  ProxyRiskLevel,
} from './entities/proxy-registration-case.entity';
import { SecurityService } from '../common/services/security.service';
import { OperationLogService, OperationLogContext } from '../common/services/operation-log.service';
import { OperationType, ResourceType } from '../common/entities/operation-log.entity';
import { BaseInfo } from '../base/entities/base-info.entity';
import * as crypto from 'crypto';

@Injectable()
/**
 * 用户服务负责账号生命周期、身份唯一性、角色约束和审核状态流转。
 * 该服务同时承担数据库唯一键异常到业务错误的翻译职责。
 */
export class UserService {
  private readonly bankCardChallengeTtlMs = 10 * 60 * 1000;

  constructor(
    @InjectRepository(SysUser)
    private userRepository: Repository<SysUser>,
    @InjectRepository(ProxyRegistrationCase)
    private proxyRegistrationRepository: Repository<ProxyRegistrationCase>,
    @InjectRepository(BaseInfo)
    private baseRepository: Repository<BaseInfo>,
    private securityService: SecurityService,
    private operationLogService: OperationLogService,
    private dataSource: DataSource,
  ) { }

  /**
   * 将底层数据库唯一键冲突翻译成稳定的业务异常，避免控制器泄露数据库实现细节。
   */
  private rethrowDuplicateKey(error: any): never {
    if (error?.code === 'ER_DUP_ENTRY') {
      const message = String(error?.sqlMessage || error?.message || '');
      if (message.includes('UQ_sys_user_phone_hash')) {
        throw new ConflictException('手机号已被注册');
      }
      if (message.includes('UQ_sys_user_id_card_hash')) {
        throw new ConflictException('身份证号已被注册');
      }
      if (message.includes('IDX_5ad5e9aa3873d6537196e01353') || message.includes('uid')) {
        throw new ConflictException('UID 生成冲突，请重试');
      }
    }
    throw error;
  }

  /**
   * 校验角色与基地绑定关系。
   * 约束:
   * 1. `field_manager` 必须绑定存在的基地。
   * 2. 非 `field_manager` 不允许携带 `assignedBaseId`。
   */
  private async validateAssignedBase(roleKey: UserRole, assignedBaseId?: number, manager?: EntityManager): Promise<void> {
    const baseRepository = manager ? manager.getRepository(BaseInfo) : this.baseRepository;

    if (roleKey === UserRole.FIELD_MANAGER) {
      if (!assignedBaseId) {
        throw new BadRequestException('field_manager 必须绑定 assignedBaseId');
      }

      const base = await baseRepository.findOne({ where: { id: assignedBaseId } });
      if (!base) {
        throw new BadRequestException('assignedBaseId 对应的基地不存在');
      }
      return;
    }

    if (assignedBaseId != null) {
      throw new BadRequestException('只有 field_manager 可以设置 assignedBaseId');
    }
  }

  private normalizeBankCardNo(bankCardNo?: string | null): string | null {
    const normalized = String(bankCardNo || '').replace(/\D/g, '');
    return normalized || null;
  }

  private async hasOtherWorkerWithBankCard(
    bankCardNoHash: string,
    excludeUserId?: number,
    manager?: EntityManager,
  ): Promise<boolean> {
    const userRepository = manager ? manager.getRepository(SysUser) : this.userRepository;

    const qb = userRepository
      .createQueryBuilder('user')
      .where('user.bankCardNoHash = :bankCardNoHash', { bankCardNoHash })
      .andWhere('user.isDeleted = :isDeleted', { isDeleted: false })
      .andWhere('user.roleKey = :roleKey', { roleKey: UserRole.WORKER });

    if (excludeUserId) {
      qb.andWhere('user.id <> :excludeUserId', { excludeUserId });
    }

    return (await qb.getCount()) > 0;
  }

  private async findLatestResubmittableCase(
    workerUserId: number,
    manager?: EntityManager,
  ): Promise<ProxyRegistrationCase | null> {
    const proxyCaseRepository = manager ? manager.getRepository(ProxyRegistrationCase) : this.proxyRegistrationRepository;

    return proxyCaseRepository.findOne({
      where: {
        workerUserId,
        status: In([ProxyRegistrationStatus.REJECTED, ProxyRegistrationStatus.REVOKED]),
      },
      order: { updatedAt: 'DESC' },
    });
  }

  private signBankCardChallengePayload(payload: string): string {
    const secret = process.env.BANK_CARD_CHALLENGE_SECRET || process.env.JWT_SECRET || 'defaultSecretKey';
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }

  private buildBankCardChallengeToken(userId: number, targetBankCardNoHash: string): { token: string; expiresAt: string } {
    const expiresAtTs = Date.now() + this.bankCardChallengeTtlMs;
    const nonce = crypto.randomBytes(8).toString('hex');
    const payload = `${userId}:${targetBankCardNoHash}:${expiresAtTs}:${nonce}`;
    const signature = this.signBankCardChallengePayload(payload);

    return {
      token: `${expiresAtTs}.${nonce}.${signature}`,
      expiresAt: new Date(expiresAtTs).toISOString(),
    };
  }

  private verifyBankCardChallengeToken(token: string, userId: number, targetBankCardNoHash: string): boolean {
    try {
      if (!token) {
        return false;
      }

      const [expiresAtRaw, nonce, signature] = String(token).split('.');
      if (!expiresAtRaw || !nonce || !signature) {
        return false;
      }

      const expiresAtTs = Number(expiresAtRaw);
      if (!Number.isFinite(expiresAtTs) || Date.now() > expiresAtTs) {
        return false;
      }

      const payload = `${userId}:${targetBankCardNoHash}:${expiresAtTs}:${nonce}`;
      const expectedSignature = this.signBankCardChallengePayload(payload);
      if (expectedSignature.length !== signature.length) {
        return false;
      }

      return crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'utf8'),
        Buffer.from(signature, 'utf8'),
      );
    } catch (_) {
      return false;
    }
  }

  private maskBankCardNo(normalizedBankCardNo: string): string {
    const tail4 = String(normalizedBankCardNo || '').slice(-4);
    return `**** **** **** ${tail4 || '****'}`;
  }

  /**
   * 创建用户并完成敏感字段 hash 计算、唯一性校验和默认审核状态初始化。
   * 副作用:
   * 1. 写入 `sys_user`。
   * 2. 依赖实体 transformer 在持久化阶段执行字段加密。
   */
  async create(createUserDto: CreateUserDto, context?: OperationLogContext): Promise<SysUser> {
    const roleKey = createUserDto.roleKey || UserRole.WORKER;
    await this.validateAssignedBase(roleKey, createUserDto.assignedBaseId);

    // 1. Calculate Hash for Uniqueness Check (Since DB column is encrypted)
    const idCardHash = this.securityService.hash(createUserDto.idCard);
    const phoneHash = this.securityService.hash(createUserDto.phone);

    // Check if ID card already exists
    const existingUserByIdCard = await this.userRepository.findOne({ where: { idCardHash, isDeleted: false } });
    if (existingUserByIdCard) {
      throw new ConflictException('身份证号已被注册');
    }

    // Check if phone already exists
    const existingUserByPhone = await this.userRepository.findOne({ where: { phoneHash, isDeleted: false } });
    if (existingUserByPhone) {
      throw new ConflictException('手机号已被注册');
    }

    // 2. Generate UID (e.g., U + timestamp + random)
    const uid = 'U' + Date.now().toString(36).toUpperCase() + crypto.randomBytes(2).toString('hex').toUpperCase();

    // 3. Calculate emergency phone hash if provided
    let emergencyPhoneHash = null;
    if (createUserDto.emergencyPhone) {
      emergencyPhoneHash = this.securityService.hash(createUserDto.emergencyPhone);
    }

    let bankCardNoHash = null;
    let normalizedBankCardNo = null;
    if (createUserDto.bankCardNo) {
      normalizedBankCardNo = this.normalizeBankCardNo(createUserDto.bankCardNo);
      if (normalizedBankCardNo) {
        bankCardNoHash = this.securityService.hash(normalizedBankCardNo);
        const existingUserByBankCard = await this.userRepository.findOne({ where: { bankCardNoHash, isDeleted: false } });
        if (existingUserByBankCard) {
          throw new ConflictException('银行卡号已被使用');
        }
      }
    }

    // 4. Create Entity
    // idCard and phone are encrypted via Entity Transformer automatically
    const user = this.userRepository.create({
      ...createUserDto,
      uid,
      roleKey,
      idCardHash,
      phoneHash,
      emergencyPhoneHash,
      bankCardNo: normalizedBankCardNo,
      bankCardNoHash,
      infoAuditStatus: 1, // 首次录入默认通过审核
      registerMode: RegisterMode.SELF,
      accountOwnerVerified: true,
      loginLockReason: null,
    });

    try {
      const savedUser = await this.userRepository.save(user);

      await this.operationLogService.logWithContext({
        operationType: OperationType.CREATE,
        resourceType: ResourceType.USER,
        resourceId: savedUser.id,
        userId: context?.userId ?? savedUser.id,
        request: context?.request,
        description: `创建用户: ${savedUser.name} (${savedUser.uid})`,
        afterData: {
          uid: savedUser.uid,
          roleKey: savedUser.roleKey,
          assignedBaseId: savedUser.assignedBaseId,
          infoAuditStatus: savedUser.infoAuditStatus,
        },
      });

      return savedUser;
    } catch (error) {
      this.rethrowDuplicateKey(error);
    }
  }

  private async evaluateProxyRisk(
    proxyPhoneHash: string,
    workerBankCardNoHash?: string | null,
  ): Promise<{ level: ProxyRiskLevel; tags: string[] }> {
    const tags: string[] = [];

    const recentCount = await this.proxyRegistrationRepository
      .createQueryBuilder('case')
      .where('case.proxyPhoneHash = :proxyPhoneHash', { proxyPhoneHash })
      .andWhere('case.createdAt >= DATE_SUB(NOW(), INTERVAL 1 DAY)')
      .andWhere('case.status IN (:...statuses)', {
        statuses: [ProxyRegistrationStatus.PENDING_REVIEW, ProxyRegistrationStatus.APPROVED],
      })
      .getCount();

    if (recentCount >= 3) {
      tags.push('high_freq_proxy_phone_24h');
    }

    if (workerBankCardNoHash) {
      const hasSharedBankCard = await this.hasOtherWorkerWithBankCard(workerBankCardNoHash);
      if (hasSharedBankCard) {
        tags.push('shared_bank_card_multi_worker');
      }
    }

    return {
      level: tags.length > 0 ? ProxyRiskLevel.HIGH : ProxyRiskLevel.LOW,
      tags,
    };
  }

  /**
   * 家人代注册流程：创建工人账号 + 创建代注册审核单。
   * 默认行为：工人账号处于待审核状态，审核通过后才视为可用。
   */
  async createProxyRegistration(dto: CreateProxyRegistrationDto, context?: OperationLogContext) {
    const roleKey = UserRole.WORKER;
    await this.validateAssignedBase(roleKey, undefined);

    const idCardHash = this.securityService.hash(dto.workerIdCard);
    const phoneHash = this.securityService.hash(dto.workerPhone);
    const proxyPhoneHash = this.securityService.hash(dto.proxyPhone);
    const normalizedWorkerBankCardNo = this.normalizeBankCardNo(dto.workerBankCardNo);
    const workerBankCardNoHash = normalizedWorkerBankCardNo
      ? this.securityService.hash(normalizedWorkerBankCardNo)
      : null;

    const existingUserByIdCard = await this.userRepository.findOne({ where: { idCardHash, isDeleted: false } });
    if (existingUserByIdCard) {
      const resubmittableCase = await this.findLatestResubmittableCase(existingUserByIdCard.id);
      if (resubmittableCase) {
        throw new ConflictException(`身份证号已有驳回记录，请改用重提接口并传入 caseId=${resubmittableCase.id}`);
      }
      throw new ConflictException('身份证号已被注册');
    }

    const existingUserByPhone = await this.userRepository.findOne({ where: { phoneHash, isDeleted: false } });
    if (existingUserByPhone) {
      const resubmittableCase = await this.findLatestResubmittableCase(existingUserByPhone.id);
      if (resubmittableCase) {
        throw new ConflictException(`手机号已有驳回记录，请改用重提接口并传入 caseId=${resubmittableCase.id}`);
      }
      throw new ConflictException('手机号已被注册');
    }

    const risk = await this.evaluateProxyRisk(proxyPhoneHash, workerBankCardNoHash);
    const uid = 'U' + Date.now().toString(36).toUpperCase() + crypto.randomBytes(2).toString('hex').toUpperCase();

    const { savedUser, savedCase } = await this.dataSource.transaction(async (manager) => {
      const userRepository = manager.getRepository(SysUser);
      const proxyCaseRepository = manager.getRepository(ProxyRegistrationCase);

      const emergencyPhoneHash = dto.workerEmergencyPhone
        ? this.securityService.hash(dto.workerEmergencyPhone)
        : null;

      const workerUser = userRepository.create({
        uid,
        name: dto.workerName,
        idCard: dto.workerIdCard,
        phone: dto.workerPhone,
        roleKey,
        idCardHash,
        phoneHash,
        emergencyContact: dto.workerEmergencyContact,
        emergencyPhone: dto.workerEmergencyPhone,
        emergencyPhoneHash,
        homeAddress: dto.workerHomeAddress,
        bankName: dto.workerBankName,
        bankCardNo: normalizedWorkerBankCardNo,
        bankCardNoHash: workerBankCardNoHash,
        infoAuditStatus: 0,
        registerMode: RegisterMode.PROXY,
        accountOwnerVerified: false,
        loginLockReason: '代注册待审核',
      });
      const savedWorker = await userRepository.save(workerUser);

      const proxyCase = proxyCaseRepository.create({
        workerUserId: savedWorker.id,
        proxyName: dto.proxyName,
        proxyPhone: dto.proxyPhone,
        proxyPhoneHash,
        relationToWorker: dto.relationToWorker,
        consentType: dto.consentType || 'family_confirm',
        consentStatement: dto.consentStatement || null,
        consentEvidenceUrl: dto.consentEvidenceUrl || null,
        status: ProxyRegistrationStatus.PENDING_REVIEW,
        riskLevel: risk.level,
        riskTagsJson: risk.tags.length > 0 ? JSON.stringify(risk.tags) : null,
      });
      const savedProxyCase = await proxyCaseRepository.save(proxyCase);

      return {
        savedUser: savedWorker,
        savedCase: savedProxyCase,
      };
    });

    await this.operationLogService.logWithContext({
      operationType: OperationType.CREATE,
      resourceType: ResourceType.USER,
      resourceId: savedUser.id,
      userId: context?.userId ?? savedUser.id,
      request: context?.request,
      description: `代注册创建工人用户: ${savedUser.name} (${savedUser.uid})`,
      afterData: {
        uid: savedUser.uid,
        roleKey: savedUser.roleKey,
        registerMode: savedUser.registerMode,
        infoAuditStatus: savedUser.infoAuditStatus,
      },
    });

    await this.operationLogService.logWithContext({
      operationType: OperationType.CREATE,
      resourceType: ResourceType.PROXY_REGISTRATION_CASE,
      resourceId: savedCase.id,
      userId: context?.userId ?? savedUser.id,
      request: context?.request,
      description: `创建代注册单: worker=${savedUser.uid}, proxy=${dto.proxyName}`,
      afterData: {
        workerUserId: savedCase.workerUserId,
        status: savedCase.status,
        riskLevel: savedCase.riskLevel,
      },
    });

    return {
      workerUserId: savedUser.id,
      workerUid: savedUser.uid,
      workerName: savedUser.name,
      caseId: savedCase.id,
      status: savedCase.status,
      riskLevel: savedCase.riskLevel,
      msg: '代注册提交成功，等待审核',
    };
  }

  async resubmitProxyRegistration(caseId: number, dto: CreateProxyRegistrationDto, request?: any) {
    const idCardHash = this.securityService.hash(dto.workerIdCard);
    const phoneHash = this.securityService.hash(dto.workerPhone);
    const proxyPhoneHash = this.securityService.hash(dto.proxyPhone);
    const normalizedWorkerBankCardNo = this.normalizeBankCardNo(dto.workerBankCardNo);
    const workerBankCardNoHash = normalizedWorkerBankCardNo
      ? this.securityService.hash(normalizedWorkerBankCardNo)
      : null;
    const risk = await this.evaluateProxyRisk(proxyPhoneHash, workerBankCardNoHash);

    const { savedCase, savedWorker } = await this.dataSource.transaction(async (manager) => {
      const userRepository = manager.getRepository(SysUser);
      const proxyCaseRepository = manager.getRepository(ProxyRegistrationCase);

      const proxyCase = await proxyCaseRepository.findOne({
        where: { id: caseId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!proxyCase) {
        throw new NotFoundException('代注册单不存在');
      }

      if (![ProxyRegistrationStatus.REJECTED, ProxyRegistrationStatus.REVOKED].includes(proxyCase.status)) {
        throw new ConflictException('仅驳回或撤销状态的代注册单可重提');
      }

      const workerUser = await userRepository.findOne({
        where: { id: proxyCase.workerUserId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!workerUser || workerUser.isDeleted) {
        throw new NotFoundException('代注册单对应工人用户不存在');
      }

      const existingIdCardUser = await userRepository.findOne({ where: { idCardHash, isDeleted: false } });
      if (existingIdCardUser && existingIdCardUser.id !== workerUser.id) {
        throw new ConflictException('身份证号已被其他账号使用');
      }

      const existingPhoneUser = await userRepository.findOne({ where: { phoneHash, isDeleted: false } });
      if (existingPhoneUser && existingPhoneUser.id !== workerUser.id) {
        throw new ConflictException('手机号已被其他账号使用');
      }

      if (workerBankCardNoHash) {
        const existingBankCardUser = await userRepository.findOne({ where: { bankCardNoHash: workerBankCardNoHash, isDeleted: false } });
        if (existingBankCardUser && existingBankCardUser.id !== workerUser.id) {
          const isWorkerSharedCard = existingBankCardUser.roleKey === UserRole.WORKER;
          if (!isWorkerSharedCard) {
            throw new ConflictException('银行卡号已被其他账号使用');
          }
        }
      }

      workerUser.name = dto.workerName;
      workerUser.idCard = dto.workerIdCard;
      workerUser.idCardHash = idCardHash;
      workerUser.phone = dto.workerPhone;
      workerUser.phoneHash = phoneHash;
      workerUser.emergencyContact = dto.workerEmergencyContact || null;
      workerUser.emergencyPhone = dto.workerEmergencyPhone || null;
      workerUser.emergencyPhoneHash = dto.workerEmergencyPhone
        ? this.securityService.hash(dto.workerEmergencyPhone)
        : null;
      workerUser.homeAddress = dto.workerHomeAddress || null;
      workerUser.bankName = dto.workerBankName || null;
      workerUser.bankCardNo = normalizedWorkerBankCardNo;
      workerUser.bankCardNoHash = workerBankCardNoHash;
      workerUser.infoAuditStatus = 0;
      workerUser.registerMode = RegisterMode.PROXY;
      workerUser.accountOwnerVerified = false;
      workerUser.loginLockReason = '代注册待审核';

      proxyCase.proxyName = dto.proxyName;
      proxyCase.proxyPhone = dto.proxyPhone;
      proxyCase.proxyPhoneHash = proxyPhoneHash;
      proxyCase.relationToWorker = dto.relationToWorker;
      proxyCase.consentType = dto.consentType || 'family_confirm';
      proxyCase.consentStatement = dto.consentStatement || null;
      proxyCase.consentEvidenceUrl = dto.consentEvidenceUrl || null;
      proxyCase.status = ProxyRegistrationStatus.PENDING_REVIEW;
      proxyCase.riskLevel = risk.level;
      proxyCase.riskTagsJson = risk.tags.length > 0 ? JSON.stringify(risk.tags) : null;
      proxyCase.rejectReason = null;
      proxyCase.reviewedBy = null;
      proxyCase.reviewedAt = null;

      const nextWorker = await userRepository.save(workerUser);
      const nextCase = await proxyCaseRepository.save(proxyCase);
      return { savedCase: nextCase, savedWorker: nextWorker };
    });

    await this.operationLogService.logWithContext({
      operationType: OperationType.UPDATE,
      resourceType: ResourceType.PROXY_REGISTRATION_CASE,
      resourceId: savedCase.id,
      userId: 0,
      request,
      description: `代注册单重提: case=${savedCase.id}, worker=${savedWorker.uid}`,
      afterData: {
        status: savedCase.status,
        riskLevel: savedCase.riskLevel,
        workerInfoAuditStatus: savedWorker.infoAuditStatus,
      },
    });

    return {
      caseId: savedCase.id,
      status: savedCase.status,
      workerUserId: savedWorker.id,
      workerUid: savedWorker.uid,
      riskLevel: savedCase.riskLevel,
      msg: '代注册已重新提交，等待审核',
    };
  }

  /**
   * 仅允许首个超级管理员继续扩展超级管理员账号。
   * 该约束用于避免任意高权限用户横向复制超级权限。
   */
  async createSuperAdmin(createUserDto: CreateUserDto, operatorId: number, request?: any): Promise<SysUser> {
    const bootstrapSuperAdmin = await this.userRepository.findOne({
      where: {
        roleKey: UserRole.SUPER_ADMIN,
        isDeleted: false,
      },
      order: { id: 'ASC' },
    });

    if (!bootstrapSuperAdmin) {
      throw new NotFoundException('系统中不存在可用于授权的超级管理员');
    }

    if (bootstrapSuperAdmin.id !== operatorId) {
      throw new ForbiddenException('仅首个超级管理员可以创建次级超级管理员');
    }

    return this.create(
      {
        ...createUserDto,
        roleKey: UserRole.SUPER_ADMIN,
      },
      {
        userId: operatorId,
        request,
      },
    );
  }

  /**
   * 通过手机号查找用户。
   * 注意:
   * 这里查询的是 `phoneHash`，不是手机号明文，以保持密文字段的可检索性与唯一性。
   */
  async findByPhone(phone: string): Promise<SysUser | undefined> {
    // 使用 phoneHash 查询（唯一正确的方式）
    const phoneHash = this.securityService.hash(phone);
    console.log(`[UserService] 查询手机号: ${phone}, phoneHash: ${phoneHash.substring(0, 16)}...`);

    const user = await this.userRepository.findOne({
      where: {
        phoneHash,
        isDeleted: false  // 只查询未删除的用户
      }
    });

    if (user) {
      console.log(`[UserService] 找到用户: ${user.uid} (${user.name})`);
      // 注意：idCard 字段已经通过 EncryptionTransformer 自动解密了
      // 不需要再调用 this.securityService.decrypt(user.idCard)
    } else {
      console.log(`[UserService] 用户未找到: ${phone}`);
    }

    return user;
  }

  async findOne(id: number): Promise<SysUser> {
    return this.userRepository.findOne({ where: { id } });
  }

  async findByUid(uid: string): Promise<SysUser> {
    return this.userRepository.findOne({ where: { uid } });
  }

  async requestBankCardChangeChallenge(userId: number, bankCardNo: string) {
    const user = await this.userRepository.findOne({
      where: {
        id: userId,
        isDeleted: false,
      },
    });
    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    const normalizedBankCardNo = this.normalizeBankCardNo(bankCardNo);
    if (!normalizedBankCardNo || normalizedBankCardNo.length < 12) {
      throw new BadRequestException('请输入正确的银行卡号');
    }

    const nextBankCardNoHash = this.securityService.hash(normalizedBankCardNo);
    const needsChallenge =
      user.infoAuditStatus === 1 &&
      Boolean(user.bankCardNoHash) &&
      user.bankCardNoHash !== nextBankCardNoHash;

    if (!needsChallenge) {
      return {
        required: false,
        challengeToken: null,
        expiresAt: null,
        maskedBankCardNo: this.maskBankCardNo(normalizedBankCardNo),
      };
    }

    const challenge = this.buildBankCardChallengeToken(userId, nextBankCardNoHash);
    return {
      required: true,
      challengeToken: challenge.token,
      expiresAt: challenge.expiresAt,
      maskedBankCardNo: this.maskBankCardNo(normalizedBankCardNo),
    };
  }

  /**
   * 更新用户资料，并在必要时重算 hash 与回退审核状态。
   * 当更新涉及手机号或紧急联系人时，服务会强制重新进入待审核。
   */
  async update(userId: number, updateDto: any, context?: OperationLogContext): Promise<SysUser> {
    try {
      const { saved, beforeSnapshot, bankCardRiskTags } = await this.dataSource.transaction(async (manager) => {
        const userRepository = manager.getRepository(SysUser);
        const user = await userRepository.findOne({
          where: { id: userId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!user || user.isDeleted) {
          throw new NotFoundException('用户不存在');
        }

        const nextUpdate = { ...updateDto };
        const bankCardChallengeToken = String(nextUpdate.bankCardChallengeToken || '').trim();
        delete nextUpdate.bankCardChallengeToken;
        const before = {
          roleKey: user.roleKey,
          assignedBaseId: user.assignedBaseId,
          infoAuditStatus: user.infoAuditStatus,
          regionCode: user.regionCode,
          phoneUpdated: false,
          emergencyPhoneUpdated: false,
        };
        const bankCardRiskTags: string[] = [];

        if (nextUpdate.assignedBaseId !== undefined) {
          await this.validateAssignedBase(user.roleKey, nextUpdate.assignedBaseId, manager);
        }

        if (nextUpdate.phone && nextUpdate.phone !== user.phone) {
          const phoneHash = this.securityService.hash(nextUpdate.phone);
          const existingUser = await userRepository.findOne({ where: { phoneHash, isDeleted: false } });
          if (existingUser && existingUser.id !== userId) {
            throw new ConflictException('手机号已被使用');
          }
          nextUpdate.phoneHash = phoneHash;
        }

        if (nextUpdate.emergencyPhone) {
          nextUpdate.emergencyPhoneHash = this.securityService.hash(nextUpdate.emergencyPhone);
        }

        const bankCardNoTouched = Object.prototype.hasOwnProperty.call(nextUpdate, 'bankCardNo');
        if (bankCardNoTouched) {
          const rawBankCardNo = this.normalizeBankCardNo(nextUpdate.bankCardNo);
          if (rawBankCardNo) {
            const bankCardNoHash = this.securityService.hash(rawBankCardNo);
            const requiresChallenge =
              user.infoAuditStatus === 1 &&
              Boolean(user.bankCardNoHash) &&
              user.bankCardNoHash !== bankCardNoHash;
            if (requiresChallenge && !this.verifyBankCardChallengeToken(bankCardChallengeToken, userId, bankCardNoHash)) {
              throw new BadRequestException('银行卡修改需二次确认，请先调用挑战接口');
            }

            const existingUser = await userRepository.findOne({ where: { bankCardNoHash, isDeleted: false } });
            if (existingUser && existingUser.id !== userId) {
              const isWorkerSharedCard = user.roleKey === UserRole.WORKER && existingUser.roleKey === UserRole.WORKER;
              if (!isWorkerSharedCard) {
                throw new ConflictException('银行卡号已被使用');
              }
            }

            const hasSharedWorkerBankCard = await this.hasOtherWorkerWithBankCard(bankCardNoHash, userId, manager);
            if (hasSharedWorkerBankCard) {
              bankCardRiskTags.push('shared_bank_card_multi_worker');
            }

            nextUpdate.bankCardNo = rawBankCardNo;
            nextUpdate.bankCardNoHash = bankCardNoHash;
          } else {
            nextUpdate.bankCardNo = null;
            nextUpdate.bankCardNoHash = null;
          }
        }

        if (
          nextUpdate.phone ||
          nextUpdate.emergencyContact ||
          nextUpdate.emergencyPhone ||
          nextUpdate.homeAddress ||
          nextUpdate.bankName ||
          bankCardNoTouched
        ) {
          nextUpdate.infoAuditStatus = 0;
        }

        Object.assign(user, nextUpdate);
        const next = await userRepository.save(user);
        return { saved: next, beforeSnapshot: before, bankCardRiskTags };
      });

      await this.operationLogService.logWithContext({
        operationType: OperationType.UPDATE,
        resourceType: ResourceType.USER,
        resourceId: saved.id,
        userId: context?.userId ?? saved.id,
        request: context?.request,
        description: `更新用户资料: ${saved.name} (${saved.uid})`,
        beforeData: beforeSnapshot,
        afterData: {
          roleKey: saved.roleKey,
          assignedBaseId: saved.assignedBaseId,
          infoAuditStatus: saved.infoAuditStatus,
          regionCode: saved.regionCode,
          phoneUpdated: Boolean(updateDto.phone),
          emergencyPhoneUpdated: Boolean(updateDto.emergencyPhone),
          bankCardRiskLevel: bankCardRiskTags.length > 0 ? ProxyRiskLevel.HIGH : ProxyRiskLevel.LOW,
          bankCardRiskTags,
        },
      });

      return saved;
    } catch (error) {
      this.rethrowDuplicateKey(error);
    }
  }

  /**
   * 更新实名资料审核状态，并写入操作日志形成审计轨迹。
   */
  async auditInfo(userId: number, status: number, reason?: string, operatorId?: number, request?: any): Promise<SysUser> {
    if (![0, 1, 2].includes(Number(status))) {
      throw new BadRequestException('审核状态必须是 0、1 或 2');
    }

    const { saved, beforeStatus } = await this.dataSource.transaction(async (manager) => {
      const userRepository = manager.getRepository(SysUser);
      const user = await userRepository.findOne({
        where: { id: userId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!user || user.isDeleted) {
        throw new NotFoundException('用户不存在');
      }
      if (user.infoAuditStatus !== 0) {
        throw new ConflictException('该用户信息已被审核，请刷新后重试');
      }

      const previousStatus = user.infoAuditStatus;
      user.infoAuditStatus = status;
      const next = await userRepository.save(user);
      return { saved: next, beforeStatus: previousStatus };
    });

    // 记录审核操作日志
    await this.operationLogService.logWithContext({
      operationType: OperationType.AUDIT,
      resourceType: ResourceType.USER,
      resourceId: userId,
      userId: operatorId || 0,
      request,
      description: `用户审核: ${beforeStatus} -> ${status}${reason ? `, 原因: ${reason}` : ''}`,
      beforeData: { infoAuditStatus: beforeStatus },
      afterData: { infoAuditStatus: status },
    });

    return saved;
  }

  async getProxyRegistrationList(query: {
    status?: ProxyRegistrationStatus;
    keyword?: string;
    page?: number;
    pageSize?: number;
  }) {
    const { status, keyword, page = 1, pageSize = 20 } = query;

    const qb = this.proxyRegistrationRepository
      .createQueryBuilder('proxyCase')
      .leftJoinAndSelect('proxyCase.workerUser', 'worker')
      .leftJoinAndSelect('proxyCase.reviewer', 'reviewer')
      .orderBy('proxyCase.createdAt', 'DESC');

    if (status) {
      qb.andWhere('proxyCase.status = :status', { status });
    }

    if (keyword) {
      qb.andWhere(
        '(worker.name LIKE :kw OR worker.uid LIKE :kw OR proxyCase.proxyName LIKE :kw OR proxyCase.relationToWorker LIKE :kw)',
        { kw: `%${keyword}%` },
      );
    }

    const total = await qb.getCount();
    const list = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getMany();

    return {
      list: list.map((item) => ({
        id: item.id,
        status: item.status,
        riskLevel: item.riskLevel,
        relationToWorker: item.relationToWorker,
        proxyName: item.proxyName,
        proxyPhone: item.proxyPhone,
        consentType: item.consentType,
        consentStatement: item.consentStatement,
        consentEvidenceUrl: item.consentEvidenceUrl,
        rejectReason: item.rejectReason,
        reviewedAt: item.reviewedAt,
        reviewerName: item.reviewer?.name,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        worker: item.workerUser
          ? {
              id: item.workerUser.id,
              uid: item.workerUser.uid,
              name: item.workerUser.name,
              roleKey: item.workerUser.roleKey,
              infoAuditStatus: item.workerUser.infoAuditStatus,
              registerMode: item.workerUser.registerMode,
              accountOwnerVerified: item.workerUser.accountOwnerVerified,
            }
          : null,
      })),
      total,
      page: Number(page),
      pageSize: Number(pageSize),
    };
  }

  async reviewProxyRegistration(
    caseId: number,
    status: 'approved' | 'rejected' | 'revoked',
    reason: string | undefined,
    operatorId: number,
    request?: any,
  ) {
    if (status === 'rejected' && !reason) {
      throw new BadRequestException('拒绝时必须填写原因');
    }

    const { proxyCase, workerUser, previousStatus } = await this.dataSource.transaction(async (manager) => {
      const proxyCaseRepository = manager.getRepository(ProxyRegistrationCase);
      const userRepository = manager.getRepository(SysUser);

      const item = await proxyCaseRepository.findOne({
        where: { id: caseId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!item) {
        throw new NotFoundException('代注册单不存在');
      }

      const worker = await userRepository.findOne({
        where: { id: item.workerUserId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!worker || worker.isDeleted) {
        throw new NotFoundException('代注册单对应工人用户不存在');
      }

      const beforeStatus = item.status;

      if (status === 'approved') {
        if (item.status !== ProxyRegistrationStatus.PENDING_REVIEW) {
          throw new ConflictException('仅待审核状态可执行通过操作');
        }
        item.status = ProxyRegistrationStatus.APPROVED;
        item.rejectReason = null;
        worker.infoAuditStatus = 1;
        worker.loginLockReason = null;
      }

      if (status === 'rejected') {
        if (item.status !== ProxyRegistrationStatus.PENDING_REVIEW) {
          throw new ConflictException('仅待审核状态可执行拒绝操作');
        }
        item.status = ProxyRegistrationStatus.REJECTED;
        item.rejectReason = reason || '代注册审核未通过';
        worker.infoAuditStatus = 2;
        worker.loginLockReason = item.rejectReason;
      }

      if (status === 'revoked') {
        if (item.status === ProxyRegistrationStatus.TAKEOVER_DONE) {
          throw new ConflictException('已完成账号交接的代注册单不可撤销');
        }
        item.status = ProxyRegistrationStatus.REVOKED;
        item.rejectReason = reason || '代注册已撤销';
        worker.infoAuditStatus = 2;
        worker.loginLockReason = item.rejectReason;
      }

      item.reviewedBy = operatorId;
      item.reviewedAt = new Date();

      const savedCase = await proxyCaseRepository.save(item);
      const savedWorker = await userRepository.save(worker);

      return { proxyCase: savedCase, workerUser: savedWorker, previousStatus: beforeStatus };
    });

    await this.operationLogService.logWithContext({
      operationType: OperationType.AUDIT,
      resourceType: ResourceType.PROXY_REGISTRATION_CASE,
      resourceId: proxyCase.id,
      userId: operatorId,
      request,
      description: `代注册单审核: ${previousStatus} -> ${proxyCase.status}`,
      beforeData: {
        status: previousStatus,
      },
      afterData: {
        status: proxyCase.status,
        workerInfoAuditStatus: workerUser.infoAuditStatus,
        rejectReason: proxyCase.rejectReason,
      },
    });

    return {
      caseId: proxyCase.id,
      status: proxyCase.status,
      reviewedBy: proxyCase.reviewedBy,
      reviewedAt: proxyCase.reviewedAt,
      rejectReason: proxyCase.rejectReason,
      workerInfoAuditStatus: workerUser.infoAuditStatus,
    };
  }

  async takeoverProxyAccount(
    caseId: number,
    userId: number,
    nextPhone: string,
    idCardLast6: string,
    request?: any,
  ) {
    const { proxyCase, workerUser } = await this.dataSource.transaction(async (manager) => {
      const proxyCaseRepository = manager.getRepository(ProxyRegistrationCase);
      const userRepository = manager.getRepository(SysUser);

      const item = await proxyCaseRepository.findOne({
        where: { id: caseId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!item) {
        throw new NotFoundException('代注册单不存在');
      }
      if (item.workerUserId !== userId) {
        throw new ForbiddenException('仅该代注册单对应的工人可执行账号接管');
      }
      if (item.status !== ProxyRegistrationStatus.APPROVED) {
        throw new ConflictException('仅审核通过的代注册单可执行账号接管');
      }

      const worker = await userRepository.findOne({
        where: { id: userId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!worker || worker.isDeleted) {
        throw new NotFoundException('用户不存在');
      }
      if (worker.registerMode !== RegisterMode.PROXY) {
        throw new BadRequestException('当前用户不是代注册账号，无需接管');
      }
      if (!worker.idCard || !worker.idCard.endsWith(idCardLast6)) {
        throw new ForbiddenException('身份证后 6 位校验失败');
      }

      const nextPhoneHash = this.securityService.hash(nextPhone);
      const existing = await userRepository.findOne({ where: { phoneHash: nextPhoneHash, isDeleted: false } });
      if (existing && existing.id !== userId) {
        throw new ConflictException('手机号已被使用');
      }

      worker.phone = nextPhone;
      worker.phoneHash = nextPhoneHash;
      worker.registerMode = RegisterMode.SELF;
      worker.accountOwnerVerified = true;
      worker.loginLockReason = null;
      worker.infoAuditStatus = 1;

      item.status = ProxyRegistrationStatus.TAKEOVER_DONE;
      item.reviewedBy = userId;
      item.reviewedAt = new Date();

      const savedWorker = await userRepository.save(worker);
      const savedCase = await proxyCaseRepository.save(item);

      return {
        proxyCase: savedCase,
        workerUser: savedWorker,
      };
    });

    await this.operationLogService.logWithContext({
      operationType: OperationType.UPDATE,
      resourceType: ResourceType.PROXY_REGISTRATION_CASE,
      resourceId: proxyCase.id,
      userId,
      request,
      description: `代注册账号完成接管: case=${proxyCase.id}, user=${workerUser.uid}`,
      afterData: {
        status: proxyCase.status,
        registerMode: workerUser.registerMode,
        accountOwnerVerified: workerUser.accountOwnerVerified,
      },
    });

    return {
      caseId: proxyCase.id,
      status: proxyCase.status,
      workerUserId: workerUser.id,
      workerUid: workerUser.uid,
      msg: '账号接管完成',
    };
  }

  /**
   * 获取管理端用户列表。
   * 支持角色、审核状态、关键字和分页筛选，并返回适合前端直接消费的扁平化结构。
   */
  async getList(query: {
    role?: string;
    status?: number;
    keyword?: string;
    page?: number;
    pageSize?: number;
  }) {
    const { role, status, keyword, page = 1, pageSize = 20 } = query;

    const qb = this.userRepository
      .createQueryBuilder('user')
      .where('user.isDeleted = :isDeleted', { isDeleted: false })
      .orderBy('user.createdAt', 'DESC');

    if (role) {
      qb.andWhere('user.roleKey = :role', { role });
    }

    if (status !== undefined && status !== null) {
      qb.andWhere('user.infoAuditStatus = :status', { status: Number(status) });
    }

    if (keyword) {
      // 搜索姓名（明文字段）或 UID
      qb.andWhere('(user.name LIKE :kw OR user.uid LIKE :kw)', { kw: `%${keyword}%` });
    }

    const total = await qb.getCount();
    const list = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getMany();

    return {
      list: list.map((u) => ({
        id: u.id,
        uid: u.uid,
        name: u.name,
        phone: u.phone,
        idCard: u.idCard,
        roleKey: u.roleKey,
        emergencyContact: u.emergencyContact,
        emergencyPhone: u.emergencyPhone,
        homeAddress: u.homeAddress,
        infoAuditStatus: u.infoAuditStatus,
        registerMode: u.registerMode,
        accountOwnerVerified: u.accountOwnerVerified,
        loginLockReason: u.loginLockReason,
        regionCode: u.regionCode,
        assignedBaseId: u.assignedBaseId,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
      })),
      total,
      page: Number(page),
      pageSize: Number(pageSize),
    };
  }

  /**
   * 获取用户总量、工人数量、管理员数量和待审核数量等概览指标。
   */
  async getUserStats() {
    const totalWorkers = await this.userRepository.count({
      where: { roleKey: UserRole.WORKER, isDeleted: false },
    });
    const totalAdmins = await this.userRepository.count({
      where: { roleKey: In([UserRole.SUPER_ADMIN, UserRole.REGION_ADMIN, UserRole.FIELD_MANAGER, UserRole.BASE_MANAGER]), isDeleted: false },
    });
    const pendingAudit = await this.userRepository.count({
      where: { infoAuditStatus: 0, isDeleted: false },
    });
    const totalUsers = await this.userRepository.count({
      where: { isDeleted: false },
    });

    return { totalWorkers, totalAdmins, pendingAudit, totalUsers };
  }

  /**
   * 对用户执行软删除，并补写操作日志。
   * 该方法不会物理删除记录，以保留审计与历史关联数据。
   */
  async softDelete(userId: number, operatorId?: number, request?: any): Promise<void> {
    const deletedUser = await this.dataSource.transaction(async (manager) => {
      const userRepository = manager.getRepository(SysUser);
      const user = await userRepository.findOne({
        where: { id: userId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!user || user.isDeleted) {
        throw new NotFoundException('用户不存在');
      }
      const originalRoleKey = user.roleKey;
      const deletedMarker = `deleted_user_${user.id}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      user.name = `DELETED_USER_${user.id}`;
      user.phone = deletedMarker;
      user.idCard = deletedMarker;
      user.phoneHash = null;
      user.idCardHash = this.securityService.hash(`${deletedMarker}_id_card`);
      user.faceImgUrl = null;
      user.regionCode = null;
      // DB trigger requires field_manager to keep assigned_base_id.
      // Convert role before clearing assignment so soft delete won't be blocked.
      if (user.roleKey === UserRole.FIELD_MANAGER) {
        user.roleKey = UserRole.WORKER;
      }
      user.assignedBaseId = null;
      user.emergencyContact = null;
      user.emergencyPhone = null;
      user.emergencyPhoneHash = null;
      user.homeAddress = null;
      user.bankName = null;
      user.bankCardNo = null;
      user.bankCardNoHash = null;
      user.infoAuditStatus = 2;
      user.registerMode = RegisterMode.SELF;
      user.accountOwnerVerified = false;
      user.loginLockReason = '账号已删除';
      user.isDeleted = true;
      const saved = await userRepository.save(user);
      return { saved, originalRoleKey };
    });

    await this.operationLogService.logWithContext({
      operationType: OperationType.DELETE,
      resourceType: ResourceType.USER,
      resourceId: userId,
      userId: operatorId || 0,
      request,
      description: `软删除用户: ${deletedUser.saved.name} (${deletedUser.saved.uid})`,
      beforeData: {
        isDeleted: false,
        roleKey: deletedUser.originalRoleKey,
      },
      afterData: {
        isDeleted: true,
        roleKey: deletedUser.saved.roleKey,
      },
    });
  }
}
