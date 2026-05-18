/**
 * Layer: Persistence Entity
 * Responsibility: Defines the Labor Salary persistence mapping and documents how the Salary model is stored in the relational schema.
 * Notes: Keep comments focused on intent, invariants, side effects, and cross-module contracts.
 */
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, OneToOne, JoinColumn, ManyToOne } from 'typeorm';
import { DailySignup } from '../../attendance/entities/daily-signup.entity';
import { SysUser } from '../../user/entities/sys-user.entity';

export enum PayoutType {
  CASH = 1,
  TRANSFER = 2,
}

export enum SalaryStatus {
  PENDING = 0,
  CONFIRMED = 1,
  PAID = 2,
}

export enum SalaryAppealStatus {
  NONE = 0,
  PENDING = 1,
  RESOLVED = 2,
  REJECTED = 3,
}

@Entity('labor_salary')
export class LaborSalary {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'signup_id', type: 'bigint', unique: true })
  signupId: number;

  @OneToOne(() => DailySignup, (signup) => signup.salary)
  @JoinColumn({ name: 'signup_id' })
  signup: DailySignup;

  @Column({ name: 'work_duration', type: 'decimal', precision: 4, scale: 1, default: 0 })
  workDuration: number;

  @Column({ name: 'piece_count', type: 'int', default: 0 })
  pieceCount: number;

  @Column({ name: 'unit_price_snapshot', type: 'decimal', precision: 10, scale: 2 })
  unitPriceSnapshot: number;

  @Column({ name: 'total_amount', type: 'decimal', precision: 10, scale: 2 })
  totalAmount: number;

  @Column({ 
    name: 'payout_type', 
    type: 'tinyint', 
    nullable: true,
    comment: '1:Cash, 2:Transfer'
  })
  payoutType: PayoutType;

  @Column({ 
    name: 'status', 
    type: 'tinyint', 
    default: SalaryStatus.PENDING,
    comment: '0:Pending, 1:Confirmed, 2:Paid'
  })
  status: SalaryStatus;

  @Column({ name: 'proof_img_url', length: 255, nullable: true })
  proofImgUrl: string;

  @Column({ name: 'worker_sign_url', length: 255, nullable: true })
  workerSignUrl: string;

  @Column({
    name: 'worker_appeal_status',
    type: 'tinyint',
    default: SalaryAppealStatus.NONE,
    comment: '0:无申诉, 1:待处理, 2:已调整待确认, 3:已驳回',
  })
  workerAppealStatus: SalaryAppealStatus;

  @Column({ name: 'worker_appeal_reason', type: 'text', nullable: true, comment: '采摘工申诉原因' })
  workerAppealReason: string | null;

  @Column({
    name: 'worker_expected_amount',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    comment: '采摘工申诉期望金额',
  })
  workerExpectedAmount: number | null;

  @Column({ name: 'worker_appealed_at', type: 'datetime', nullable: true, comment: '采摘工申诉时间' })
  workerAppealedAt: Date | null;

  @Column({ name: 'appeal_reply', type: 'text', nullable: true, comment: '基地管理员处理说明' })
  appealReply: string | null;

  @Column({ name: 'appeal_handled_by', type: 'bigint', nullable: true, comment: '申诉处理人ID' })
  appealHandledBy: number | null;

  @Column({ name: 'appeal_handled_at', type: 'datetime', nullable: true, comment: '申诉处理时间' })
  appealHandledAt: Date | null;

  @Column({ name: 'admin_id', type: 'bigint' })
  adminId: number;

  @ManyToOne(() => SysUser, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'admin_id' })
  admin: SysUser;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
