import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JobApplication, ApplicationStatus } from '../entities/job-application.entity';
import { RecruitmentJob } from '../entities/recruitment-job.entity';
import { SysUser } from '../../user/entities/sys-user.entity';

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
  ) {}

  async create(userId: number, jobId: number, baseId: number, note?: string): Promise<JobApplication> {
    // 检查岗位是否存在
    // 【修复】baseId 以岗位表为准；如果客户端传了 baseId，则校验一致性
    const job = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!job) {
      throw new NotFoundException('岗位不存在');
    }
    if (baseId != null && job.baseId !== baseId) {
      throw new BadRequestException('岗位与基地不匹配');
    }
    if (!job.isActive) {
      throw new BadRequestException('岗位已停止招聘');
    }

    const effectiveBaseId = job.baseId;

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

    return this.applicationRepo.save(application);
  }

  async review(
    applicationId: number,
    status: ApplicationStatus,
    reviewedBy: number,
    rejectReason?: string,
  ): Promise<JobApplication> {
    const application = await this.applicationRepo.findOne({ where: { id: applicationId } });
    if (!application) {
      throw new NotFoundException('申请记录不存在');
    }

    application.status = status;
    application.reviewedBy = reviewedBy;
    application.reviewedAt = new Date();
    if (status === ApplicationStatus.REJECTED && rejectReason) {
      application.rejectReason = rejectReason;
    }

    return this.applicationRepo.save(application);
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
}
