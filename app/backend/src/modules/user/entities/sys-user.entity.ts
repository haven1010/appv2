import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index, JoinColumn, ManyToOne } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger'; // 🔥 关键引入
import { EncryptionTransformer } from '../../common/transformers/encryption.transformer';
import { BaseInfo } from '../../base/entities/base-info.entity';

export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  /** @deprecated 已废弃，历史数据兼容，登录时按 SUPER_ADMIN 权限处理 */
  REGION_ADMIN = 'region_admin',
  BASE_MANAGER = 'base_manager',
  FIELD_MANAGER = 'field_manager',
  WORKER = 'worker',
}

/** 注册/前端可选的有效角色（排除废弃的 REGION_ADMIN） */
export const VALID_REGISTER_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.BASE_MANAGER,
  UserRole.FIELD_MANAGER,
  UserRole.WORKER,
];

/** 判断角色是否具有超级管理员权限（含已废弃的 REGION_ADMIN） */
export function isSuperAdmin(role: string): boolean {
  return role === UserRole.SUPER_ADMIN || role === UserRole.REGION_ADMIN;
}

@Entity('sys_user')
export class SysUser {
  @ApiProperty({ description: '数据库唯一ID' }) // 🔥 添加 ApiProperty
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @ApiProperty({ description: '公开的用户UID' })
  @Column({ length: 32, unique: true, comment: 'Public Unique ID' })
  uid: string;

  @ApiProperty({ description: '真实姓名' })
  @Column({ length: 50, comment: 'Real Name' })
  name: string;

  // --- Encrypted Fields (AES256) ---

  // 注意：虽然数据库存的是密文，但 TypeORM transformer 读出来是明文
  // 所以这里告诉 Swagger 它是 string，前端收到的是解密后的身份证号
  @ApiProperty({ description: '身份证号 (解密后)' })
  @Column({
    name: 'id_card_enc',
    length: 256,
    transformer: new EncryptionTransformer(),
    comment: 'Encrypted ID Card Number'
  })
  idCard: string;

  @ApiProperty({ description: '手机号 (解密后)' })
  @Column({
    name: 'phone_enc',
    length: 256,
    transformer: new EncryptionTransformer(),
    comment: 'Encrypted Phone Number'
  })
  phone: string;

  // --- Search Indexes (Hash) ---
  // 🔥 哈希字段通常不需要暴露给前端，所以不加 @ApiProperty

  @Index('UQ_sys_user_id_card_hash', { unique: true })
  @Column({ name: 'id_card_hash', length: 64, comment: 'SHA256 Hash of ID Card for Search' })
  idCardHash: string;

  @Index('UQ_sys_user_phone_hash', { unique: true })
  @Column({ name: 'phone_hash', length: 64, nullable: true, comment: 'SHA256 Hash of Phone for Search' })
  phoneHash: string | null;

  @ApiProperty({
    description: '用户角色',
    enum: UserRole, // 🔥 这样前端会自动生成 UserRole 枚举类型
    example: UserRole.WORKER
  })
  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.WORKER,
    name: 'role_key'
  })
  roleKey: UserRole;

  @ApiProperty({ description: '头像地址', required: false, nullable: true })
  @Column({ name: 'face_img_url', length: 255, nullable: true, comment: 'COS URL for Face/ID Photo' })
  faceImgUrl: string;

  @ApiProperty({ description: '区域代码 (管理员专用)', required: false, nullable: true })
  @Column({ name: 'region_code', type: 'int', nullable: true, comment: 'For Region Admins' })
  regionCode: number;

  @ApiProperty({ description: '关联基地ID (现场管理员专用)', required: false, nullable: true })
  @Column({ name: 'assigned_base_id', type: 'bigint', nullable: true, comment: 'For Field Managers - assigned base' })
  assignedBaseId: number;

  @ManyToOne(() => BaseInfo, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'assigned_base_id' })
  assignedBase?: BaseInfo;

  @ApiProperty({ description: '紧急联系人信息', required: false, nullable: true })
  @Column({ 
    name: 'emergency_contact_enc', 
    length: 256, 
    nullable: true,
    transformer: new EncryptionTransformer(),
    comment: 'Encrypted Emergency Contact (Name and Relationship)' 
  })
  emergencyContact: string;

  @ApiProperty({ description: '紧急联系人电话', required: false, nullable: true })
  @Column({ 
    name: 'emergency_phone_enc', 
    length: 256, 
    nullable: true,
    transformer: new EncryptionTransformer(),
    comment: 'Encrypted Emergency Contact Phone' 
  })
  emergencyPhone: string;

  @Index('IDX_sys_user_emergency_phone_hash')
  @Column({ name: 'emergency_phone_hash', length: 64, nullable: true, comment: 'Hash of Emergency Phone for Search' })
  emergencyPhoneHash: string | null;

  @ApiProperty({ description: '信息审核状态', enum: [0, 1, 2], example: 1 })
  @Column({ 
    name: 'info_audit_status', 
    type: 'tinyint', 
    default: 1,
    comment: '0:Pending, 1:Approved, 2:Rejected' 
  })
  infoAuditStatus: number;

  // 通常 isDeleted 不需要返回给前端，除非你要做回收站功能
  @Column({ default: false, name: 'is_deleted' })
  isDeleted: boolean;

  @ApiProperty({ description: '创建时间' })
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ApiProperty({ description: '更新时间' })
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
