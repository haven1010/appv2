/**
 * Layer: Backend Service
 * Responsibility: Implements the Base Cooperation application service for the Base module, including business rules, side effects, and persistence coordination.
 * Notes: Keep comments focused on intent, invariants, side effects, and cross-module contracts.
 */
import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseCooperation, CooperationStatus } from '../entities/base-cooperation.entity';
import { BaseInfo } from '../entities/base-info.entity';
import { SysUser, UserRole } from '../../user/entities/sys-user.entity';
import { OperationLogService, OperationLogContext } from '../../common/services/operation-log.service';
import { OperationType, ResourceType } from '../../common/entities/operation-log.entity';

@Injectable()
export class BaseCooperationService {
  private readonly logger = new Logger(BaseCooperationService.name);

  constructor(
    @InjectRepository(BaseCooperation)
    private cooperationRepo: Repository<BaseCooperation>,
    @InjectRepository(BaseInfo)
    private baseRepo: Repository<BaseInfo>,
    @InjectRepository(SysUser)
    private userRepo: Repository<SysUser>,
    private operationLogService: OperationLogService,
    private dataSource: DataSource,
  ) {}

  private rethrowDuplicatePendingCooperation(error: any): never {
    if (error?.code === 'ER_DUP_ENTRY') {
      throw new BadRequestException('您已提交过合作申请，请等待审核');
    }
    throw error;
  }

  async create(applicantId: number, baseId: number, requirement: string, context?: OperationLogContext): Promise<BaseCooperation> {
    // 检查申请人权限（必须是区域管理员或超级管理员）
    const applicant = await this.userRepo.findOne({ where: { id: applicantId } });
    if (!applicant) {
      throw new NotFoundException('申请人不存在');
    }

    if (applicant.roleKey !== UserRole.REGION_ADMIN && applicant.roleKey !== UserRole.SUPER_ADMIN) {
      throw new BadRequestException('只有区域管理员或超级管理员可以申请合作');
    }

    // 检查基地是否存在
    const base = await this.baseRepo.findOne({ where: { id: baseId } });
    if (!base) {
      throw new NotFoundException('基地不存在');
    }

    // 检查是否已有待处理的申请
    const existing = await this.cooperationRepo.findOne({
      where: { applicantId, baseId, status: CooperationStatus.PENDING },
    });

    if (existing) {
      throw new BadRequestException('您已提交过合作申请，请等待审核');
    }

    const cooperation = this.cooperationRepo.create({
      applicantId,
      baseId,
      requirement,
      status: CooperationStatus.PENDING,
    });

    let saved: BaseCooperation;
    try {
      saved = await this.cooperationRepo.save(cooperation);
    } catch (error) {
      this.rethrowDuplicatePendingCooperation(error);
    }
    await this.operationLogService.logWithContext({
      operationType: OperationType.CREATE,
      resourceType: ResourceType.BASE,
      resourceId: saved.baseId,
      userId: applicantId,
      request: context?.request,
      description: `提交基地合作申请: cooperationId=${saved.id}, baseId=${saved.baseId}`,
      afterData: {
        cooperationId: saved.id,
        applicantId: saved.applicantId,
        status: saved.status,
      },
    });
    return saved;
  }

  async review(
    cooperationId: number,
    status: CooperationStatus,
    reviewedBy: number,
    rejectReason?: string,
    context?: OperationLogContext,
  ): Promise<BaseCooperation> {
    const { saved, beforeStatus } = await this.dataSource.transaction(async (manager) => {
      const cooperation = await manager.findOne(BaseCooperation, {
        where: { id: cooperationId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!cooperation) {
        throw new NotFoundException('合作申请不存在');
      }
      if (cooperation.status !== CooperationStatus.PENDING) {
        throw new BadRequestException('该合作申请已被处理，请刷新后重试');
      }

      const previousStatus = cooperation.status;
      cooperation.status = status;
      cooperation.reviewedBy = reviewedBy;
      cooperation.reviewedAt = new Date();
      if (status === CooperationStatus.REJECTED && rejectReason) {
        cooperation.rejectReason = rejectReason;
      }

      const next = await manager.save(BaseCooperation, cooperation);
      return { saved: next, beforeStatus: previousStatus };
    });
    await this.operationLogService.logWithContext({
      operationType: OperationType.AUDIT,
      resourceType: ResourceType.BASE,
      resourceId: saved.baseId,
      userId: reviewedBy,
      request: context?.request,
      description: `审核基地合作申请: cooperationId=${saved.id}, ${beforeStatus} -> ${saved.status}`,
      beforeData: {
        cooperationId: saved.id,
        status: beforeStatus,
      },
      afterData: {
        cooperationId: saved.id,
        status: saved.status,
        rejectReason: saved.rejectReason,
      },
    });
    return saved;
  }

  async getCooperationsByBase(baseId: number): Promise<BaseCooperation[]> {
    return this.cooperationRepo.find({
      where: { baseId },
      relations: ['applicant', 'base'],
      order: { createdAt: 'DESC' },
    });
  }

  async getCooperationsByApplicant(applicantId: number): Promise<BaseCooperation[]> {
    return this.cooperationRepo.find({
      where: { applicantId },
      relations: ['base'],
      order: { createdAt: 'DESC' },
    });
  }
}
