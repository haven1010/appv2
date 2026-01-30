import { Injectable, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SysUser } from './entities/sys-user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { SecurityService } from '../common/services/security.service';
import * as crypto from 'crypto';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(SysUser)
    private userRepository: Repository<SysUser>,
    private securityService: SecurityService,
  ) { }

  async create(createUserDto: CreateUserDto): Promise<SysUser> {
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
      idCardHash,
      phoneHash,
      emergencyPhoneHash,
      infoAuditStatus: 1, // 首次录入默认通过审核
    });

    return this.userRepository.save(user);
  }

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

  async update(userId: number, updateDto: any): Promise<SysUser> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('用户不存在');
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
    return this.userRepository.save(user);
  }

  async auditInfo(userId: number, status: number, reason?: string): Promise<SysUser> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    user.infoAuditStatus = status;
    return this.userRepository.save(user);
  }
}