import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index, ManyToOne, JoinColumn, OneToOne } from 'typeorm';
import { SysUser } from '../../user/entities/sys-user.entity';
import { BaseInfo } from '../../base/entities/base-info.entity';
import { RecruitmentJob } from '../../base/entities/recruitment-job.entity';
import { LaborSalary } from '../../salary/entities/labor-salary.entity';

export enum SignupStatus {
  SIGNED_UP = 0,
  CHECKED_IN = 1,
  ABSENT = 2,
  CANCELLED = 3,
}

@Entity('daily_signup')
@Index(['userId', 'workDate'], { unique: true })
export class DailySignup {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'user_id', type: 'bigint' })
  userId: number;

  @ManyToOne(() => SysUser)
  @JoinColumn({ name: 'user_id' })
  user: SysUser;

  @Column({ name: 'base_id', type: 'bigint' })
  baseId: number;

  @ManyToOne(() => BaseInfo, (base) => base.signups)
  @JoinColumn({ name: 'base_id' })
  base: BaseInfo;

  @Column({ name: 'job_id', type: 'bigint' })
  jobId: number;

  @ManyToOne(() => RecruitmentJob)
  @JoinColumn({ name: 'job_id' })
  job: RecruitmentJob;

  @Column({ name: 'work_date', type: 'date' })
  workDate: string;

  // 🔥🔥🔥 修复点：去掉了 enum: SignupStatus 🔥🔥🔥
  @Column({
    type: 'tinyint',
    default: SignupStatus.SIGNED_UP,
    comment: '0:已报名, 1:已签到, 2:缺勤, 3:取消'
  })
  status: SignupStatus;

  @Column({ name: 'checkin_time', type: 'datetime', nullable: true })
  checkinTime: Date;

  @Column({ name: 'is_proxy', default: false })
  isProxy: boolean;

  @Column({ name: 'proxy_user_id', type: 'bigint', nullable: true })
  proxyUserId: number;

  @Column({ name: 'is_offline_sync', default: false })
  isOfflineSync: boolean;

  @OneToOne(() => LaborSalary, (salary) => salary.signup)
  salary: LaborSalary;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}