/**
 * Layer: Backend Service
 * Responsibility: Implements the Salary application service for the Salary module, including business rules, side effects, and persistence coordination.
 * Notes: Keep comments focused on intent, invariants, side effects, and cross-module contracts.
 */
import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { LaborSalary, SalaryStatus } from './entities/labor-salary.entity';
import { DailySignup, SignupStatus } from '../attendance/entities/daily-signup.entity';
import { BaseInfo } from '../base/entities/base-info.entity';
import { SalaryCalculatorFactory } from './services/salary-calculator.strategy';
import { PayType } from '../base/entities/recruitment-job.entity';
import { UserRole, isSuperAdmin } from '../user/entities/sys-user.entity';
import { SysUser } from '../user/entities/sys-user.entity';
import { OperationLogService, OperationLogContext } from '../common/services/operation-log.service';
import { OperationType, ResourceType } from '../common/entities/operation-log.entity';

@Injectable()
/**
 * 薪资服务负责计薪草稿生成、工资列表查询、统计口径计算和工人确认流程。
 * 其核心职责是把签到记录和岗位计薪规则稳定地转换成可审核工资单。
 */
export class SalaryService {
  constructor(
    @InjectRepository(LaborSalary)
    private salaryRepo: Repository<LaborSalary>,
    @InjectRepository(DailySignup)
    private signupRepo: Repository<DailySignup>,
    @InjectRepository(BaseInfo)
    private baseRepo: Repository<BaseInfo>,
    @InjectRepository(SysUser)
    private userRepo: Repository<SysUser>,
    private operationLogService: OperationLogService,
    private dataSource: DataSource,
  ) {}

  private resolveUnitPriceSnapshot(job: { payType: PayType; unitPrice?: number; hourlyRate?: number; salaryAmount?: number }): number {
    switch (job.payType) {
      case PayType.FIXED:
        return Number(job.salaryAmount || 0);
      case PayType.HOURLY:
        return Number(job.hourlyRate || 0);
      case PayType.PIECEWORK:
        return Number(job.unitPrice || 0);
      default:
        throw new BadRequestException(`未知计薪类型: ${job.payType}`);
    }
  }

  /**
   * 基于签到记录和岗位计薪策略生成或更新工资草稿。
   * 该方法会覆盖同一报名记录已有的草稿，以保证重复计算结果可收敛。
   */
  async calculateAndDraft(signupId: number, input: { duration?: number; count?: number }, adminId: number, context?: OperationLogContext) {
    const { saved, isCreate, beforeSnapshot } = await this.dataSource.transaction(async (manager) => {
      const signup = await manager.findOne(DailySignup, {
        where: { id: signupId },
        relations: ['job'],
        lock: { mode: 'pessimistic_write' },
      });
      if (!signup) throw new BadRequestException('Signup record not found');
      if (signup.status !== SignupStatus.CHECKED_IN) throw new BadRequestException('Worker has not checked in');

      const job = signup.job;
      const unitPriceSnapshot = this.resolveUnitPriceSnapshot(job);
      const strategy = SalaryCalculatorFactory.getStrategy(job.payType);
      const amount = strategy.calculate({
        unitPrice: unitPriceSnapshot,
        workDuration: input.duration,
        pieceCount: input.count,
      });

      let salaryRecord = await manager.findOne(LaborSalary, {
        where: { signupId },
        lock: { mode: 'pessimistic_write' },
      });
      const creating = !salaryRecord;
      const previous = salaryRecord
        ? {
            workDuration: Number(salaryRecord.workDuration),
            pieceCount: salaryRecord.pieceCount,
            totalAmount: Number(salaryRecord.totalAmount),
            status: salaryRecord.status,
          }
        : null;

      if (!salaryRecord) {
        salaryRecord = manager.create(LaborSalary, { signupId });
      } else if (salaryRecord.status !== SalaryStatus.PENDING) {
        throw new BadRequestException('该工资单已确认或已发放，不能重新计算');
      }

      salaryRecord.unitPriceSnapshot = unitPriceSnapshot;
      salaryRecord.workDuration = input.duration || 0;
      salaryRecord.pieceCount = input.count || 0;
      salaryRecord.totalAmount = amount;
      salaryRecord.status = SalaryStatus.PENDING;
      salaryRecord.adminId = adminId;

      const next = await manager.save(LaborSalary, salaryRecord);
      return { saved: next, isCreate: creating, beforeSnapshot: previous };
    });
    await this.operationLogService.logWithContext({
      operationType: isCreate ? OperationType.CREATE : OperationType.UPDATE,
      resourceType: ResourceType.SALARY,
      resourceId: saved.id,
      userId: adminId,
      request: context?.request,
      description: `${isCreate ? '创建' : '更新'}工资草稿: salaryId=${saved.id}, signupId=${signupId}`,
      beforeData: beforeSnapshot,
      afterData: {
        signupId: saved.signupId,
        workDuration: Number(saved.workDuration),
        pieceCount: saved.pieceCount,
        totalAmount: Number(saved.totalAmount),
        status: saved.status,
      },
    });
    return saved;
  }

  /**
   * 获取工资记录列表。
   * 角色差异:
   * 1. 基地管理员只能查看自己基地。
   * 2. 现场管理员只能查看分配基地。
   * 3. 其余角色按显式筛选条件查询。
   */
  async getList(query: any, user: { id: number; role?: string; roleKey?: UserRole }) {
    const role = user.role ?? user.roleKey;
    const baseId = query.baseId ? Number(query.baseId) : null;
    const jobId = query.jobId ? Number(query.jobId) : null;
    const dateFrom = query.dateFrom || null;
    const dateTo = query.dateTo || null;
    const status = query.status !== undefined ? Number(query.status) : null;
    const keyword = query.keyword ? String(query.keyword).trim() : '';

    const qb = this.salaryRepo
      .createQueryBuilder('salary')
      .leftJoinAndSelect('salary.signup', 'signup')
      .leftJoinAndSelect('signup.user', 'user')
      .leftJoinAndSelect('signup.base', 'base')
      .leftJoinAndSelect('signup.job', 'job')
      .orderBy('salary.createdAt', 'DESC');

    if (role === UserRole.BASE_MANAGER) {
      const ownedBases = await this.baseRepo.find({ where: { ownerId: user.id }, select: ['id'] });
      const baseIds = ownedBases.map((b) => b.id);
      if (baseIds.length === 0) return { list: [], total: 0 };
      qb.andWhere('signup.baseId IN (:...baseIds)', { baseIds });
    } else if (role === UserRole.FIELD_MANAGER) {
      const fm = await this.userRepo.findOne({ where: { id: user.id } });
      if (fm?.assignedBaseId) {
        qb.andWhere('signup.baseId = :assignedBaseId', { assignedBaseId: fm.assignedBaseId });
      } else {
        return { list: [], total: 0 };
      }
    } else if (baseId) {
      qb.andWhere('signup.baseId = :baseId', { baseId });
    }

    if (dateFrom) qb.andWhere('signup.workDate >= :dateFrom', { dateFrom });
    if (dateTo) qb.andWhere('signup.workDate <= :dateTo', { dateTo });
    if (status !== null) qb.andWhere('salary.status = :status', { status });
    if (jobId) qb.andWhere('signup.jobId = :jobId', { jobId });
    if (keyword) {
      qb.andWhere('(user.name LIKE :kw OR user.uid LIKE :kw OR job.jobTitle LIKE :kw)', {
        kw: `%${keyword}%`,
      });
    }

    const [list, total] = await qb.getManyAndCount();

    const records = list.map((s) => {
      const signup = s.signup as DailySignup & {
        user?: {
          name: string;
          uid: string;
          phone?: string;
          idCard?: string;
          emergencyContact?: string;
          emergencyPhone?: string;
        };
        base?: { baseName: string };
        job?: { jobTitle: string; payType: number };
      };
      return {
        id: s.id,
        signupId: s.signupId,
        workerName: signup?.user?.name ?? '-',
        workerUid: signup?.user?.uid ?? '-',
        workerPhone: signup?.user?.phone ?? '',
        workerIdCard: signup?.user?.idCard ?? '',
        workerEmergencyContact: signup?.user?.emergencyContact ?? '',
        workerEmergencyPhone: signup?.user?.emergencyPhone ?? '',
        baseId: signup?.baseId,
        baseName: signup?.base?.baseName ?? '-',
        jobId: signup?.jobId,
        jobTitle: signup?.job?.jobTitle ?? '-',
        payType: signup?.job?.payType,
        workDate: signup?.workDate,
        workDuration: Number(s.workDuration),
        pieceCount: s.pieceCount,
        unitPriceSnapshot: Number(s.unitPriceSnapshot),
        totalAmount: Number(s.totalAmount),
        status: s.status,
        payoutType: s.payoutType,
        createdAt: s.createdAt,
      };
    });

    return { list: records, total };
  }

  /**
   * 获取薪资汇总统计，并复用与列表一致的角色范围隔离规则。
   */
  async getStats(query: any, user: { id: number; role?: string; roleKey?: UserRole }) {
    const role = user.role ?? user.roleKey;
    const baseId = query.baseId ? Number(query.baseId) : null;
    const dateFrom = query.dateFrom || null;
    const dateTo = query.dateTo || null;

    const qb = this.salaryRepo
      .createQueryBuilder('salary')
      .leftJoin('salary.signup', 'signup');

    if (role === UserRole.BASE_MANAGER) {
      const ownedBases = await this.baseRepo.find({ where: { ownerId: user.id }, select: ['id'] });
      const baseIds = ownedBases.map((b) => b.id);
      if (baseIds.length === 0) {
        return { totalPaid: 0, totalPending: 0, paidCount: 0, pendingCount: 0 };
      }
      qb.andWhere('signup.baseId IN (:...baseIds)', { baseIds });
    } else if (role === UserRole.FIELD_MANAGER) {
      const fm = await this.userRepo.findOne({ where: { id: user.id } });
      if (fm?.assignedBaseId) {
        qb.andWhere('signup.baseId = :assignedBaseId', { assignedBaseId: fm.assignedBaseId });
      } else {
        return { totalPaid: 0, totalPending: 0, paidCount: 0, pendingCount: 0 };
      }
    } else if (baseId) {
      qb.andWhere('signup.baseId = :baseId', { baseId });
    }
    if (dateFrom) qb.andWhere('signup.workDate >= :dateFrom', { dateFrom });
    if (dateTo) qb.andWhere('signup.workDate <= :dateTo', { dateTo });

    const list = await qb.getMany();

    let totalPaid = 0;
    let totalPending = 0;
    let paidCount = 0;
    let pendingCount = 0;
    for (const s of list) {
      const amount = Number(s.totalAmount);
      if (s.status === SalaryStatus.PAID) {
        totalPaid += amount;
        paidCount += 1;
      } else {
        totalPending += amount;
        pendingCount += 1;
      }
    }

    return { totalPaid, totalPending, paidCount, pendingCount };
  }

  /**
   * 采摘工端获取个人统计，包括已做工天数和待确认/待发放金额。
   */
  async getWorkerStats(userId: number) {
    const workDays = await this.signupRepo.count({
      where: { userId, status: SignupStatus.CHECKED_IN },
    });

    const pendingSalaries = await this.salaryRepo
      .createQueryBuilder('salary')
      .leftJoin('salary.signup', 'signup')
      .where('signup.userId = :userId', { userId })
      .andWhere('salary.status IN (:...statuses)', {
        statuses: [SalaryStatus.PENDING, SalaryStatus.CONFIRMED],
      })
      .getMany();

    const pendingAmount = pendingSalaries.reduce((sum, s) => sum + Number(s.totalAmount), 0);

    return {
      workDays,
      pendingAmount: Math.round(pendingAmount * 100) / 100,
    };
  }

  /**
   * 采摘工端获取待确认和待发放工资列表，用于支付前核对。
   */
  async getWorkerPendingList(userId: number) {
    const list = await this.salaryRepo
      .createQueryBuilder('salary')
      .leftJoinAndSelect('salary.signup', 'signup')
      .leftJoinAndSelect('signup.base', 'base')
      .leftJoinAndSelect('signup.job', 'job')
      .where('signup.userId = :userId', { userId })
      .andWhere('salary.status IN (:...statuses)', {
        statuses: [SalaryStatus.PENDING, SalaryStatus.CONFIRMED],
      })
      .orderBy('salary.createdAt', 'DESC')
      .getMany();

    return list.map((s) => {
      const signup = s.signup as any;
      return {
        id: s.id,
        signupId: s.signupId,
        workDate: signup?.workDate,
        baseName: signup?.base?.baseName ?? '-',
        jobTitle: signup?.job?.jobTitle ?? '-',
        workDuration: Number(s.workDuration),
        pieceCount: s.pieceCount,
        totalAmount: Number(s.totalAmount),
        status: s.status,
        createdAt: s.createdAt,
      };
    });
  }

  /**
   * 允许工人确认工资无误，并将状态从 `PENDING` 推进到 `CONFIRMED`。
   */
  async workerConfirmSalary(salaryId: number, userId: number, context?: OperationLogContext) {
    const { saved, beforeStatus } = await this.dataSource.transaction(async (manager) => {
      const salary = await manager.findOne(LaborSalary, {
        where: { id: salaryId },
        relations: ['signup'],
        lock: { mode: 'pessimistic_write' },
      });
      if (!salary) throw new NotFoundException('工资记录不存在');
      if ((salary.signup as any)?.userId !== userId) {
        throw new ForbiddenException('无权操作此记录');
      }
      if (salary.status !== SalaryStatus.PENDING) {
        throw new BadRequestException('该记录已确认或已发放');
      }

      const previousStatus = salary.status;
      salary.status = SalaryStatus.CONFIRMED;
      const next = await manager.save(LaborSalary, salary);
      return { saved: next, beforeStatus: previousStatus };
    });
    await this.operationLogService.logWithContext({
      operationType: OperationType.UPDATE,
      resourceType: ResourceType.SALARY,
      resourceId: saved.id,
      userId,
      request: context?.request,
      description: `工人确认工资: salaryId=${saved.id}`,
      beforeData: { status: beforeStatus },
      afterData: { status: saved.status },
    });
    return saved;
  }
}
