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
  reviewedBy: number;

  @Column({ name: 'reviewed_at', type: 'datetime', nullable: true, comment: '审核时间' })
  reviewedAt: Date;

  @ManyToOne(() => SysUser)
  @JoinColumn({ name: 'user_id' })
  user: SysUser;

  @ManyToOne(() => RecruitmentJob)
  @JoinColumn({ name: 'job_id' })
  job: RecruitmentJob;

  @ManyToOne(() => BaseInfo)
  @JoinColumn({ name: 'base_id' })
  base: BaseInfo;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
