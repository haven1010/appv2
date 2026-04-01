/**
 * Layer: Backend Service
 * Responsibility: Implements the Job Application application service for the Base module, including business rules, side effects, and persistence coordination.
 * Notes: Keep comments focused on intent, invariants, side effects, and cross-module contracts.
 */
import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { JobApplication, ApplicationStatus } from '../entities/job-application.entity';
import { RecruitmentJob } from '../entities/recruitment-job.entity';
import { SysUser } from '../../user/entities/sys-user.entity';
import { OperationLogService, OperationLogContext } from '../../common/services/operation-log.service';
import { OperationType, ResourceType } from '../../common/entities/operation-log.entity';

@Injectable()
export class JobApplicationService {
  private readonly logger = new Logger(JobApplicationService.name);

  constructor(
    @InjectRepository(JobApplication)
    private applicationRepo: Repository<JobApplication>,
    @InjectRepository(RecruitmentJob)
    private jobRepo: Repository<RecruitmentJob>,
    @InjectRepository(SysUser)
    private userRepo: Repository<SysUser>,
    private operationLogService: OperationLogService,
    private dataSource: DataSource,
  ) {}

  private rethrowDuplicatePendingApplication(error: any): never {
    if (error?.code === 'ER_DUP_ENTRY') {
      throw new BadRequestException('您已申请过该岗位，请勿重复申请');
    }
    throw error;
  }

  private getProgressStatuses(): ApplicationStatus[] {
    return [ApplicationStatus.PENDING, ApplicationStatus.APPROVED];
  }

  private async refreshApplicantCount(jobId: number): Promise<number> {
    const targetJobId = Number(jobId);
    if (!targetJobId) return 0;

    const applicantCount = await this.applicationRepo.count({
      where: {
        jobId: targetJobId,
        status: In(this.getProgressStatuses()),
      },
    });

    await this.jobRepo.update({ id: targetJobId }, { applicantCount });
    return applicantCount;
  }

  async getApplicantCountsByJobIds(jobIds: number[]): Promise<Record<number, number>> {
    const normalizedIds = (Array.isArray(jobIds) ? jobIds : [])
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id) && id > 0);

    if (!normalizedIds.length) return {};

    const rows = await this.applicationRepo
      .createQueryBuilder('application')
      .select('application.jobId', 'jobId')
      .addSelect('COUNT(*)', 'applicantCount')
      .where('application.jobId IN (:...jobIds)', { jobIds: normalizedIds })
      .andWhere('application.status IN (:...statuses)', { statuses: this.getProgressStatuses() })
      .groupBy('application.jobId')
      .getRawMany();

    const result: Record<number, number> = {};
    rows.forEach((row: any) => {
      const key = Number(row?.jobId);
      if (!Number.isInteger(key) || key <= 0) return;
      result[key] = Number(row?.applicantCount) || 0;
    });
    return result;
  }

  async create(userId: number, jobId: number, baseId: number, note?: string, context?: OperationLogContext): Promise<JobApplication> {
    // 检查岗位是否存在
    // 【修复】baseId 以岗位表为准；如果客户端传了 baseId，则校验一致性
    const job = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!job) {
      throw new NotFoundException('岗位不存在');
    }
    const effectiveBaseId = Number(job.baseId);

    if (baseId != null && effectiveBaseId !== Number(baseId)) {
      throw new BadRequestException('岗位与基地不匹配');
    }
    if (!job.isActive) {
      throw new BadRequestException('岗位已停止招聘');
    }

    // 检查是否已申请
    const existing = await this.applicationRepo.findOne({
      // 【修复】判重必须带上 baseId，避免出现跨基地误判（例如前端/数据问题导致 jobId 冲突或错传）
      where: { userId, jobId, baseId: effectiveBaseId, status: ApplicationStatus.PENDING },
    });

    if (existing) {
      this.logger.warn(
        `[重复申请拦截] userId=${userId}, baseId=${effectiveBaseId}, jobId=${jobId}, existingApplicationId=${existing.id}`,
      );
      throw new BadRequestException('您已申请过该岗位，请勿重复申请');
    }

    const application = this.applicationRepo.create({
      userId,
      jobId,
      baseId: effectiveBaseId,
      status: ApplicationStatus.PENDING,
      note,
    });

    let saved: JobApplication;
    try {
      saved = await this.applicationRepo.save(application);
    } catch (error) {
      this.rethrowDuplicatePendingApplication(error);
    }
    const applicantCount = await this.refreshApplicantCount(saved.jobId).catch((error) => {
      this.logger.warn(`[刷新报名统计失败] jobId=${saved.jobId}, reason=${error?.message || error}`);
      return null;
    });
    await this.operationLogService.logWithContext({
      operationType: OperationType.CREATE,
      resourceType: ResourceType.JOB,
      resourceId: saved.jobId,
      userId,
      request: context?.request,
      description: `提交岗位申请: applicationId=${saved.id}, jobId=${saved.jobId}`,
      afterData: {
        applicationId: saved.id,
        baseId: saved.baseId,
        status: saved.status,
        applicantCount: applicantCount === null ? undefined : applicantCount,
      },
    });
    return saved;
  }

  async review(
    applicationId: number,
    status: ApplicationStatus,
    reviewedBy: number,
    rejectReason?: string,
    context?: OperationLogContext,
  ): Promise<JobApplication> {
    const { saved, beforeStatus } = await this.dataSource.transaction(async (manager) => {
      const application = await manager.findOne(JobApplication, {
        where: { id: applicationId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!application) {
        throw new NotFoundException('申请记录不存在');
      }
      if (application.status !== ApplicationStatus.PENDING) {
        throw new BadRequestException('该申请已被处理，请刷新后重试');
      }

      const previousStatus = application.status;
      application.status = status;
      application.reviewedBy = reviewedBy;
      application.reviewedAt = new Date();
      if (status === ApplicationStatus.REJECTED && rejectReason) {
        application.rejectReason = rejectReason;
      }

      const next = await manager.save(JobApplication, application);
      return { saved: next, beforeStatus: previousStatus };
    });
    const applicantCount = await this.refreshApplicantCount(saved.jobId).catch((error) => {
      this.logger.warn(`[刷新报名统计失败] jobId=${saved.jobId}, reason=${error?.message || error}`);
      return null;
    });
    await this.operationLogService.logWithContext({
      operationType: OperationType.AUDIT,
      resourceType: ResourceType.JOB,
      resourceId: saved.jobId,
      userId: reviewedBy,
      request: context?.request,
      description: `审核岗位申请: applicationId=${saved.id}, ${beforeStatus} -> ${saved.status}`,
      beforeData: {
        applicationId: saved.id,
        status: beforeStatus,
      },
      afterData: {
        applicationId: saved.id,
        status: saved.status,
        rejectReason: saved.rejectReason,
        applicantCount: applicantCount === null ? undefined : applicantCount,
      },
    });
    return saved;
  }

  async getApplicationsByJob(jobId: number): Promise<JobApplication[]> {
    return this.applicationRepo.find({
      where: { jobId },
      relations: ['user', 'job', 'base'],
      order: { createdAt: 'DESC' },
    });
  }

  async getApplicationsByUser(userId: number): Promise<JobApplication[]> {
    return this.applicationRepo.find({
      where: { userId },
      relations: ['job', 'base'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * 获取某基地的所有岗位申请（现场管理员查看本基地人员）
   * 可按状态过滤
   */
  async getApplicationsByBase(baseId: number, status?: ApplicationStatus): Promise<JobApplication[]> {
    const where: any = { baseId };
    if (status !== undefined && status !== null) {
      where.status = status;
    }
    return this.applicationRepo.find({
      where,
      relations: ['user', 'job', 'base'],
      order: { createdAt: 'DESC' },
    });
  }
}
