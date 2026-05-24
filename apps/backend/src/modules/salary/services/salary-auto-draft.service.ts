/**
 * Layer: Backend Service
 * Responsibility: Automatically generates missing salary drafts after job periods end.
 * Notes: Keep comments focused on intent, invariants, side effects, and cross-module contracts.
 */
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DailySignup, SignupStatus } from '../../attendance/entities/daily-signup.entity';
import { RecruitmentJob, PayType } from '../../base/entities/recruitment-job.entity';
import { LaborSalary } from '../entities/labor-salary.entity';
import { SysUser, UserRole } from '../../user/entities/sys-user.entity';
import { SalaryService } from '../salary.service';

interface SalaryCalculatePayload {
  duration?: number;
  count?: number;
}

@Injectable()
export class SalaryAutoDraftService {
  private readonly logger = new Logger(SalaryAutoDraftService.name);
  private running = false;
  private static readonly SCHEDULE_TIME_ZONE = 'Asia/Shanghai';

  constructor(
    @InjectRepository(DailySignup)
    private signupRepo: Repository<DailySignup>,
    @InjectRepository(SysUser)
    private userRepo: Repository<SysUser>,
    private salaryService: SalaryService,
  ) {}

  /**
   * Every day 01:20 (Asia/Shanghai): generate salary drafts for ended jobs.
   */
  @Cron('0 20 1 * * *', { timeZone: SalaryAutoDraftService.SCHEDULE_TIME_ZONE })
  async handleDailyAutoDraft() {
    if (!this.isScheduleEnabled()) return;
    await this.runAutoDraft('cron');
  }

  async runAutoDraft(trigger: 'cron' | 'manual' = 'manual') {
    if (this.running) {
      this.logger.warn(`[salary-auto-draft] Skip ${trigger}: previous run is still in progress.`);
      return;
    }
    this.running = true;

    const startedAt = Date.now();
    try {
      const operator = await this.resolveOperator();
      if (!operator) {
        this.logger.warn('[salary-auto-draft] No available super admin account found, skip this run.');
        return;
      }

      const today = this.getDateStringInTimeZone(SalaryAutoDraftService.SCHEDULE_TIME_ZONE);
      const candidates = await this.findPendingSignups(today);

      if (!candidates.length) {
        this.logger.log(`[salary-auto-draft] No pending ended-job signups on ${today}.`);
        return;
      }

      let created = 0;
      let skipped = 0;
      let failed = 0;

      this.logger.log(
        `[salary-auto-draft] Start ${trigger}: candidates=${candidates.length}, operator=${operator.id}, today=${today}`,
      );

      for (let i = 0; i < candidates.length; i += 1) {
        const signup = candidates[i];
        const payload = this.buildCalculatePayload(signup.job);
        try {
          await this.salaryService.calculateAndDraft(signup.id, payload, operator.id);
          created += 1;
        } catch (err) {
          if (this.isSkippableError(err)) {
            skipped += 1;
          } else {
            failed += 1;
            this.logger.warn(
              `[salary-auto-draft] Failed signupId=${signup.id}, jobId=${signup.jobId}, userId=${signup.userId}, reason=${err?.message || err}`,
            );
          }
        }
      }

      const costMs = Date.now() - startedAt;
      this.logger.log(
        `[salary-auto-draft] Done ${trigger}: total=${candidates.length}, created=${created}, skipped=${skipped}, failed=${failed}, costMs=${costMs}`,
      );
    } catch (err) {
      this.logger.error(`[salary-auto-draft] Run ${trigger} crashed: ${err?.message || err}`);
    } finally {
      this.running = false;
    }
  }

  private isScheduleEnabled(): boolean {
    const raw = String(process.env.SALARY_AUTO_DRAFT_ENABLED ?? '').trim().toLowerCase();
    if (!raw) return true;
    return !['0', 'false', 'off', 'no'].includes(raw);
  }

  private async resolveOperator(): Promise<SysUser | null> {
    return this.userRepo
      .createQueryBuilder('user')
      .where('user.isDeleted = :isDeleted', { isDeleted: false })
      .andWhere('user.roleKey IN (:...roles)', {
        roles: [UserRole.SUPER_ADMIN, UserRole.REGION_ADMIN],
      })
      .orderBy('user.id', 'ASC')
      .getOne();
  }

  private async findPendingSignups(today: string): Promise<Array<DailySignup & { job: RecruitmentJob }>> {
    const rows = await this.signupRepo
      .createQueryBuilder('signup')
      .innerJoinAndSelect('signup.job', 'job')
      .leftJoin(LaborSalary, 'salary', 'salary.signupId = signup.id')
      .where('signup.status = :checkedIn', { checkedIn: SignupStatus.CHECKED_IN })
      .andWhere('job.workEndDate IS NOT NULL')
      .andWhere('job.workEndDate < :today', { today })
      .andWhere('signup.workDate <= job.workEndDate')
      .andWhere('salary.id IS NULL')
      .orderBy('job.workEndDate', 'ASC')
      .addOrderBy('signup.id', 'ASC')
      .getMany();

    return rows as Array<DailySignup & { job: RecruitmentJob }>;
  }

  private buildCalculatePayload(job: RecruitmentJob): SalaryCalculatePayload {
    if (!job) return {};

    if (job.payType === PayType.HOURLY) {
      return { duration: this.parseDurationFromWorkHours(job.workHours) };
    }
    if (job.payType === PayType.PIECEWORK) {
      return { count: Math.max(1, Number(job.targetCount) || 1) };
    }
    return {};
  }

  private parseDurationFromWorkHours(workHours: string): number {
    const text = String(workHours || '').trim();
    if (!text) return 8;

    const match = text.match(/(\d{1,2}):(\d{1,2})\s*[-~]\s*(\d{1,2}):(\d{1,2})/);
    if (!match) return 8;

    const startHour = Number(match[1]) || 0;
    const startMinute = Number(match[2]) || 0;
    const endHour = Number(match[3]) || 0;
    const endMinute = Number(match[4]) || 0;

    let start = startHour * 60 + startMinute;
    let end = endHour * 60 + endMinute;
    if (end < start) end += 24 * 60;

    const duration = (end - start) / 60;
    if (!Number.isFinite(duration) || duration <= 0) return 8;
    return Math.max(0.5, Math.round(duration * 10) / 10);
  }

  private getDateStringInTimeZone(timeZone: string): string {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = formatter.formatToParts(new Date());
    const year = parts.find((p) => p.type === 'year')?.value || '1970';
    const month = parts.find((p) => p.type === 'month')?.value || '01';
    const day = parts.find((p) => p.type === 'day')?.value || '01';
    return `${year}-${month}-${day}`;
  }

  private isSkippableError(err: any): boolean {
    const message = String(err?.message || '').toLowerCase();
    return (
      message.includes('not found')
      || message.includes('not checked in')
      || message.includes('already')
      || message.includes('cannot')
      || message.includes('duplicate')
      || message.includes('unique')
      || message.includes('confirmed')
      || message.includes('paid')
    );
  }
}

