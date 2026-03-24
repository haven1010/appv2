/**
 * Layer: Backend Service
 * Responsibility: Implements the Attendance application service for the Attendance module, including business rules, side effects, and persistence coordination.
 * Notes: Keep comments focused on intent, invariants, side effects, and cross-module contracts.
 */
import { Injectable, BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { DailySignup, SignupStatus } from './entities/daily-signup.entity';
import { SecurityService } from '../common/services/security.service';
import { SysUser, UserRole, isSuperAdmin } from '../user/entities/sys-user.entity';
import { RecruitmentJob } from '../base/entities/recruitment-job.entity';
import { BaseInfo } from '../base/entities/base-info.entity';
import { SmsService } from '../common/services/sms.service';
import { QrCodeService } from '../qrcode/qrcode.service';
import { OperationLogService, OperationLogContext } from '../common/services/operation-log.service';
import { OperationType, ResourceType } from '../common/entities/operation-log.entity';

@Injectable()
/**
 * 签到服务负责报名、签到、离线同步和签到统计。
 * 这里同时串联二维码、安全加密、短信发送与操作日志等跨模块副作用。
 */
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  constructor(
    @InjectRepository(DailySignup)
    private signupRepo: Repository<DailySignup>,
    @InjectRepository(SysUser)
    private userRepo: Repository<SysUser>,
    @InjectRepository(RecruitmentJob)
    private jobRepo: Repository<RecruitmentJob>,
    @InjectRepository(BaseInfo)
    private baseRepo: Repository<BaseInfo>,
    private securityService: SecurityService,
    private smsService: SmsService,
    private qrcodeService: QrCodeService,
    private operationLogService: OperationLogService,
    private dataSource: DataSource,
  ) { }

  private rethrowDuplicateSignup(error: any, message: string): never {
    if (error?.code === 'ER_DUP_ENTRY') {
      throw new BadRequestException(message);
    }
    throw error;
  }

  /**
   * 获取当前本地日期的 `YYYY-MM-DD` 字符串。
   * 该格式被作为报名和签到表的逻辑工作日主键之一。
   */
  private getTodayDateString(): string {
    const date = new Date();
    // 简单处理：减去时区偏差 (适用于服务器时间正确的情况)
    const offset = date.getTimezoneOffset() * 60000;
    const localDate = new Date(date.getTime() - offset);
    return localDate.toISOString().split('T')[0];
  }

  /**
   * 生成用户签到二维码载荷。
   * 编码格式为 `Encrypted(UID|Timestamp)`，用于现场扫码时的身份确认和时效校验。
   */
  async generateUserQrCode(userId: number): Promise<{ content: string, validDuration: string }> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('用户不存在');

    // 【修复】只使用 uid，确保唯一性。User实体没有 username 字段
    const identifier = user.uid;

    // 格式: 标识符 | 时间戳
    const payload = `${identifier}|${Date.now()}`;
    const content = this.securityService.encrypt(payload);

    return {
      content,
      validDuration: '24h' // 前端展示用
    };
  }

  /**
   * 处理现场扫码签到。
   * 前置条件:
   * 1. 二维码可解密且未过期。
   * 2. 用户在目标基地当日存在报名记录。
   * 副作用: 更新签到状态与签到时间，并写入操作日志。
   */
  async checkIn(qrContent: string, baseId: number, context?: OperationLogContext): Promise<DailySignup> {
    // 1. 解密
    let decrypted: string;
    try {
      decrypted = this.securityService.decrypt(qrContent);
    } catch (e) {
      throw new BadRequestException('二维码解析错误');
    }

    if (!decrypted) throw new BadRequestException('无效的二维码数据');

    // 2. 验证格式和有效期
    const parts = decrypted.split('|');
    // 兼容可能存在的旧格式，确保至少有2部分
    if (parts.length < 2) throw new BadRequestException('二维码格式错误');

    const [uid, timestampStr] = parts;
    const timestamp = Number(timestampStr);

    // 24小时有效期 (86400000 毫秒)
    if (Date.now() - timestamp > 86400000) {
      throw new BadRequestException('二维码已过期，请刷新');
    }

    // 3. 查找用户
    const user = await this.userRepo.findOne({ where: { uid } });
    if (!user) throw new NotFoundException(`未找到用户 (UID: ${uid})`);

    // 4. 查找今日报名记录
    const today = this.getTodayDateString();

    const signup = await this.signupRepo.findOne({
      where: {
        userId: user.id,
        baseId: baseId,
        workDate: today,
      },
      relations: ['job']
    });

    if (!signup) {
      // 【修复】日志改为使用 name (姓名) 和 uid (ID)
      this.logger.warn(`签到失败: 用户 ${user.name} (UID: ${user.uid}) 未在 ${today} 报名基地 ${baseId}`);
      throw new BadRequestException('该用户今日未在此基地报名');
    }

    // 5. 更新状态
    const { saved, beforeStatus, beforeCheckinTime, changed } = await this.dataSource.transaction(async (manager) => {
      const lockedSignup = await manager.findOne(DailySignup, {
        where: { id: signup.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!lockedSignup) {
        throw new NotFoundException('报名记录不存在');
      }
      if (lockedSignup.status === SignupStatus.CHECKED_IN) {
        return {
          saved: lockedSignup,
          beforeStatus: lockedSignup.status,
          beforeCheckinTime: lockedSignup.checkinTime,
          changed: false,
        };
      }

      const previousStatus = lockedSignup.status;
      const previousCheckinTime = lockedSignup.checkinTime;
      lockedSignup.status = SignupStatus.CHECKED_IN;
      lockedSignup.checkinTime = new Date();
      const next = await manager.save(DailySignup, lockedSignup);
      return {
        saved: next,
        beforeStatus: previousStatus,
        beforeCheckinTime: previousCheckinTime,
        changed: true,
      };
    });

    if (!changed) {
      return saved;
    }

    this.logger.log(`[签到成功] 用户: ${user.name} (UID: ${user.uid}), 基地ID: ${baseId}`);

    // 记录签到操作日志
    await this.operationLogService.logWithContext({
      operationType: OperationType.CHECKIN,
      resourceType: ResourceType.SIGNUP,
      resourceId: saved.id,
      userId: context?.userId ?? user.id,
      request: context?.request,
      description: `扫码签到: ${user.name} (${user.uid}), 基地ID: ${baseId}`,
      beforeData: {
        status: beforeStatus,
        checkinTime: beforeCheckinTime,
      },
      afterData: {
        status: saved.status,
        checkinTime: saved.checkinTime,
        isOfflineSync: saved.isOfflineSync,
      },
    });

    return saved;
  }

  /**
   * 批量同步离线签到记录。
   * 该流程采用逐条容错策略，单条失败不会中断整批同步。
   */
  async syncOfflineRecords(records: any[], adminId: number, context?: OperationLogContext) {
    const results = [];
    const today = this.getTodayDateString();

    for (const record of records) {
      try {
        // 离线数据通常只有 uid
        const user = await this.userRepo.findOne({ where: { uid: record.uid } });
        if (!user) {
          results.push({ uid: record.uid, status: 'error', msg: 'User not found' });
          continue;
        }

        // 使用记录中的日期，如果没有则默认为今天
        const dateToSync = record.date || today;

        const syncResult = await this.dataSource.transaction(async (manager) => {
          const lockedSignup = await manager.findOne(DailySignup, {
            where: { userId: user.id, baseId: record.baseId, workDate: dateToSync },
            lock: { mode: 'pessimistic_write' },
          });

          if (!lockedSignup) {
            return null;
          }

          if (lockedSignup.status === SignupStatus.CHECKED_IN) {
            return { signup: lockedSignup, changed: false };
          }

          lockedSignup.status = SignupStatus.CHECKED_IN;
          lockedSignup.checkinTime = record.checkinTime ? new Date(record.checkinTime) : new Date();
          lockedSignup.isOfflineSync = true;
          const saved = await manager.save(DailySignup, lockedSignup);
          return { signup: saved, changed: true };
        });

        if (syncResult?.signup) {
          if (!syncResult.changed) {
            results.push({ uid: record.uid, status: 'skipped', msg: 'Already checked in' });
          } else {
            results.push({ uid: record.uid, status: 'success' });
            await this.operationLogService.logWithContext({
              operationType: OperationType.CHECKIN,
              resourceType: ResourceType.SIGNUP,
              resourceId: syncResult.signup.id,
              userId: adminId,
              request: context?.request,
              description: `离线同步签到: ${record.uid}, 基地ID: ${record.baseId}`,
              beforeData: {
                status: SignupStatus.SIGNED_UP,
                isOfflineSync: false,
              },
              afterData: {
                status: syncResult.signup.status,
                isOfflineSync: syncResult.signup.isOfflineSync,
                checkinTime: syncResult.signup.checkinTime,
              },
            });
          }
        } else {
          // 严格模式：没有报名记录则报错
          results.push({ uid: record.uid, status: 'error', msg: 'No signup record' });
        }
      } catch (e) {
        results.push({ uid: record.uid, status: 'error', msg: e.message });
      }
    }
    return {
      total: records.length,
      results
    };
  }

  /**
   * 创建当日报名记录，并在成功后尝试发送签到二维码短信。
   * 代报名会复用同一套工作日与基地唯一性约束。
   */
  async signup(userId: number, dto: any, context?: OperationLogContext): Promise<DailySignup> {
    const { baseId, jobId } = dto;
    const proxyUserIds: number[] = Array.isArray(dto.proxyUserIds)
      ? Array.from(
          new Set<number>(
            dto.proxyUserIds
              .map((id: any) => Number(id))
              .filter((id: number) => Number.isInteger(id) && id > 0),
          ),
        )
      : [];
    // 如果没传日期，默认报今天的名
    const workDate = dto.workDate || this.getTodayDateString();

    if (proxyUserIds.length > 2) {
      throw new BadRequestException('最多只能代两人报名');
    }
    if (proxyUserIds.includes(userId)) {
      throw new BadRequestException('不能为自己代报名');
    }

    const { savedSignup, savedProxySignups } = await this.dataSource.transaction(async (manager) => {
      const jobRepo = manager.getRepository(RecruitmentJob);
      const signupRepo = manager.getRepository(DailySignup);

      const job = await jobRepo.findOne({ where: { id: jobId, baseId } });
      if (!job) {
        throw new NotFoundException('该基地不存在此招聘岗位');
      }
      if (!job.isActive) {
        throw new BadRequestException('该岗位已停止招聘');
      }

      const existing = await signupRepo.findOne({
        where: {
          userId,
          baseId,
          workDate,
        }
      });

      if (existing) {
        throw new BadRequestException('您今日已报名该基地，请勿重复操作');
      }

      const signup = signupRepo.create({
        userId,
        baseId,
        jobId,
        workDate,
        status: 0,
        isProxy: false,
      });

      let savedSignupRecord: DailySignup;
      try {
        savedSignupRecord = await signupRepo.save(signup);
      } catch (error) {
        this.rethrowDuplicateSignup(error, '您今日已报名该基地，请勿重复操作');
      }

      const proxyRecords: DailySignup[] = [];
      for (const proxyUserId of proxyUserIds) {
        const proxyExisting = await signupRepo.findOne({
          where: {
            userId: proxyUserId,
            baseId,
            workDate,
          }
        });

        if (proxyExisting) {
          continue;
        }

        const proxySignup = signupRepo.create({
          userId: proxyUserId,
          baseId,
          jobId,
          workDate,
          status: 0,
          isProxy: true,
          proxyUserId: userId,
        }) as DailySignup;

        try {
          proxyRecords.push(await signupRepo.save(proxySignup));
        } catch (error) {
          this.rethrowDuplicateSignup(error, `用户 ${proxyUserId} 今日已报名该基地`);
        }
      }

      return {
        savedSignup: savedSignupRecord,
        savedProxySignups: proxyRecords,
      };
    });

    await this.operationLogService.logWithContext({
      operationType: OperationType.CREATE,
      resourceType: ResourceType.SIGNUP,
      resourceId: savedSignup.id,
      userId,
      request: context?.request,
      description: `创建报名记录: signupId=${savedSignup.id}, baseId=${baseId}, jobId=${jobId}`,
      afterData: {
        baseId,
        jobId,
        workDate,
        isProxy: false,
        status: savedSignup.status,
      },
    });

    // 4. 生成二维码并发送短信
    try {
      const qrCode = await this.generateUserQrCode(userId);
      const base = await this.userRepo.manager.getRepository('BaseInfo').findOne({ where: { id: baseId } });
      const user = await this.userRepo.findOne({ where: { id: userId } });
      
      if (user && base) {
        await this.smsService.sendSignupConfirmation(
          user.phone,
          qrCode.content,
          base.baseName,
          workDate,
        );
      }
    } catch (error) {
      this.logger.warn(`发送短信失败: ${error.message}`);
    }

    for (const savedProxySignup of savedProxySignups) {
      await this.operationLogService.logWithContext({
        operationType: OperationType.CREATE,
        resourceType: ResourceType.SIGNUP,
        resourceId: savedProxySignup.id,
        userId,
        request: context?.request,
        description: `代报名记录: signupId=${savedProxySignup.id}, proxyUserId=${savedProxySignup.userId}, baseId=${baseId}, jobId=${jobId}`,
        afterData: {
          baseId,
          jobId,
          workDate,
          isProxy: true,
          proxyUserId: userId,
          userId: savedProxySignup.userId,
          status: savedProxySignup.status,
        },
      });
    }

    return savedSignup;
  }

  /**
   * 采摘工端：获取个人签到/工作历程
   */
  /**
   * 获取工人自己的报名与签到历史，供个人端展示近期工作记录。
   */
  async getWorkerSignupRecords(userId: number, limit = 50) {
    const list = await this.signupRepo.find({
      where: { userId },
      relations: ['base', 'job'],
      order: { workDate: 'DESC', createdAt: 'DESC' },
      take: limit,
    });
    return list.map((r) => ({
      id: r.id,
      baseName: r.base?.baseName ?? '-',
      jobTitle: r.job?.jobTitle ?? '-',
      workDate: r.workDate,
      status: r.status,
      statusText: r.status === SignupStatus.CHECKED_IN ? '已签到' : r.status === SignupStatus.ABSENT ? '缺勤' : r.status === SignupStatus.CANCELLED ? '已取消' : '已报名',
      checkinTime: r.checkinTime,
      createdAt: r.createdAt,
    }));
  }

  /**
   * 获取签到记录列表
   */
  /**
   * 获取管理端签到记录列表，并根据角色自动施加可见范围隔离。
   */
  async getRecords(query: any, user: { id: number; role?: string; roleKey?: UserRole }) {
    const date = query.date || this.getTodayDateString();
    const baseId = query.baseId ? Number(query.baseId) : null;
    const status = query.status !== undefined ? Number(query.status) : null;
    const role = user.role ?? user.roleKey;

    // 构建查询条件
    const qb = this.signupRepo
      .createQueryBuilder('signup')
      .leftJoinAndSelect('signup.user', 'user')
      .leftJoinAndSelect('signup.base', 'base')
      .leftJoinAndSelect('signup.job', 'job')
      .where('signup.workDate = :date', { date });

    // 基地管理员只能查看自己管理的基地
    if (role === UserRole.BASE_MANAGER) {
      const ownedBases = await this.baseRepo.find({
        where: { ownerId: user.id },
        select: ['id'],
      });
      const baseIds = ownedBases.map(b => b.id);
      if (baseIds.length === 0) {
        return { records: [], total: 0 };
      }
      qb.andWhere('signup.baseId IN (:...baseIds)', { baseIds });
    } else if (role === UserRole.FIELD_MANAGER) {
      // 现场管理员只看关联基地
      const fm = await this.userRepo.findOne({ where: { id: user.id } });
      if (fm?.assignedBaseId) {
        qb.andWhere('signup.baseId = :assignedBaseId', { assignedBaseId: fm.assignedBaseId });
      } else {
        return { records: [], total: 0 };
      }
    } else if (baseId) {
      qb.andWhere('signup.baseId = :baseId', { baseId });
    }

    // 状态过滤
    if (status !== null) {
      qb.andWhere('signup.status = :status', { status });
    }

    qb.orderBy('signup.checkinTime', 'DESC')
      .addOrderBy('signup.createdAt', 'DESC');

    const [records, total] = await qb.getManyAndCount();

    return {
      records: records.map(r => ({
        id: r.id,
        userId: r.userId,
        workerName: r.user?.name || '-',
        workerUid: r.user?.uid || '-',
        baseId: r.baseId,
        baseName: r.base?.baseName || '-',
        jobId: r.jobId,
        jobTitle: r.job?.jobTitle || '-',
        workDate: r.workDate,
        status: r.status,
        checkinTime: r.checkinTime,
        isProxy: r.isProxy,
        createdAt: r.createdAt,
      })),
      total,
      date,
    };
  }

  /**
   * 获取考勤汇总统计
   */
  /**
   * 获取签到概览统计，包括报名数、签到数和到场率等摘要指标。
   */
  async getStats(query: any, user: { id: number; role?: string; roleKey?: UserRole }) {
    const date = query.date || this.getTodayDateString();
    const role = user.role ?? user.roleKey;

    const qb = this.signupRepo
      .createQueryBuilder('signup')
      .where('signup.workDate = :date', { date });

    // 基地管理员只能统计自己管理的基地
    if (role === UserRole.BASE_MANAGER) {
      const ownedBases = await this.baseRepo.find({
        where: { ownerId: user.id },
        select: ['id'],
      });
      const baseIds = ownedBases.map(b => b.id);
      if (baseIds.length === 0) {
        return { checkedIn: 0, absent: 0, signedUp: 0, total: 0, attendanceRate: 0, date };
      }
      qb.andWhere('signup.baseId IN (:...baseIds)', { baseIds });
    } else if (role === UserRole.FIELD_MANAGER) {
      const fm = await this.userRepo.findOne({ where: { id: user.id } });
      if (fm?.assignedBaseId) {
        qb.andWhere('signup.baseId = :assignedBaseId', { assignedBaseId: fm.assignedBaseId });
      } else {
        return { checkedIn: 0, absent: 0, signedUp: 0, total: 0, attendanceRate: 0, date };
      }
    }

    const allRecords = await qb.getMany();

    const checkedIn = allRecords.filter(r => r.status === SignupStatus.CHECKED_IN).length;
    const absent = allRecords.filter(r => r.status === SignupStatus.ABSENT).length;
    const signedUp = allRecords.filter(r => r.status === SignupStatus.SIGNED_UP).length;
    const total = allRecords.length;
    const attendanceRate = total > 0 ? Math.round((checkedIn / total) * 100) : 0;

    return {
      checkedIn,
      absent,
      signedUp,
      total,
      attendanceRate,
      date,
    };
  }

  /**
   * 获取各基地的签到统计
   */
  /**
   * 获取基地维度的签到聚合结果，用于现场管理和基地经营分析。
   */
  async getBaseStats(query: any, user: { id: number; role?: string; roleKey?: UserRole }) {
    const date = query.date || this.getTodayDateString();
    const role = user.role ?? user.roleKey;

    // 构建基地查询
    let baseQb = this.baseRepo.createQueryBuilder('base');

    // 基地管理员只能看到自己管理的基地
    if (role === UserRole.BASE_MANAGER) {
      baseQb.where('base.ownerId = :ownerId', { ownerId: user.id });
    } else if (role === UserRole.FIELD_MANAGER) {
      const fm = await this.userRepo.findOne({ where: { id: user.id } });
      if (fm?.assignedBaseId) {
        baseQb.where('base.id = :assignedBaseId', { assignedBaseId: fm.assignedBaseId });
      } else {
        return { bases: [], date };
      }
    }

    const bases = await baseQb.getMany();

    if (bases.length === 0) {
      return { bases: [], date };
    }

    const baseIds = bases.map(b => b.id);

    // 查询每个基地的签到数据
    const signups = await this.signupRepo
      .createQueryBuilder('signup')
      .where('signup.workDate = :date', { date })
      .andWhere('signup.baseId IN (:...baseIds)', { baseIds })
      .getMany();

    // 按基地分组统计
    const baseStats = bases.map(base => {
      const baseSignups = signups.filter(s => s.baseId === base.id);
      const present = baseSignups.filter(s => s.status === SignupStatus.CHECKED_IN).length;
      const total = baseSignups.length;

      return {
        baseId: base.id,
        baseName: base.baseName,
        present,
        total,
        attendanceRate: total > 0 ? Math.round((present / total) * 100) : 0,
      };
    });

    return {
      bases: baseStats,
      date,
    };
  }
}
