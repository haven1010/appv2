/**
 * Layer: Persistence Entity
 * Responsibility: Defines the user table mapping.
 */
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { EncryptionTransformer } from '../../common/transformers/encryption.transformer';
import { BaseInfo } from '../../base/entities/base-info.entity';

export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  /** @deprecated kept only for historical data compatibility */
  REGION_ADMIN = 'region_admin',
  BOSS = 'boss',
  BASE_MANAGER = 'base_manager',
  FIELD_MANAGER = 'field_manager',
  WORKER = 'worker',
}

export enum RegisterMode {
  SELF = 'self',
  PROXY = 'proxy',
}

export const VALID_REGISTER_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.BOSS,
  UserRole.BASE_MANAGER,
  UserRole.FIELD_MANAGER,
  UserRole.WORKER,
];

export function isSuperAdmin(role: string): boolean {
  return role === UserRole.SUPER_ADMIN || role === UserRole.REGION_ADMIN;
}

@Entity('sys_user')
export class SysUser {
  @ApiProperty({ description: 'Primary key ID' })
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @ApiProperty({ description: 'Public unique ID' })
  @Column({ length: 32, unique: true, comment: 'Public Unique ID' })
  uid: string;

  @ApiProperty({ description: 'Real name' })
  @Column({ length: 50, comment: 'Real Name' })
  name: string;

  @ApiProperty({ description: 'ID card number (encrypted)' })
  @Column({
    name: 'id_card_enc',
    length: 256,
    transformer: new EncryptionTransformer(),
    comment: 'Encrypted ID Card Number',
  })
  idCard: string;

  @ApiProperty({ description: 'Phone number (encrypted)' })
  @Column({
    name: 'phone_enc',
    length: 256,
    transformer: new EncryptionTransformer(),
    comment: 'Encrypted Phone Number',
  })
  phone: string;

  @Index('UQ_sys_user_id_card_hash', { unique: true })
  @Column({ name: 'id_card_hash', length: 64, comment: 'SHA256 Hash of ID Card for Search' })
  idCardHash: string;

  @Index('UQ_sys_user_phone_hash', { unique: true })
  @Column({ name: 'phone_hash', length: 64, nullable: true, comment: 'SHA256 Hash of Phone for Search' })
  phoneHash: string | null;

  @ApiProperty({
    description: 'Role key',
    enum: UserRole,
    example: UserRole.WORKER,
  })
  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.WORKER,
    name: 'role_key',
  })
  roleKey: UserRole;

  @ApiProperty({ description: 'Face image URL', required: false, nullable: true })
  @Column({ name: 'face_img_url', length: 255, nullable: true, comment: 'COS URL for Face/ID Photo' })
  faceImgUrl: string;

  @ApiProperty({ description: 'Region code (for regional admins)', required: false, nullable: true })
  @Column({ name: 'region_code', type: 'int', nullable: true, comment: 'For Region Admins' })
  regionCode: number;

  @ApiProperty({ description: 'Assigned base ID (for field manager)', required: false, nullable: true })
  @Column({ name: 'assigned_base_id', type: 'bigint', nullable: true, comment: 'For Field Managers - assigned base' })
  assignedBaseId: number;

  @ManyToOne(() => BaseInfo, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'assigned_base_id' })
  assignedBase?: BaseInfo;

  @ApiProperty({ description: 'Emergency contact (encrypted)', required: false, nullable: true })
  @Column({
    name: 'emergency_contact_enc',
    length: 256,
    nullable: true,
    transformer: new EncryptionTransformer(),
    comment: 'Encrypted Emergency Contact (Name and Relationship)',
  })
  emergencyContact: string;

  @ApiProperty({ description: 'Emergency contact phone (encrypted)', required: false, nullable: true })
  @Column({
    name: 'emergency_phone_enc',
    length: 256,
    nullable: true,
    transformer: new EncryptionTransformer(),
    comment: 'Encrypted Emergency Contact Phone',
  })
  emergencyPhone: string;

  @Index('IDX_sys_user_emergency_phone_hash')
  @Column({ name: 'emergency_phone_hash', length: 64, nullable: true, comment: 'Hash of Emergency Phone for Search' })
  emergencyPhoneHash: string | null;

  @ApiProperty({ description: 'Home address (encrypted)', required: false, nullable: true })
  @Column({
    name: 'home_address_enc',
    length: 512,
    nullable: true,
    transformer: new EncryptionTransformer(),
    comment: 'Encrypted Home Address',
  })
  homeAddress: string | null;

  @ApiProperty({ description: 'Bank name', required: false, nullable: true })
  @Column({
    name: 'bank_name',
    length: 100,
    nullable: true,
    comment: 'Bank Name',
  })
  bankName: string | null;

  @ApiProperty({ description: 'Bank card number (encrypted)', required: false, nullable: true })
  @Column({
    name: 'bank_card_no_enc',
    length: 256,
    nullable: true,
    transformer: new EncryptionTransformer(),
    comment: 'Encrypted Bank Card Number',
  })
  bankCardNo: string | null;

  @Index('IDX_sys_user_bank_card_no_hash')
  @Column({
    name: 'bank_card_no_hash',
    length: 64,
    nullable: true,
    comment: 'Hash of Bank Card Number for Search',
  })
  bankCardNoHash: string | null;

  @ApiProperty({ description: 'Info audit status', enum: [0, 1, 2], example: 1 })
  @Column({
    name: 'info_audit_status',
    type: 'tinyint',
    default: 1,
    comment: '0:Pending, 1:Approved, 2:Rejected',
  })
  infoAuditStatus: number;

  @ApiProperty({ description: '注册模式', enum: RegisterMode, example: RegisterMode.SELF })
  @Column({
    name: 'register_mode',
    type: 'enum',
    enum: RegisterMode,
    default: RegisterMode.SELF,
    comment: 'self:本人注册, proxy:家人代注册',
  })
  registerMode: RegisterMode;

  @ApiProperty({ description: '是否完成本人接管', example: true })
  @Column({
    name: 'account_owner_verified',
    type: 'tinyint',
    default: 1,
    comment: '1:已完成本人接管, 0:未完成',
  })
  accountOwnerVerified: boolean;

  @ApiProperty({ description: '登录限制原因', required: false, nullable: true })
  @Column({
    name: 'login_lock_reason',
    length: 255,
    nullable: true,
    comment: '登录限制原因（审核拒绝或撤销）',
  })
  loginLockReason: string | null;

  @Column({ default: false, name: 'is_deleted' })
  isDeleted: boolean;

  @ApiProperty({ description: 'Created time' })
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ApiProperty({ description: 'Updated time' })
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}