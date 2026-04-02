/**
 * Layer: Persistence Entity
 * Responsibility: Stores payroll reports that bosses submit to super admins after settlement.
 * Notes: Keep comments focused on intent, invariants, side effects, and cross-module contracts.
 */
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BaseInfo } from '../../base/entities/base-info.entity';
import { SysUser } from '../../user/entities/sys-user.entity';

@Entity('salary_report_submission')
@Index('IDX_salary_report_submission_base_created', ['baseId', 'createdAt'])
@Index('IDX_salary_report_submission_boss_created', ['bossId', 'createdAt'])
export class SalaryReportSubmission {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'base_id', type: 'bigint', comment: '基地 ID' })
  baseId: number;

  @ManyToOne(() => BaseInfo, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'base_id' })
  base: BaseInfo;

  @Column({ name: 'boss_id', type: 'bigint', comment: '老板用户 ID' })
  bossId: number;

  @ManyToOne(() => SysUser, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'boss_id' })
  boss: SysUser;

  @Column({ name: 'submitted_by', type: 'bigint', comment: '提交人 ID' })
  submittedBy: number;

  @ManyToOne(() => SysUser, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'submitted_by' })
  submitter: SysUser;

  @Column({ name: 'base_name_snapshot', length: 100, comment: '提交时基地名称快照' })
  baseNameSnapshot: string;

  @Column({ name: 'boss_name_snapshot', length: 50, comment: '提交时老板名称快照' })
  bossNameSnapshot: string;

  @Column({ name: 'date_from', type: 'date', nullable: true, comment: '工资表开始日期' })
  dateFrom: string | null;

  @Column({ name: 'date_to', type: 'date', nullable: true, comment: '工资表结束日期' })
  dateTo: string | null;

  @Column({ name: 'salary_record_count', type: 'int', default: 0, comment: '纳入工资单数量' })
  salaryRecordCount: number;

  @Column({ name: 'worker_count', type: 'int', default: 0, comment: '工资表工人数' })
  workerCount: number;

  @Column({ name: 'total_income', type: 'decimal', precision: 12, scale: 2, default: 0, comment: '工资表总金额' })
  totalIncome: number;

  @Column({ name: 'file_name', length: 255, comment: '工资表文件名' })
  fileName: string;

  @Column({ name: 'report_payload', type: 'longtext', comment: '工资表快照 JSON' })
  reportPayload: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
