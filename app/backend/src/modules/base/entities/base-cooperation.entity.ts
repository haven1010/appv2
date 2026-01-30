import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseInfo } from './base-info.entity';
import { SysUser } from '../../user/entities/sys-user.entity';

export enum CooperationStatus {
  PENDING = 0,    // 待审核
  APPROVED = 1,  // 已同意
  REJECTED = 2,  // 已拒绝
}

@Entity('base_cooperation')
export class BaseCooperation {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Index()
  @Column({ name: 'base_id', type: 'bigint', comment: '申请合作的基地ID' })
  baseId: number;

  @Index()
  @Column({ name: 'applicant_id', type: 'bigint', comment: '申请人ID（区域管理员/超级管理员）' })
  applicantId: number;

  @Column({ type: 'text', comment: '合作需求描述（工种、人数、周期等）' })
  requirement: string;

  @Column({
    type: 'tinyint',
    default: CooperationStatus.PENDING,
    comment: '0:待审核, 1:已同意, 2:已拒绝'
  })
  status: CooperationStatus;

  @Column({ type: 'text', nullable: true, comment: '拒绝原因' })
  rejectReason: string;

  @Column({ name: 'reviewed_by', type: 'bigint', nullable: true, comment: '审核人ID' })
  reviewedBy: number;

  @Column({ name: 'reviewed_at', type: 'datetime', nullable: true, comment: '审核时间' })
  reviewedAt: Date;

  @ManyToOne(() => BaseInfo)
  @JoinColumn({ name: 'base_id' })
  base: BaseInfo;

  @ManyToOne(() => SysUser)
  @JoinColumn({ name: 'applicant_id' })
  applicant: SysUser;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
