import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LaborSalary, SalaryStatus } from './entities/labor-salary.entity';
import { DailySignup, SignupStatus } from '../attendance/entities/daily-signup.entity';
import { BaseInfo } from '../base/entities/base-info.entity';
import { SalaryCalculatorFactory } from './services/salary-calculator.strategy';
import { UserRole } from '../user/entities/sys-user.entity';

@Injectable()
export class SalaryService {
  constructor(
    @InjectRepository(LaborSalary)
    private salaryRepo: Repository<LaborSalary>,
    @InjectRepository(DailySignup)
    private signupRepo: Repository<DailySignup>,
    @InjectRepository(BaseInfo)
    private baseRepo: Repository<BaseInfo>,
  ) {}

  async calculateAndDraft(signupId: number, input: { duration?: number; count?: number }, adminId: number) {
    const signup = await this.signupRepo.findOne({ where: { id: signupId }, relations: ['job'] });
    if (!signup) throw new BadRequestException('Signup record not found');
    if (signup.status !== SignupStatus.CHECKED_IN) throw new BadRequestException('Worker has not checked in');

    const job = signup.job;
    const strategy = SalaryCalculatorFactory.getStrategy(job.payType);
    
    const amount = strategy.calculate({
      unitPrice: job.unitPrice,
      workDuration: input.duration,
      pieceCount: input.count,
    });

    let salaryRecord = await this.salaryRepo.findOne({ where: { signupId } });
    if (!salaryRecord) {
      salaryRecord = new LaborSalary();
      salaryRecord.signupId = signupId;
    }

    salaryRecord.unitPriceSnapshot = job.unitPrice;
    salaryRecord.workDuration = input.duration || 0;
    salaryRecord.pieceCount = input.count || 0;
    salaryRecord.totalAmount = amount;
    salaryRecord.status = SalaryStatus.PENDING;
    salaryRecord.adminId = adminId;

    return this.salaryRepo.save(salaryRecord);
  }

  /**
   * 获取工资记录列表（支持按基地、日期、状态筛选；基地管理员仅看自己基地）
   */
  async getList(query: any, user: { id: number; role?: string; roleKey?: UserRole }) {
    const role = user.role ?? user.roleKey;
    const baseId = query.baseId ? Number(query.baseId) : null;
    const dateFrom = query.dateFrom || null;
    const dateTo = query.dateTo || null;
    const status = query.status !== undefined ? Number(query.status) : null;

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
    } else if (baseId) {
      qb.andWhere('signup.baseId = :baseId', { baseId });
    }

    if (dateFrom) qb.andWhere('signup.workDate >= :dateFrom', { dateFrom });
    if (dateTo) qb.andWhere('signup.workDate <= :dateTo', { dateTo });
    if (status !== null) qb.andWhere('salary.status = :status', { status });

    const [list, total] = await qb.getManyAndCount();

    const records = list.map((s) => {
      const signup = s.signup as DailySignup & { user?: { name: string; uid: string }; base?: { baseName: string }; job?: { jobTitle: string; payType: number } };
      return {
        id: s.id,
        signupId: s.signupId,
        workerName: signup?.user?.name ?? '-',
        workerUid: signup?.user?.uid ?? '-',
        baseId: signup?.baseId,
        baseName: signup?.base?.baseName ?? '-',
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
   * 获取薪资汇总统计（基地管理员仅统计自己基地）
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
}
