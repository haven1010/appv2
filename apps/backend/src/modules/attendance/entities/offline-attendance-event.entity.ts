/**
 * Layer: Persistence Entity
 * Responsibility: Defines the Offline Attendance Event persistence mapping and documents how offline补签到原始事件 is stored in the relational schema.
 * Notes: Keep comments focused on intent, invariants, side effects, and cross-module contracts.
 */
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { SysUser } from '../../user/entities/sys-user.entity';
import { BaseInfo } from '../../base/entities/base-info.entity';
import { RecruitmentJob } from '../../base/entities/recruitment-job.entity';
import { DailySignup } from './daily-signup.entity';

export enum OfflineAttendanceEventStatus {
  PENDING_REVIEW = 0,
  AUTO_APPROVED = 1,
  APPROVED = 2,
  REJECTED = 3,
}

export enum OfflineAttendanceRiskLevel {
  LOW = 0,
  HIGH = 1,
}

@Entity('offline_attendance_event')
@Index('UQ_offline_attendance_event_device_record', ['deviceId', 'offlineRecordId'], { unique: true })
export class OfflineAttendanceEvent {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'offline_record_id', length: 64, comment: '离线端生成的幂等记录ID' })
  offlineRecordId: string;

  @Column({ name: 'device_id', length: 128, comment: '采集设备ID' })
  deviceId: string;

  @Column({ name: 'worker_uid', length: 32, comment: '工人UID' })
  workerUid: string;

  @Column({ name: 'worker_id', type: 'bigint', nullable: true, comment: '解析出的工人ID' })
  workerId: number | null;

  @ManyToOne(() => SysUser, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'worker_id' })
  worker?: SysUser | null;

  @Column({ name: 'base_id', type: 'bigint', comment: '基地ID' })
  baseId: number;

  @ManyToOne(() => BaseInfo, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'base_id' })
  base: BaseInfo;

  @Column({ name: 'job_id', type: 'bigint', nullable: true, comment: '岗位ID' })
  jobId: number | null;

  @ManyToOne(() => RecruitmentJob, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'job_id' })
  job?: RecruitmentJob | null;

  @Column({ name: 'work_date', type: 'date', comment: '逻辑工作日' })
  workDate: string;

  @Column({ name: 'occurred_at', type: 'datetime', comment: '实际发生时间' })
  occurredAt: Date;

  @Column({ name: 'submitted_by', type: 'bigint', comment: '提交人ID' })
  submittedBy: number;

  @ManyToOne(() => SysUser, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'submitted_by' })
  submitter: SysUser;

  @Column({
    type: 'tinyint',
    default: OfflineAttendanceEventStatus.PENDING_REVIEW,
    comment: '0:待审核,1:自动通过,2:人工通过,3:拒绝',
  })
  status: OfflineAttendanceEventStatus;

  @Column({
    name: 'risk_level',
    type: 'tinyint',
    default: OfflineAttendanceRiskLevel.HIGH,
    comment: '0:低风险,1:高风险',
  })
  riskLevel: OfflineAttendanceRiskLevel;

  @Column({ name: 'validation_message', type: 'text', nullable: true, comment: '系统校验结果或风险说明' })
  validationMessage: string | null;

  @Column({ name: 'evidence_note', type: 'text', nullable: true, comment: '人工备注/证据说明' })
  evidenceNote: string | null;

  @Column({ name: 'evidence_json', type: 'text', nullable: true, comment: '证据快照JSON' })
  evidenceJson: string | null;

  @Column({ name: 'payload_json', type: 'text', nullable: true, comment: '原始上传载荷JSON' })
  payloadJson: string | null;

  @Column({ name: 'reviewed_by', type: 'bigint', nullable: true, comment: '审核人ID' })
  reviewedBy: number | null;

  @ManyToOne(() => SysUser, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reviewed_by' })
  reviewer?: SysUser | null;

  @Column({ name: 'reviewed_at', type: 'datetime', nullable: true, comment: '审核时间' })
  reviewedAt: Date | null;

  @Column({ name: 'applied_signup_id', type: 'bigint', nullable: true, comment: '最终落到的签到记录ID' })
  appliedSignupId: number | null;

  @ManyToOne(() => DailySignup, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'applied_signup_id' })
  appliedSignup?: DailySignup | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
