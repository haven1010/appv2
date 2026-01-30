import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseInfo } from './base-info.entity';

export enum PayType {
  FIXED = 1,      // 固定工资
  HOURLY = 2,     // 时薪
  PIECEWORK = 3,  // 计件
}

export enum WorkCycle {
  DAILY = 1,      // 日结
  WEEKLY = 2,     // 周结
  MONTHLY = 3,    // 月结
  SEASONAL = 4,   // 季节工
  LONG_TERM = 5   // 长期工
}

export enum JobStatus {
  OFFLINE = 0,    // 已下架
  RECRUITING = 1, // 招聘中
  FULL = 2,       // 已招满
  EXPIRED = 3     // 已过期
}

@Entity('recruitment_job')
export class RecruitmentJob {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'base_id', type: 'bigint' })
  baseId: number;

  @ManyToOne(() => BaseInfo, (base) => base.jobs)
  @JoinColumn({ name: 'base_id' })
  base: BaseInfo;

  // ========== 基础信息 ==========
  @Column({ name: 'job_title', length: 100, comment: '岗位名称' })
  jobTitle: string;

  @Column({ name: 'recruit_count', type: 'int', default: 1, comment: '招聘人数' })
  recruitCount: number;

  @Column({
    name: 'work_cycle',
    type: 'tinyint',
    default: WorkCycle.DAILY,
    comment: '工作周期: 1-日结,2-周结,3-月结,4-季节工,5-长期工'
  })
  workCycle: WorkCycle;

  @Column({ name: 'work_content', type: 'text', nullable: true, comment: '工作内容' })
  workContent: string;

  @Column({ name: 'work_hours', length: 50, nullable: true, comment: '工作时间，如：08:00-17:00' })
  workHours: string;

  @Column({ name: 'work_start_date', type: 'date', nullable: true, comment: '工作开始日期' })
  workStartDate: string;

  @Column({ name: 'work_end_date', type: 'date', nullable: true, comment: '工作结束日期' })
  workEndDate: string;

  // ========== 薪资信息 ==========
  @Column({
    name: 'pay_type',
    type: 'tinyint',
    default: PayType.FIXED,
    comment: '1:固定, 2:时薪, 3:计件'
  })
  payType: PayType;

  @Column({
    name: 'unit_price',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    comment: '单价（计件或时薪时使用）'
  })
  unitPrice: number;

  @Column({
    name: 'salary_amount',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    comment: '固定工资金额'
  })
  salaryAmount: number;

  @Column({
    name: 'hourly_rate',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    comment: '时薪'
  })
  hourlyRate: number;

  @Column({
    type: 'int',
    default: 0,
    nullable: true,
    comment: '目标数量（计件用）'
  })
  targetCount: number;

  // ========== 招聘要求 ==========
  @Column({ type: 'text', nullable: true, comment: '招聘要求' })
  requirements: string;

  @Column({ name: 'min_age', type: 'tinyint', nullable: true, comment: '最小年龄' })
  minAge: number;

  @Column({ name: 'max_age', type: 'tinyint', nullable: true, comment: '最大年龄' })
  maxAge: number;

  @Column({ name: 'experience_required', type: 'text', nullable: true, comment: '经验要求' })
  experienceRequired: string;

  @Column({ name: 'physical_requirement', type: 'text', nullable: true, comment: '体力要求' })
  physicalRequirement: string;

  // ========== 福利保障 ==========
  @Column({ name: 'benefits', type: 'text', nullable: true, comment: '福利保障描述' })
  benefits: string;

  @Column({
    name: 'has_accommodation',
    type: 'boolean',
    default: false,
    comment: '是否提供住宿'
  })
  hasAccommodation: boolean;

  @Column({
    name: 'has_meals',
    type: 'boolean',
    default: false,
    comment: '是否提供餐食'
  })
  hasMeals: boolean;

  @Column({
    name: 'has_transportation',
    type: 'boolean',
    default: false,
    comment: '是否有交通补贴'
  })
  hasTransportation: boolean;

  @Column({
    name: 'transportation_subsidy',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    comment: '交通补贴金额'
  })
  transportationSubsidy: number;

  // ========== 多媒体展示 ==========
  @Column({
    name: 'workplace_images',
    type: 'json',
    nullable: true,
    comment: '工作场景图片URL数组'
  })
  workplaceImages: string[];

  @Column({
    name: 'video_url',
    length: 500,
    nullable: true,
    comment: '工作场景视频URL'
  })
  videoUrl: string;

  // ========== 有效期管理 ==========
  @Column({
    name: 'valid_until',
    type: 'datetime',
    nullable: true,
    comment: '有效期至'
  })
  validUntil: Date;

  @Column({
    name: 'is_active',
    type: 'boolean',
    default: true,
    comment: '是否有效'
  })
  isActive: boolean;

  @Column({
    name: 'auto_renew',
    type: 'boolean',
    default: false,
    comment: '是否自动续期'
  })
  autoRenew: boolean;

  @Column({
    name: 'renewal_days',
    type: 'int',
    default: 7,
    comment: '续期天数'
  })
  renewalDays: number;

  @Index()
  @Column({
    type: 'tinyint',
    default: JobStatus.RECRUITING,
    comment: '状态：0-已下架，1-招聘中，2-已招满，3-已过期'
  })
  status: JobStatus;

  // ========== 统计信息 ==========
  @Column({
    name: 'applicant_count',
    type: 'int',
    default: 0,
    comment: '已申请人数'
  })
  applicantCount: number;

  @Column({
    name: 'view_count',
    type: 'int',
    default: 0,
    comment: '查看次数'
  })
  viewCount: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}