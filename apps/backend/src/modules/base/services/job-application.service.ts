/**
 * Layer: Backend Service
 * Responsibility: Implements the Job Application application service for the Base module, including business rules, side effects, and persistence coordination.
 * Notes: Keep comments focused on intent, invariants, side effects, and cross-module contracts.
 */
import { Injectable, NotFoundException, BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { JobApplication, ApplicationStatus } from '../entities/job-application.entity';
import { RecruitmentJob, JobAuditStatus } from '../entities/recruitment-job.entity';
import { SysUser, UserRole } from '../../user/entities/sys-user.entity';
import { DailySignup, SignupStatus } from '../../attendance/entities/daily-signup.entity';
import { OperationLogService, OperationLogContext } from '../../common/services/operation-log.service';
import { OperationType, ResourceType } from '../../common/entities/operation-log.entity';
import { BaseScopeService } from './base-scope.service';

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
    private baseScopeService: BaseScopeService,
    private operationLogService: OperationLogService,
    private dataSource: DataSource,
  ) {}

  private rethrowDuplicatePendingApplication(error: any): never {
    if (error?.code === 'ER_DUP_ENTRY') {
      throw new ConflictException('您已申请过该岗位，请勿重复申请');
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

  private normalizeDateTimeInput(value: string | Date): Date {
    if (value instanceof Date) {
      if (Number.isNaN(value.getTime())) {
        throw new BadRequestException('结束务工时间格式不正确');
      }
      return value;
    }

    const text = String(value || '').trim();
    if (!text) {
      throw new BadRequestException('结束务工时间不能为空');
    }

    const normalized = text.includes('T') ? text : text.replace(' ', 'T');
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('结束务工时间格式不正确');
    }
    return date;
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
    if (Number(job.auditStatus) !== Number(JobAuditStatus.APPROVED)) {
      throw new BadRequestException('岗位审核通过后才能报名');
    }

    const saved = await this.dataSource.transaction(async (manager) => {
      // Serialize same-user apply requests to prevent race duplicates even if DB unique key is missing.
      const lockedUser = await manager.findOne(SysUser, {
        where: { id: userId, isDeleted: false },
        lock: { mode: 'pessimistic_write' },
      });

      if (!lockedUser) {
        throw new NotFoundException('用户不存在');
      }

      const lockedExisting = await manager.findOne(JobApplication, {
        where: {
          userId,
          jobId,
          baseId: effectiveBaseId,
          status: ApplicationStatus.PENDING,
        },
        lock: { mode: 'pessimistic_write' },
      });

      if (lockedExisting) {
        this.logger.warn(
          `[重复申请拦截] userId=${userId}, baseId=${effectiveBaseId}, jobId=${jobId}, existingApplicationId=${lockedExisting.id}`,
        );
        throw new ConflictException('您已申请过该岗位，请勿重复申请');
      }

      const applicationRepo = manager.getRepository(JobApplication);
      const application = applicationRepo.create({
        userId,
        jobId,
        baseId: effectiveBaseId,
        status: ApplicationStatus.PENDING,
        note,
      });

      try {
        return await applicationRepo.save(application);
      } catch (error) {
        this.rethrowDuplicatePendingApplication(error);
      }
    });
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
    reviewer: { id: number; role?: string; roleKey?: UserRole },
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

      await this.baseScopeService.assertCanSuperviseBase(reviewer, application.baseId);

      const previousStatus = application.status;
      application.status = status;
      application.reviewedBy = reviewer.id;
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
      userId: reviewer.id,
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
    const applications = await this.applicationRepo.find({
      where,
      relations: ['user', 'job', 'base'],
      order: { createdAt: 'DESC' },
    });

    if (!applications.length) {
      return [];
    }

    const userIds = Array.from(new Set(applications.map((item) => Number(item.userId)).filter((id) => id > 0)));
    if (!userIds.length) {
      return applications;
    }

    const firstCheckinRows = await this.dataSource
      .getRepository(DailySignup)
      .createQueryBuilder('signup')
      .select('signup.userId', 'userId')
      .addSelect('MIN(signup.checkinTime)', 'workStartTime')
      .where('signup.baseId = :baseId', { baseId })
      .andWhere('signup.userId IN (:...userIds)', { userIds })
      .andWhere('signup.status = :checkedIn', { checkedIn: SignupStatus.CHECKED_IN })
      .andWhere('signup.checkinTime IS NOT NULL')
      .groupBy('signup.userId')
      .getRawMany();

    const workStartMap: Record<string, string> = {};
    firstCheckinRows.forEach((row: any) => {
      const userId = Number(row?.userId);
      if (!userId) return;
      workStartMap[String(userId)] = row?.workStartTime ? String(row.workStartTime) : '';
    });

    return applications.map((item) => {
      const plain = item as JobApplication & { workStartTime?: string | null };
      plain.workStartTime = workStartMap[String(item.userId)] || null;
      return plain;
    });
  }

  async markWorkerEndWork(
    baseId: number,
    userId: number,
    endWorkTime: string | Date,
    operatorId: number,
    context?: OperationLogContext,
  ) {
    const safeBaseId = Number(baseId);
    const safeUserId = Number(userId);
    if (!safeBaseId || !safeUserId) {
      throw new BadRequestException('参数不正确');
    }

    const endTime = this.normalizeDateTimeInput(endWorkTime);

    const result = await this.dataSource.transaction(async (manager) => {
      const targetRows = await manager.find(JobApplication, {
        where: {
          baseId: safeBaseId,
          userId: safeUserId,
          status: In([ApplicationStatus.PENDING, ApplicationStatus.APPROVED]),
        },
        lock: { mode: 'pessimistic_write' },
      });

      if (!targetRows.length) {
        throw new NotFoundException('未找到可结束务工的人员记录');
      }

      const firstSignup = await manager.findOne(DailySignup, {
        where: {
          baseId: safeBaseId,
          userId: safeUserId,
          status: SignupStatus.CHECKED_IN,
        },
        order: { checkinTime: 'ASC' },
      });

      if (firstSignup?.checkinTime && endTime.getTime() < new Date(firstSignup.checkinTime).getTime()) {
        throw new BadRequestException('结束务工时间不能早于首次签到时间');
      }

      const updateRes = await manager
        .createQueryBuilder()
        .update(JobApplication)
        .set({
          workEndTime: endTime,
          workEndBy: operatorId,
          workEndRecordedAt: new Date(),
        })
        .where('base_id = :baseId', { baseId: safeBaseId })
        .andWhere('user_id = :userId', { userId: safeUserId })
        .andWhere('status IN (:...statuses)', {
          statuses: [ApplicationStatus.PENDING, ApplicationStatus.APPROVED],
        })
        .execute();

      return {
        affectedApplications: Number(updateRes.affected || 0),
      };
    });

    await this.operationLogService.logWithContext({
      operationType: OperationType.UPDATE,
      resourceType: ResourceType.JOB,
      resourceId: safeBaseId,
      userId: operatorId,
      request: context?.request,
      description: `结束务工: baseId=${safeBaseId}, userId=${safeUserId}`,
      afterData: {
        baseId: safeBaseId,
        userId: safeUserId,
        endWorkTime: endTime.toISOString(),
        affectedApplications: result.affectedApplications,
      },
    });

    return {
      baseId: safeBaseId,
      userId: safeUserId,
      endWorkTime: endTime.toISOString(),
      affectedApplications: result.affectedApplications,
    };
  }

  async markAllWorkersEndWork(
    baseId: number,
    endWorkTime: string | Date,
    operatorId: number,
    context?: OperationLogContext,
  ) {
    const safeBaseId = Number(baseId);
    if (!safeBaseId) {
      throw new BadRequestException('参数不正确');
    }

    const endTime = this.normalizeDateTimeInput(endWorkTime);

    const targetUsers = await this.applicationRepo
      .createQueryBuilder('application')
      .select('DISTINCT application.userId', 'userId')
      .where('application.baseId = :baseId', { baseId: safeBaseId })
      .andWhere('application.status IN (:...statuses)', {
        statuses: [ApplicationStatus.PENDING, ApplicationStatus.APPROVED],
      })
      .getRawMany();

    const userIds = targetUsers
      .map((item: any) => Number(item?.userId))
      .filter((id) => Number.isInteger(id) && id > 0);

    if (!userIds.length) {
      return {
        baseId: safeBaseId,
        endWorkTime: endTime.toISOString(),
        affectedUsers: 0,
        affectedApplications: 0,
      };
    }

    const updateRes = await this.applicationRepo
      .createQueryBuilder()
      .update(JobApplication)
      .set({
        workEndTime: endTime,
        workEndBy: operatorId,
        workEndRecordedAt: new Date(),
      })
      .where('base_id = :baseId', { baseId: safeBaseId })
      .andWhere('user_id IN (:...userIds)', { userIds })
      .andWhere('status IN (:...statuses)', {
        statuses: [ApplicationStatus.PENDING, ApplicationStatus.APPROVED],
      })
      .execute();

    await this.operationLogService.logWithContext({
      operationType: OperationType.UPDATE,
      resourceType: ResourceType.JOB,
      resourceId: safeBaseId,
      userId: operatorId,
      request: context?.request,
      description: `批量结束务工: baseId=${safeBaseId}`,
      afterData: {
        baseId: safeBaseId,
        endWorkTime: endTime.toISOString(),
        affectedUsers: userIds.length,
        affectedApplications: Number(updateRes.affected || 0),
      },
    });

    return {
      baseId: safeBaseId,
      endWorkTime: endTime.toISOString(),
      affectedUsers: userIds.length,
      affectedApplications: Number(updateRes.affected || 0),
    };
  }
}
