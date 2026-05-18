/**
 * Layer: Persistence Entity
 * Responsibility: Defines the Job Application persistence mapping and documents how the Base model is stored in the relational schema.
 * Notes: Keep comments focused on intent, invariants, side effects, and cross-module contracts.
 */
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { SysUser } from '../../user/entities/sys-user.entity';
import { RecruitmentJob } from './recruitment-job.entity';
import { BaseInfo } from './base-info.entity';

export enum ApplicationStatus {
  PENDING = 0,    // 待处理
  APPROVED = 1,   // 已通过
  REJECTED = 2,   // 已拒绝
  CANCELLED = 3,  // 已取消
}

@Entity('job_application')
export class JobApplication {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Index()
  @Column({ name: 'user_id', type: 'bigint' })
  userId: number;

  @Index()
  @Column({ name: 'job_id', type: 'bigint' })
  jobId: number;

  @Index()
  @Column({ name: 'base_id', type: 'bigint' })
  baseId: number;

  @Column({
    type: 'tinyint',
    default: ApplicationStatus.PENDING,
    comment: '0:待处理, 1:已通过, 2:已拒绝, 3:已取消'
  })
  status: ApplicationStatus;

  @Column({ type: 'text', nullable: true, comment: '申请备注' })
  note: string;

  @Column({ type: 'text', nullable: true, comment: '拒绝原因' })
  rejectReason: string;

  @Column({ name: 'reviewed_by', type: 'bigint', nullable: true, comment: '审核人ID' })
  reviewedBy: number | null;

  @Column({ name: 'reviewed_at', type: 'datetime', nullable: true, comment: '审核时间' })
  reviewedAt: Date;

  @Column({ name: 'work_end_time', type: 'datetime', nullable: true, comment: '结束务工时间' })
  workEndTime: Date | null;

  @Column({ name: 'work_end_by', type: 'bigint', nullable: true, comment: '结束务工操作人ID' })
  workEndBy: number | null;

  @Column({ name: 'work_end_recorded_at', type: 'datetime', nullable: true, comment: '结束务工记录创建时间' })
  workEndRecordedAt: Date | null;

  @ManyToOne(() => SysUser)
  @JoinColumn({ name: 'user_id' })
  user: SysUser;

  @ManyToOne(() => RecruitmentJob)
  @JoinColumn({ name: 'job_id' })
  job: RecruitmentJob;

  @ManyToOne(() => BaseInfo)
  @JoinColumn({ name: 'base_id' })
  base: BaseInfo;

  @ManyToOne(() => SysUser, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'reviewed_by' })
  reviewer?: SysUser;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
