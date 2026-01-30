import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { LaborSalary } from './labor-salary.entity';
import { SysUser } from '../../user/entities/sys-user.entity';

export enum PaymentMethod {
  CASH = 'cash',           // 现金
  TRANSFER = 'transfer',   // 转账
}

export enum PaymentStatus {
  PENDING = 0,    // 待确认
  CONFIRMED = 1,  // 已确认
  PAID = 2,       // 已发放
  CANCELLED = 3,  // 已取消
}

@Entity('salary_payment')
export class SalaryPayment {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Index()
  @Column({ name: 'salary_id', type: 'bigint', comment: '工资记录ID' })
  salaryId: number;

  @Column({ 
    type: 'enum', 
    enum: PaymentMethod,
    comment: '发放方式' 
  })
  paymentMethod: PaymentMethod;

  @Column({
    type: 'tinyint',
    default: PaymentStatus.PENDING,
    comment: '0:待确认, 1:已确认, 2:已发放, 3:已取消'
  })
  status: PaymentStatus;

  @Column({ name: 'confirm_signature_url', type: 'text', nullable: true, comment: '确认签字照片URL' })
  confirmSignatureUrl: string;

  @Column({ name: 'payment_voucher_url', type: 'text', nullable: true, comment: '发放凭证照片URL' })
  paymentVoucherUrl: string;

  @Column({ name: 'paid_at', type: 'datetime', nullable: true, comment: '发放时间' })
  paidAt: Date;

  @Column({ name: 'paid_by', type: 'bigint', nullable: true, comment: '发放人ID' })
  paidBy: number;

  @Column({ type: 'text', nullable: true, comment: '备注' })
  note: string;

  @ManyToOne(() => LaborSalary)
  @JoinColumn({ name: 'salary_id' })
  salary: LaborSalary;

  @ManyToOne(() => SysUser)
  @JoinColumn({ name: 'paid_by' })
  payer: SysUser;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
