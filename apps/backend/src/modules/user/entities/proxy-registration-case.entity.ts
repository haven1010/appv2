/**
 * Layer: Persistence Entity
 * Responsibility: Defines the proxy registration case table mapping.
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
import { SysUser } from './sys-user.entity';

export enum ProxyRegistrationStatus {
  PENDING_REVIEW = 'pending_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  REVOKED = 'revoked',
  TAKEOVER_DONE = 'takeover_done',
}

export enum ProxyRiskLevel {
  LOW = 'low',
  HIGH = 'high',
}

@Entity('proxy_registration_case')
export class ProxyRegistrationCase {
  @ApiProperty({ description: '代注册单 ID' })
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @ApiProperty({ description: '被代注册工人用户 ID' })
  @Index('IDX_proxy_registration_worker_user_id')
  @Column({ name: 'worker_user_id', type: 'bigint' })
  workerUserId: number;

  @ManyToOne(() => SysUser, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'worker_user_id' })
  workerUser: SysUser;

  @ApiProperty({ description: '代办人姓名' })
  @Column({ name: 'proxy_name', length: 50 })
  proxyName: string;

  @ApiProperty({ description: '代办人手机号（加密）' })
  @Column({
    name: 'proxy_phone_enc',
    length: 256,
    transformer: new EncryptionTransformer(),
  })
  proxyPhone: string;

  @ApiProperty({ description: '代办人手机号哈希' })
  @Index('IDX_proxy_registration_proxy_phone_hash')
  @Column({ name: 'proxy_phone_hash', length: 64 })
  proxyPhoneHash: string;

  @ApiProperty({ description: '代办人与工人关系' })
  @Column({ name: 'relation_to_worker', length: 32 })
  relationToWorker: string;

  @ApiProperty({ description: '授权方式', required: false })
  @Column({ name: 'consent_type', length: 32, default: 'family_confirm' })
  consentType: string;

  @ApiProperty({ description: '授权说明文本快照', required: false })
  @Column({ name: 'consent_statement', type: 'text', nullable: true })
  consentStatement: string | null;

  @ApiProperty({ description: '授权凭证链接', required: false })
  @Column({ name: 'consent_evidence_url', length: 512, nullable: true })
  consentEvidenceUrl: string | null;

  @ApiProperty({ description: '代注册审核状态', enum: ProxyRegistrationStatus })
  @Index('IDX_proxy_registration_status')
  @Column({
    type: 'enum',
    enum: ProxyRegistrationStatus,
    default: ProxyRegistrationStatus.PENDING_REVIEW,
  })
  status: ProxyRegistrationStatus;

  @ApiProperty({ description: '风控等级', enum: ProxyRiskLevel })
  @Column({
    name: 'risk_level',
    type: 'enum',
    enum: ProxyRiskLevel,
    default: ProxyRiskLevel.LOW,
  })
  riskLevel: ProxyRiskLevel;

  @ApiProperty({ description: '风控标签 JSON', required: false })
  @Column({ name: 'risk_tags_json', type: 'text', nullable: true })
  riskTagsJson: string | null;

  @ApiProperty({ description: '审核人 ID', required: false })
  @Index('IDX_proxy_registration_reviewed_by')
  @Column({ name: 'reviewed_by', type: 'bigint', nullable: true })
  reviewedBy: number | null;

  @ManyToOne(() => SysUser, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reviewed_by' })
  reviewer?: SysUser;

  @ApiProperty({ description: '审核时间', required: false })
  @Column({ name: 'reviewed_at', type: 'datetime', nullable: true })
  reviewedAt: Date | null;

  @ApiProperty({ description: '拒绝原因', required: false })
  @Column({ name: 'reject_reason', type: 'text', nullable: true })
  rejectReason: string | null;

  @ApiProperty({ description: '创建时间' })
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ApiProperty({ description: '更新时间' })
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
