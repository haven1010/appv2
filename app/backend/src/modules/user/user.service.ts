/**
 * Layer: Backend Service
 * Responsibility: Implements the User application service for the User module, including business rules, side effects, and persistence coordination.
 * Notes: Keep comments focused on intent, invariants, side effects, and cross-module contracts.
 */
import { Injectable, BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, DataSource, EntityManager } from 'typeorm';
import { SysUser, UserRole } from './entities/sys-user.entity';
import { CreateUserDto } from './dto/create-user.dto';
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
  constructor(
    @InjectRepository(SysUser)
    private userRepository: Repository<SysUser>,
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

    // 4. Create Entity
    // idCard and phone are encrypted via Entity Transformer automatically
    const user = this.userRepository.create({
      ...createUserDto,
      uid,
      roleKey,
      idCardHash,
      phoneHash,
      emergencyPhoneHash,
      infoAuditStatus: 1, // 首次录入默认通过审核
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

  /**
   * 更新用户资料，并在必要时重算 hash 与回退审核状态。
   * 当更新涉及手机号或紧急联系人时，服务会强制重新进入待审核。
   */
  async update(userId: number, updateDto: any, context?: OperationLogContext): Promise<SysUser> {
    try {
      const { saved, beforeSnapshot } = await this.dataSource.transaction(async (manager) => {
        const userRepository = manager.getRepository(SysUser);
        const user = await userRepository.findOne({
          where: { id: userId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!user || user.isDeleted) {
          throw new NotFoundException('用户不存在');
        }

        const nextUpdate = { ...updateDto };
        const before = {
          roleKey: user.roleKey,
          assignedBaseId: user.assignedBaseId,
          infoAuditStatus: user.infoAuditStatus,
          regionCode: user.regionCode,
          phoneUpdated: false,
          emergencyPhoneUpdated: false,
        };

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

        if (nextUpdate.phone || nextUpdate.emergencyContact || nextUpdate.emergencyPhone) {
          nextUpdate.infoAuditStatus = 0;
        }

        Object.assign(user, nextUpdate);
        const next = await userRepository.save(user);
        return { saved: next, beforeSnapshot: before };
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
