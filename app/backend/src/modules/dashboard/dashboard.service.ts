/**
 * Layer: Backend Service
 * Responsibility: Implements the Dashboard application service for the Dashboard module, including business rules, side effects, and persistence coordination.
 * Notes: Keep comments focused on intent, invariants, side effects, and cross-module contracts.
 */
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SysUser, UserRole } from '../user/entities/sys-user.entity';
import { BaseInfo, BaseCategory, AuditStatus } from '../base/entities/base-info.entity';
import { DailySignup, SignupStatus } from '../attendance/entities/daily-signup.entity';
import { LaborSalary, SalaryStatus } from '../salary/entities/labor-salary.entity';
import { BaseScopeService } from '../base/services/base-scope.service';

interface ReqUser {
  id: number;
  role?: string;
  roleKey?: UserRole;
}

@Injectable()
/**
 * 看板服务负责将多个业务表聚合成角色隔离后的运营指标。
 * 它不修改业务状态，只输出适合前端直接展示的统计视图。
 */
export class DashboardService {
  constructor(
    @InjectRepository(SysUser)
    private userRepo: Repository<SysUser>,
    @InjectRepository(BaseInfo)
    private baseRepo: Repository<BaseInfo>,
    @InjectRepository(DailySignup)
    private signupRepo: Repository<DailySignup>,
    @InjectRepository(LaborSalary)
    private salaryRepo: Repository<LaborSalary>,
    private baseScopeService: BaseScopeService,
  ) {}

  private getTodayDateString(): string {
    const date = new Date();
    const offset = date.getTimezoneOffset() * 60000;
    const localDate = new Date(date.getTime() - offset);
    return localDate.toISOString().split('T')[0];
  }

  /**
   * 解析当前用户可见的基地范围。
   * 返回 `null` 表示全局可见，返回空数组表示当前角色没有任何可见基地。
   */
  private async getScopedBaseIds(user: ReqUser): Promise<number[] | null> {
    return this.baseScopeService.getSupervisedBaseIds(user);
  }

  /**
   * 聚合首页核心统计指标，并按角色自动做数据范围隔离。
   */
  async getStats(user: ReqUser) {
    const today = this.getTodayDateString();
    const scopedBaseIds = await this.getScopedBaseIds(user);
    const isGlobal = scopedBaseIds === null;

    // 活跃工人数
    const totalWorkers = await this.userRepo.count({
      where: { roleKey: UserRole.WORKER, isDeleted: false },
    });

    // 基地数
    let totalBases: number;
    let allBases: number;
    if (isGlobal) {
      totalBases = await this.baseRepo.count({ where: { auditStatus: AuditStatus.APPROVED, isDeleted: false } });
      allBases = await this.baseRepo.count({ where: { isDeleted: false } });
    } else {
      totalBases = scopedBaseIds.length;
      allBases = scopedBaseIds.length;
    }

    // 今日签到
    const signupQb = this.signupRepo.createQueryBuilder('signup').where('signup.workDate = :today', { today });
    if (!isGlobal && scopedBaseIds.length > 0) {
      signupQb.andWhere('signup.baseId IN (:...baseIds)', { baseIds: scopedBaseIds });
    } else if (!isGlobal) {
      return this.emptyStats(today);
    }

    const todaySignups = await signupQb.getMany();
    const todayCheckedIn = todaySignups.filter((s) => s.status === SignupStatus.CHECKED_IN).length;
    const todaySignedUp = todaySignups.length;

    // 本月工资统计
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const salaryQb = this.salaryRepo
      .createQueryBuilder('salary')
      .leftJoin('salary.signup', 'signup')
      .where('signup.workDate >= :monthStart', { monthStart });

    if (!isGlobal && scopedBaseIds.length > 0) {
      salaryQb.andWhere('signup.baseId IN (:...baseIds)', { baseIds: scopedBaseIds });
    } else if (!isGlobal) {
      // no base assigned
    }

    const salaries = await salaryQb.getMany();
    let monthlyPaid = 0;
    let monthlyPending = 0;
    for (const s of salaries) {
      const amount = Number(s.totalAmount);
      if (s.status === SalaryStatus.PAID) {
        monthlyPaid += amount;
      } else {
        monthlyPending += amount;
      }
    }

    // 待审核
    const pendingAuditUsers = isGlobal
      ? await this.userRepo.count({ where: { infoAuditStatus: 0, isDeleted: false } })
      : 0;
    const pendingAuditBases = isGlobal
      ? await this.baseRepo.count({ where: { auditStatus: AuditStatus.PENDING, isDeleted: false } })
      : 0;

    return {
      totalWorkers,
      totalBases,
      allBases,
      todayCheckedIn,
      todaySignedUp,
      monthlyPaid: Math.round(monthlyPaid * 100) / 100,
      monthlyPending: Math.round(monthlyPending * 100) / 100,
      monthlyTotal: Math.round((monthlyPaid + monthlyPending) * 100) / 100,
      pendingAuditUsers,
      pendingAuditBases,
    };
  }

  private emptyStats(today: string) {
    return {
      totalWorkers: 0,
      totalBases: 0,
      allBases: 0,
      todayCheckedIn: 0,
      todaySignedUp: 0,
      monthlyPaid: 0,
      monthlyPending: 0,
      monthlyTotal: 0,
      pendingAuditUsers: 0,
      pendingAuditBases: 0,
    };
  }

  /**
   * 获取最近 7 天的签到和工资趋势数据，用于看板折线或面积图。
   */
  async getWeeklyTrend(user: ReqUser) {
    const scopedBaseIds = await this.getScopedBaseIds(user);
    const isGlobal = scopedBaseIds === null;

    const days: { date: string; label: string; checkedIn: number; signedUp: number; salary: number }[] = [];
    const dayLabels = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const offset = d.getTimezoneOffset() * 60000;
      const localDate = new Date(d.getTime() - offset);
      const dateStr = localDate.toISOString().split('T')[0];
      const dayOfWeek = localDate.getDay();

      const signupQb = this.signupRepo.createQueryBuilder('signup').where('signup.workDate = :date', { date: dateStr });
      if (!isGlobal && scopedBaseIds.length > 0) {
        signupQb.andWhere('signup.baseId IN (:...baseIds)', { baseIds: scopedBaseIds });
      }

      const daySignups = isGlobal || scopedBaseIds.length > 0 ? await signupQb.getMany() : [];
      const checkedIn = daySignups.filter((s) => s.status === SignupStatus.CHECKED_IN).length;
      const signedUp = daySignups.length;

      const salaryQb = this.salaryRepo
        .createQueryBuilder('salary')
        .leftJoin('salary.signup', 'signup')
        .where('signup.workDate = :date', { date: dateStr });
      if (!isGlobal && scopedBaseIds.length > 0) {
        salaryQb.andWhere('signup.baseId IN (:...baseIds)', { baseIds: scopedBaseIds });
      }
      const daySalaries = isGlobal || scopedBaseIds.length > 0 ? await salaryQb.getMany() : [];
      const salaryTotal = daySalaries.reduce((sum, s) => sum + Number(s.totalAmount), 0);

      days.push({
        date: dateStr,
        label: dayLabels[dayOfWeek],
        checkedIn,
        signedUp,
        salary: Math.round(salaryTotal * 100) / 100,
      });
    }

    return days;
  }

  /**
   * 统计基地类型分布，用于类别占比图表展示。
   */
  async getCategoryDistribution() {
    const bases = await this.baseRepo.find({ where: { isDeleted: false } });
    const fruit = bases.filter((b) => b.category === BaseCategory.FRUIT).length;
    const vegetable = bases.filter((b) => b.category === BaseCategory.VEGETABLE).length;
    const other = bases.filter((b) => b.category === BaseCategory.OTHER).length;
    const total = bases.length || 1;

    return [
      { name: '水果类', value: Math.round((fruit / total) * 100), count: fruit, color: '#10b981' },
      { name: '蔬菜类', value: Math.round((vegetable / total) * 100), count: vegetable, color: '#3b82f6' },
      { name: '其他', value: Math.round((other / total) * 100), count: other, color: '#f59e0b' },
    ];
  }

  /**
   * 获取最近入驻基地列表，用于管理端动态摘要卡片。
   */
  async getRecentBases(limit = 5) {
    const bases = await this.baseRepo.find({
      where: { isDeleted: false },
      order: { createdAt: 'DESC' },
      take: limit,
    });

    const categoryMap: Record<number, string> = { 1: '水果类', 2: '蔬菜类', 3: '其他' };
    const auditStatusMap: Record<number, string> = { 0: '待审核', 1: '已通过', 2: '已驳回' };

    return bases.map((b) => ({
      id: b.id,
      name: b.baseName,
      category: categoryMap[b.category] || '其他',
      regionCode: b.regionCode,
      address: b.address || '-',
      auditStatus: b.auditStatus,
      auditStatusText: auditStatusMap[b.auditStatus] || '-',
      hasActiveJobs: false,
      createdAt: b.createdAt,
    }));
  }
}
