import { Injectable, NotFoundException, Logger, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseInfo, AuditStatus } from './entities/base-info.entity';
import { RecruitmentJob, PayType, JobStatus } from './entities/recruitment-job.entity';
import { CreateBaseDto } from './dto/create-base.dto';
import { CreateJobDto } from './dto/create-job.dto';
import { JobApplicationService } from './services/job-application.service';
import { BaseCooperationService } from './services/base-cooperation.service';
import { ApplicationStatus } from './entities/job-application.entity';
import { CooperationStatus } from './entities/base-cooperation.entity';
import { OperationLogService } from '../common/services/operation-log.service';
import { OperationType, ResourceType } from '../common/entities/operation-log.entity';

@Injectable()
export class BaseService {
  private readonly logger = new Logger(BaseService.name);

  constructor(
    @InjectRepository(BaseInfo)
    private baseRepo: Repository<BaseInfo>,
    @InjectRepository(RecruitmentJob)
    private jobRepo: Repository<RecruitmentJob>,
    private jobApplicationService: JobApplicationService,
    private baseCooperationService: BaseCooperationService,
    private operationLogService: OperationLogService,
  ) { }

  // ========== 基地相关方法 ==========

  async create(createBaseDto: CreateBaseDto, ownerId: number): Promise<BaseInfo> {
    this.logger.log(`[创建基地] 开始: ${createBaseDto.baseName}, 所有者: ${ownerId}`);

    // 1. 清理和验证名称
    const baseName = createBaseDto.baseName.trim();
    if (!baseName) {
      throw new BadRequestException('基地名称不能为空');
    }

    // 2. 检查名称是否已存在（包括软删除）
    const existing = await this.baseRepo.findOne({
      where: { baseName },
      withDeleted: true
    });

    if (existing) {
      if (!existing.isDeleted) {
        this.logger.error(`[创建基地] 失败: 基地名称 "${baseName}" 已存在 (ID: ${existing.id})`);
        throw new ConflictException(`基地名称 "${baseName}" 已存在`);
      } else {
        this.logger.warn(`[创建基地] 发现已删除的同名基地: "${baseName}" (ID: ${existing.id})`);
        throw new ConflictException(`基地名称 "${baseName}" 已被使用过，请使用新名称`);
      }
    }

    this.logger.log(`[创建基地] 名称验证通过: "${baseName}"`);

    // 3. 创建基地
    const base = this.baseRepo.create({
      ...createBaseDto,
      baseName,
      ownerId,
      auditStatus: AuditStatus.PENDING,
    });

    try {
      const savedBase = await this.baseRepo.save(base);
      this.logger.log(`[创建基地] 成功: ID=${savedBase.id}, 名称=${savedBase.baseName}`);
      return savedBase;
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) {
        this.logger.error(`[创建基地] 数据库唯一约束错误: ${baseName}`);
        throw new ConflictException(`基地名称 "${baseName}" 已存在`);
      }
      this.logger.error(`[创建基地] 保存失败: ${error.message}`);
      throw error;
    }
  }

  async audit(id: number, status: any): Promise<BaseInfo> {
    this.logger.log(`[审核基地] 开始: id=${id}, status=${status}`);

    const base = await this.baseRepo.findOne({ where: { id } });
    if (!base) {
      this.logger.error(`[审核基地] 失败: 基地不存在 id=${id}`);
      throw new NotFoundException('基地不存在');
    }

    const statusNum = Number(status);
    if (isNaN(statusNum) || ![0, 1, 2].includes(statusNum)) {
      this.logger.error(`[审核基地] 无效状态: ${status}`);
      throw new BadRequestException('审核状态必须是 0（待审核）, 1（通过）或 2（拒绝）');
    }

    const beforeStatus = base.auditStatus;
    base.auditStatus = statusNum;
    const result = await this.baseRepo.save(base);

    this.logger.log(`[审核基地] 完成: id=${id}, 新状态=${result.auditStatus}`);

    // 记录审核操作日志
    this.operationLogService.log(
      OperationType.AUDIT,
      ResourceType.BASE,
      id,
      0, // 没有传入操作者，暂用0
      `基地审核: ${base.baseName}, ${beforeStatus} -> ${statusNum}`,
      { auditStatus: beforeStatus },
      { auditStatus: statusNum },
    ).catch(() => {});

    return result;
  }

  async findAll(query: any): Promise<BaseInfo[]> {
    this.logger.log(`[查询基地列表] 参数: ${JSON.stringify(query)}`);

    const qb = this.baseRepo.createQueryBuilder('base');

    if (query.regionCode) {
      qb.andWhere('base.regionCode = :region', { region: query.regionCode });
    }
    if (query.category) {
      qb.andWhere('base.category = :category', { category: query.category });
    }
    if (query.ownerId) {
      qb.andWhere('base.ownerId = :ownerId', { ownerId: query.ownerId });
    }

    if (!query.showAll) {
      qb.andWhere('base.auditStatus = :status', { status: AuditStatus.APPROVED });
    }

    qb.andWhere('base.isDeleted = :isDeleted', { isDeleted: false });
    qb.orderBy('base.createdAt', 'DESC');

    const results = await qb.getMany();
    this.logger.log(`[查询基地列表] 结果: ${results.length} 条`);
    return results;
  }

  async findOne(id: number): Promise<BaseInfo> {
    this.logger.log(`[查询基地详情] id=${id}`);

    const base = await this.baseRepo.findOne({
      where: { id },
      relations: ['jobs']
    });

    if (!base) {
      this.logger.warn(`[查询基地详情] 不存在: id=${id}`);
      throw new NotFoundException(`基地 ID=${id} 不存在`);
    }

    this.logger.log(`[查询基地详情] 成功: id=${base.id}, 名称=${base.baseName}`);
    return base;
  }

  // ========== 招聘岗位相关方法 ==========

  async createJob(baseId: number, createJobDto: CreateJobDto, userId: number): Promise<RecruitmentJob> {
    this.logger.log(`[发布招聘] 开始: baseId=${baseId}, userId=${userId}`);

    const base = await this.baseRepo.findOne({ where: { id: baseId } });
    if (!base) {
      this.logger.error(`[发布招聘] 失败: 基地不存在 baseId=${baseId}`);
      throw new NotFoundException('基地不存在');
    }

    if (base.auditStatus !== AuditStatus.APPROVED) {
      this.logger.error(`[发布招聘] 失败: 基地未审核通过 auditStatus=${base.auditStatus}`);
      throw new ConflictException('基地未审核通过，无法发布招聘');
    }

    if (base.ownerId !== userId) {
      this.logger.warn(`[发布招聘] 警告: 用户 ${userId} 不是基地所有者 ${base.ownerId}`);
    }

    this.validateSalaryFields(createJobDto);

    const jobData: any = {
      ...createJobDto,
      baseId,
      isActive: true,
      status: JobStatus.RECRUITING,
      applicantCount: 0,
      viewCount: 0,
    };

    // 如果传入了validUntil字符串，转换为Date对象
    if (createJobDto.validUntil) {
      jobData.validUntil = new Date(createJobDto.validUntil);
    } else {
      // 默认有效期30天
      const now = new Date();
      now.setDate(now.getDate() + 30);
      jobData.validUntil = now;
    }

    this.cleanSalaryFields(jobData, createJobDto.payType);

    // 【修复点】: 显式断言为 RecruitmentJob，避免因为 jobData 是 any 导致的 create 重载歧义
    const job = this.jobRepo.create(jobData) as unknown as RecruitmentJob;

    try {
      const savedJob = await this.jobRepo.save(job);
      this.logger.log(`[发布招聘] 成功: jobId=${savedJob.id}, 岗位=${savedJob.jobTitle}`);
      return savedJob;
    } catch (error) {
      this.logger.error(`[发布招聘] 保存失败: ${error.message}`);
      throw error;
    }
  }

  private validateSalaryFields(dto: CreateJobDto): void {
    switch (dto.payType) {
      case PayType.FIXED:
        if (!dto.salaryAmount || dto.salaryAmount <= 0) {
          throw new BadRequestException('固定工资必须填写薪资金额，且金额必须大于0');
        }
        break;
      case PayType.PIECEWORK:
        if (!dto.unitPrice || dto.unitPrice <= 0) {
          throw new BadRequestException('计件工资必须填写单价，且单价必须大于0');
        }
        if (!dto.targetCount || dto.targetCount <= 0) {
          throw new BadRequestException('计件工资必须填写目标数量，且数量必须大于0');
        }
        break;
      case PayType.HOURLY:
        if (!dto.hourlyRate || dto.hourlyRate <= 0) {
          throw new BadRequestException('时薪必须填写时薪金额，且金额必须大于0');
        }
        break;
      default:
        throw new BadRequestException(`无效的薪资类型: ${dto.payType}`);
    }
  }

  private cleanSalaryFields(jobData: any, payType: PayType): void {
    switch (payType) {
      case PayType.FIXED:
        jobData.unitPrice = null;
        jobData.hourlyRate = null;
        jobData.targetCount = null;
        break;
      case PayType.HOURLY:
        jobData.salaryAmount = null;
        jobData.unitPrice = null;
        jobData.targetCount = null;
        break;
      case PayType.PIECEWORK:
        jobData.salaryAmount = null;
        jobData.hourlyRate = null;
        break;
    }
  }

  async getJobsByBase(baseId: number, query: any = {}): Promise<RecruitmentJob[]> {
    this.logger.log(`[查询基地岗位] baseId=${baseId}, query=${JSON.stringify(query)}`);

    const qb = this.jobRepo.createQueryBuilder('job')
      .where('job.baseId = :baseId', { baseId })
      .andWhere('job.isActive = :isActive', { isActive: true });

    if (query.status !== undefined) {
      qb.andWhere('job.status = :status', { status: query.status });
    }
    if (query.payType !== undefined) {
      qb.andWhere('job.payType = :payType', { payType: query.payType });
    }
    if (query.onlyValid === true) {
      const now = new Date();
      qb.andWhere('job.validUntil > :now', { now });
    }

    qb.orderBy('job.createdAt', 'DESC');

    const results = await qb.getMany();
    this.logger.log(`[查询基地岗位] 结果: ${results.length} 条`);
    return results;
  }

  async getJobById(jobId: number): Promise<RecruitmentJob> {
    this.logger.log(`[查询岗位详情] jobId=${jobId}`);

    const job = await this.jobRepo.findOne({
      where: { id: jobId },
      relations: ['base']
    });

    if (!job) {
      this.logger.warn(`[查询岗位详情] 不存在: jobId=${jobId}`);
      throw new NotFoundException(`招聘岗位 ID=${jobId} 不存在`);
    }

    if (job.isActive) {
      job.viewCount += 1;
      await this.jobRepo.save(job);
    }

    this.logger.log(`[查询岗位详情] 成功: jobId=${job.id}, 岗位=${job.jobTitle}`);
    return job;
  }

  async updateJobStatus(jobId: number, status: JobStatus, userId: number): Promise<RecruitmentJob> {
    this.logger.log(`[更新岗位状态] jobId=${jobId}, status=${status}`);

    const job = await this.jobRepo.findOne({
      where: { id: jobId },
      relations: ['base']
    });

    if (!job) {
      throw new NotFoundException('招聘岗位不存在');
    }

    const base = job.base;
    if (base.ownerId !== userId) {
      throw new ConflictException('只有基地所有者可以修改招聘状态');
    }

    job.status = status;

    if (status === JobStatus.OFFLINE || status === JobStatus.FULL) {
      job.isActive = false;
    }

    const updatedJob = await this.jobRepo.save(job);
    this.logger.log(`[更新岗位状态] 成功: jobId=${jobId}, 新状态=${status}`);
    return updatedJob;
  }

  async renewJob(jobId: number, userId: number): Promise<RecruitmentJob> {
    this.logger.log(`[续期岗位] jobId=${jobId}`);

    const job = await this.jobRepo.findOne({
      where: { id: jobId },
      relations: ['base']
    });

    if (!job) {
      throw new NotFoundException('招聘岗位不存在');
    }

    const base = job.base;
    if (base.ownerId !== userId) {
      throw new ConflictException('只有基地所有者可以续期招聘');
    }

    const newValidUntil = new Date(job.validUntil);
    newValidUntil.setDate(newValidUntil.getDate() + job.renewalDays);

    job.validUntil = newValidUntil;
    job.isActive = true;
    job.status = JobStatus.RECRUITING;

    const renewedJob = await this.jobRepo.save(job);
    this.logger.log(`[续期岗位] 成功: jobId=${jobId}, 新有效期=${newValidUntil.toISOString()}`);
    return renewedJob;
  }

  async getBaseStatistics(baseId: number): Promise<any> {
    this.logger.log(`[获取基地统计] baseId=${baseId}`);

    const base = await this.baseRepo.findOne({ where: { id: baseId } });
    if (!base) {
      throw new NotFoundException('基地不存在');
    }

    const jobStats = await this.jobRepo
      .createQueryBuilder('job')
      .select([
        'COUNT(*) as totalJobs',
        'SUM(CASE WHEN job.isActive = true THEN 1 ELSE 0 END) as activeJobs',
        'SUM(CASE WHEN job.status = :recruiting THEN 1 ELSE 0 END) as recruitingJobs',
        'SUM(CASE WHEN job.status = :full THEN 1 ELSE 0 END) as fullJobs',
        'SUM(job.recruitCount) as totalRecruitCount',
        'SUM(job.applicantCount) as totalApplicantCount',
      ])
      .setParameters({
        recruiting: JobStatus.RECRUITING,
        full: JobStatus.FULL
      })
      .where('job.baseId = :baseId', { baseId })
      .getRawOne();

    return {
      baseId,
      baseName: base.baseName,
      auditStatus: base.auditStatus,
      statistics: {
        jobs: {
          total: Number(jobStats.totalJobs) || 0,
          active: Number(jobStats.activeJobs) || 0,
          recruiting: Number(jobStats.recruitingJobs) || 0,
          full: Number(jobStats.fullJobs) || 0,
        },
        recruitment: {
          target: Number(jobStats.totalRecruitCount) || 0,
          applied: Number(jobStats.totalApplicantCount) || 0,
          completionRate: jobStats.totalRecruitCount > 0
            ? (Number(jobStats.totalApplicantCount) / Number(jobStats.totalRecruitCount) * 100).toFixed(2) + '%'
            : '0%'
        }
      }
    };
  }

  async checkBaseNameAvailability(baseName: string): Promise<{ available: boolean; message: string }> {
    const name = baseName.trim();

    if (!name) {
      return { available: false, message: '基地名称不能为空' };
    }

    const existing = await this.baseRepo.findOne({
      where: { baseName: name },
      withDeleted: true
    });

    if (existing) {
      if (!existing.isDeleted) {
        return {
          available: false,
          message: `基地名称 "${name}" 已存在`
        };
      } else {
        return {
          available: false,
          message: `基地名称 "${name}" 已被使用过，请使用新名称`
        };
      }
    }

    return {
      available: true,
      message: `基地名称 "${name}" 可用`
    };
  }

  async getExpiringJobs(days: number = 3): Promise<RecruitmentJob[]> {
    const now = new Date();
    const warningDate = new Date(now);
    warningDate.setDate(now.getDate() + days);

    return this.jobRepo
      .createQueryBuilder('job')
      .innerJoinAndSelect('job.base', 'base')
      .where('job.isActive = :isActive', { isActive: true })
      .andWhere('job.validUntil BETWEEN :now AND :warningDate', {
        now,
        warningDate
      })
      .andWhere('job.status = :status', { status: JobStatus.RECRUITING })
      .orderBy('job.validUntil', 'ASC')
      .getMany();
  }

  async deactivateExpiredJobs(): Promise<{ deactivated: number }> {
    const now = new Date();
    const expiredDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const expiredJobs = await this.jobRepo.find({
      where: {
        isActive: true,
        validUntil: expiredDate,
        autoRenew: false,
      },
    });

    let deactivated = 0;
    for (const job of expiredJobs) {
      job.isActive = false;
      job.status = JobStatus.EXPIRED;
      await this.jobRepo.save(job);
      deactivated++;
      this.logger.log(`下架过期招聘: ${job.jobTitle} (ID: ${job.id})`);
    }

    return { deactivated };
  }

  async applyJob(userId: number, jobId: number, baseId: number, note?: string) {
    return this.jobApplicationService.create(userId, jobId, baseId, note);
  }

  async getJobApplications(jobId: number) {
    return this.jobApplicationService.getApplicationsByJob(jobId);
  }

  /** 当前用户的岗位申请列表（工人端「我的报名」） */
  async getApplicationsByUser(userId: number) {
    return this.jobApplicationService.getApplicationsByUser(userId);
  }

  async getApplicationsByBase(baseId: number, status?: number) {
    return this.jobApplicationService.getApplicationsByBase(baseId, status as ApplicationStatus);
  }

  async reviewApplication(applicationId: number, status: number, reviewedBy: number, rejectReason?: string) {
    return this.jobApplicationService.review(applicationId, status as ApplicationStatus, reviewedBy, rejectReason);
  }

  async createCooperation(applicantId: number, baseId: number, requirement: string) {
    return this.baseCooperationService.create(applicantId, baseId, requirement);
  }

  async reviewCooperation(cooperationId: number, status: number, reviewedBy: number, rejectReason?: string) {
    return this.baseCooperationService.review(cooperationId, status as CooperationStatus, reviewedBy, rejectReason);
  }

  async getBaseCooperations(baseId: number) {
    return this.baseCooperationService.getCooperationsByBase(baseId);
  }
}