
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, OneToOne, JoinColumn } from 'typeorm';
import { DailySignup } from '../../attendance/entities/daily-signup.entity';

export enum PayoutType {
  CASH = 1,
  TRANSFER = 2,
}

export enum SalaryStatus {
  PENDING = 0,
  CONFIRMED = 1,
  PAID = 2,
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

  @Column({ name: 'admin_id', type: 'bigint' })
  adminId: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
