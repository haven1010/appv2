import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseCooperation, CooperationStatus } from '../entities/base-cooperation.entity';
import { BaseInfo } from '../entities/base-info.entity';
import { SysUser, UserRole } from '../../user/entities/sys-user.entity';

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
  ) {}

  async create(applicantId: number, baseId: number, requirement: string): Promise<BaseCooperation> {
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

    return this.cooperationRepo.save(cooperation);
  }

  async review(
    cooperationId: number,
    status: CooperationStatus,
    reviewedBy: number,
    rejectReason?: string,
  ): Promise<BaseCooperation> {
    const cooperation = await this.cooperationRepo.findOne({ where: { id: cooperationId } });
    if (!cooperation) {
      throw new NotFoundException('合作申请不存在');
    }

    cooperation.status = status;
    cooperation.reviewedBy = reviewedBy;
    cooperation.reviewedAt = new Date();
    if (status === CooperationStatus.REJECTED && rejectReason) {
      cooperation.rejectReason = rejectReason;
    }

    return this.cooperationRepo.save(cooperation);
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
