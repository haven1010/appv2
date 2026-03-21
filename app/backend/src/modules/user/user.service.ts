/**
 * Layer: Backend Service
 * Responsibility: Implements the User application service for the User module, including business rules, side effects, and persistence coordination.
 * Notes: Keep comments focused on intent, invariants, side effects, and cross-module contracts.
 */
import { Injectable, BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { SysUser, UserRole } from './entities/sys-user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { SecurityService } from '../common/services/security.service';
import { OperationLogService } from '../common/services/operation-log.service';
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
  private async validateAssignedBase(roleKey: UserRole, assignedBaseId?: number): Promise<void> {
    if (roleKey === UserRole.FIELD_MANAGER) {
      if (!assignedBaseId) {
        throw new BadRequestException('field_manager 必须绑定 assignedBaseId');
      }

      const base = await this.baseRepository.findOne({ where: { id: assignedBaseId } });
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
  async create(createUserDto: CreateUserDto): Promise<SysUser> {
    const roleKey = createUserDto.roleKey || UserRole.WORKER;
    await this.validateAssignedBase(roleKey, createUserDto.assignedBaseId);

    // 1. Calculate Hash for Uniqueness Check (Since DB column is encrypted)
    const idCardHash = this.securityService.hash(createUserDto.idCard);
    const phoneHash = this.securityService.hash(createUserDto.phone);

    // Check if ID card already exists
    const existingUserByIdCard = await this.userRepository.findOne({ where: { idCardHash } });
    if (existingUserByIdCard) {
      throw new ConflictException('身份证号已被注册');
    }

    // Check if phone already exists
    const existingUserByPhone = await this.userRepository.findOne({ where: { phoneHash } });
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
      return await this.userRepository.save(user);
    } catch (error) {
      this.rethrowDuplicateKey(error);
    }
  }

  /**
   * 仅允许首个超级管理员继续扩展超级管理员账号。
   * 该约束用于避免任意高权限用户横向复制超级权限。
   */
  async createSuperAdmin(createUserDto: CreateUserDto, operatorId: number): Promise<SysUser> {
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

    return this.create({
      ...createUserDto,
      roleKey: UserRole.SUPER_ADMIN,
    });
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
  async update(userId: number, updateDto: any): Promise<SysUser> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    if (updateDto.assignedBaseId !== undefined) {
      await this.validateAssignedBase(user.roleKey, updateDto.assignedBaseId);
    }

    // 如果更新手机号，需要重新计算hash
    if (updateDto.phone && updateDto.phone !== user.phone) {
      const phoneHash = this.securityService.hash(updateDto.phone);
      const existingUser = await this.userRepository.findOne({ where: { phoneHash } });
      if (existingUser && existingUser.id !== userId) {
        throw new ConflictException('手机号已被使用');
      }
      updateDto.phoneHash = phoneHash;
    }

    // 如果更新紧急联系人电话，需要重新计算hash
    if (updateDto.emergencyPhone) {
      updateDto.emergencyPhoneHash = this.securityService.hash(updateDto.emergencyPhone);
    }

    // 信息更新后需要重新审核
    if (updateDto.phone || updateDto.emergencyContact || updateDto.emergencyPhone) {
      updateDto.infoAuditStatus = 0; // 待审核
    }

    Object.assign(user, updateDto);
    try {
      return await this.userRepository.save(user);
    } catch (error) {
      this.rethrowDuplicateKey(error);
    }
  }

  /**
   * 更新实名资料审核状态，并写入操作日志形成审计轨迹。
   */
  async auditInfo(userId: number, status: number, reason?: string, operatorId?: number): Promise<SysUser> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    const beforeStatus = user.infoAuditStatus;
    user.infoAuditStatus = status;
    const saved = await this.userRepository.save(user);

    // 记录审核操作日志
    this.operationLogService.log(
      OperationType.AUDIT,
      ResourceType.USER,
      userId,
      operatorId || 0,
      `用户审核: ${beforeStatus} -> ${status}${reason ? `, 原因: ${reason}` : ''}`,
      { infoAuditStatus: beforeStatus },
      { infoAuditStatus: status },
    ).catch(() => {}); // fire-and-forget

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
  async softDelete(userId: number, operatorId?: number): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('用户不存在');
    user.isDeleted = true;
    await this.userRepository.save(user);

    // 记录删除操作日志
    this.operationLogService.log(
      OperationType.DELETE,
      ResourceType.USER,
      userId,
      operatorId || 0,
      `软删除用户: ${user.name} (${user.uid})`,
    ).catch(() => {});
  }
}
