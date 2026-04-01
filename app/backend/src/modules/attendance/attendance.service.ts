/**
 * Layer: Backend Service
 * Responsibility: Implements the Attendance application service for the Attendance module, including business rules, side effects, and persistence coordination.
 * Notes: Keep comments focused on intent, invariants, side effects, and cross-module contracts.
 */
import { Injectable, BadRequestException, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { DailySignup, SignupStatus } from './entities/daily-signup.entity';
import {
  OfflineAttendanceEvent,
  OfflineAttendanceEventStatus,
  OfflineAttendanceRiskLevel,
} from './entities/offline-attendance-event.entity';
import { SecurityService } from '../common/services/security.service';
import { SysUser, UserRole, isSuperAdmin } from '../user/entities/sys-user.entity';
import { RecruitmentJob } from '../base/entities/recruitment-job.entity';
import { BaseInfo } from '../base/entities/base-info.entity';
import { SmsService } from '../common/services/sms.service';
import { QrCodeService } from '../qrcode/qrcode.service';
import { OperationLogService, OperationLogContext } from '../common/services/operation-log.service';
import { OperationType, ResourceType } from '../common/entities/operation-log.entity';
import { CreateOfflineAttendanceEventDto } from './dto/create-offline-attendance-event.dto';
import { ReviewOfflineAttendanceEventDto } from './dto/review-offline-attendance-event.dto';

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
    @InjectRepository(OfflineAttendanceEvent)
    private offlineEventRepo: Repository<OfflineAttendanceEvent>,
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

  private getLocalDateString(value: Date): string {
    const offset = value.getTimezoneOffset() * 60000;
    return new Date(value.getTime() - offset).toISOString().split('T')[0];
  }

  private resolveRole(user: { role?: string; roleKey?: UserRole }): string | undefined {
    return user.role ?? user.roleKey;
  }

  private createGeneratedOfflineRecordId(): string {
    return `offline-${Date.now()}-${Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, '0')}`;
  }

  private normalizeOccurredAt(value?: string, fallbackDate?: string): Date {
    if (value) {
      return new Date(value);
    }

    if (fallbackDate) {
      return new Date(`${fallbackDate}T08:00:00`);
    }

    return new Date();
  }

  private async getScopedBaseIds(user: { id: number; role?: string; roleKey?: UserRole }): Promise<number[] | null> {
    const role = this.resolveRole(user);
    if (!role) return [];

    if (isSuperAdmin(role)) {
      return null;
    }

    if (role === UserRole.BASE_MANAGER) {
      const ownedBases = await this.baseRepo.find({ where: { ownerId: user.id }, select: ['id'] });
      return ownedBases.map((item) => Number(item.id));
    }

    if (role === UserRole.FIELD_MANAGER) {
      const operator = await this.userRepo.findOne({ where: { id: user.id } });
      return operator?.assignedBaseId ? [Number(operator.assignedBaseId)] : [];
    }

    return [];
  }

  private async assertCanSubmitOfflineForBase(user: { id: number; role?: string; roleKey?: UserRole }, baseId: number) {
    const normalizedBaseId = Number(baseId);
    const role = this.resolveRole(user);
    if (!role || role === UserRole.WORKER) {
      throw new ForbiddenException('当前角色无权提交离线补签到');
    }

    const scopedBaseIds = await this.getScopedBaseIds(user);
    if (scopedBaseIds !== null && !scopedBaseIds.includes(normalizedBaseId)) {
      throw new ForbiddenException('无权为该基地提交离线补签到');
    }
  }

  private async assertCanReviewOfflineForBase(user: { id: number; role?: string; roleKey?: UserRole }, baseId: number) {
    const normalizedBaseId = Number(baseId);
    const role = this.resolveRole(user);
    if (!role || role === UserRole.WORKER || role === UserRole.FIELD_MANAGER) {
      throw new ForbiddenException('当前角色无权审核离线补签到');
    }

    const scopedBaseIds = await this.getScopedBaseIds(user);
    if (scopedBaseIds !== null && !scopedBaseIds.includes(normalizedBaseId)) {
      throw new ForbiddenException('无权审核该基地的离线补签到');
    }
  }

  private async evaluateOfflineEventDraft(
    manager: any,
    draft: {
      workerUid: string;
      baseId: number;
      jobId: number | null;
      workDate: string;
      occurredAt: Date;
    },
  ) {
    const worker = await manager.findOne(SysUser, {
      where: { uid: draft.workerUid, isDeleted: false },
    });

    if (!worker) {
      return {
        worker: null,
        existingSignup: null,
        normalizedJobId: draft.jobId,
        autoApply: false,
        riskLevel: OfflineAttendanceRiskLevel.HIGH,
        validationMessage: '未找到工人信息，需要人工审核',
      };
    }

    const existingSignup = await manager.findOne(DailySignup, {
      where: {
        userId: worker.id,
        baseId: draft.baseId,
        workDate: draft.workDate,
      },
      lock: { mode: 'pessimistic_write' },
    });

    const ageMs = Date.now() - draft.occurredAt.getTime();
    if (ageMs > 36 * 60 * 60 * 1000) {
      return {
        worker,
        existingSignup,
        normalizedJobId: draft.jobId ?? existingSignup?.jobId ?? null,
        autoApply: false,
        riskLevel: OfflineAttendanceRiskLevel.HIGH,
        validationMessage: '补录时间超过36小时，需要人工审核',
      };
    }

    if (existingSignup?.status === SignupStatus.CHECKED_IN) {
      return {
        worker,
        existingSignup,
        normalizedJobId: draft.jobId ?? existingSignup.jobId,
        autoApply: false,
        riskLevel: OfflineAttendanceRiskLevel.HIGH,
        validationMessage: '该工人当日已存在签到记录，需要人工复核',
      };
    }

    if (draft.jobId) {
      const job = await manager.findOne(RecruitmentJob, { where: { id: draft.jobId } });
      if (!job || Number(job.baseId) !== Number(draft.baseId)) {
        return {
          worker,
          existingSignup,
          normalizedJobId: draft.jobId,
          autoApply: false,
          riskLevel: OfflineAttendanceRiskLevel.HIGH,
          validationMessage: '岗位与基地不匹配，需要人工审核',
        };
      }

      if (existingSignup && Number(existingSignup.jobId) !== Number(draft.jobId)) {
        return {
          worker,
          existingSignup,
          normalizedJobId: draft.jobId,
          autoApply: false,
          riskLevel: OfflineAttendanceRiskLevel.HIGH,
          validationMessage: '补录岗位与既有报名岗位不一致，需要人工审核',
        };
      }
    }

    if (!existingSignup) {
      return {
        worker,
        existingSignup: null,
        normalizedJobId: draft.jobId,
        autoApply: false,
        riskLevel: OfflineAttendanceRiskLevel.HIGH,
        validationMessage: draft.jobId
          ? '未找到当日报名记录，需审核后补录'
          : '未找到当日报名记录且缺少岗位信息，需人工审核',
      };
    }

    return {
      worker,
      existingSignup,
      normalizedJobId: draft.jobId ?? existingSignup.jobId,
      autoApply: true,
      riskLevel: OfflineAttendanceRiskLevel.LOW,
      validationMessage: '命中当日报名记录，已自动补签到',
    };
  }

  private async applyOfflineEventToSignup(
    manager: any,
    event: OfflineAttendanceEvent,
    worker: SysUser | null,
    reviewedBy: number,
    nextStatus: OfflineAttendanceEventStatus,
    reviewNote?: string,
  ) {
    const resolvedWorker = worker ?? (event.workerId
      ? await manager.findOne(SysUser, { where: { id: event.workerId, isDeleted: false } })
      : await manager.findOne(SysUser, { where: { uid: event.workerUid, isDeleted: false } }));

    if (!resolvedWorker) {
      throw new BadRequestException('未找到工人信息，无法通过补录');
    }

    const signupRepo = manager.getRepository(DailySignup);
    const jobRepo = manager.getRepository(RecruitmentJob);
    let signup = await signupRepo.findOne({
      where: {
        userId: resolvedWorker.id,
        baseId: event.baseId,
        workDate: event.workDate,
      },
      lock: { mode: 'pessimistic_write' },
    });
    const signupBefore = signup
      ? {
          existed: true,
          status: signup.status,
          checkinTime: signup.checkinTime,
          isOfflineSync: signup.isOfflineSync,
        }
      : {
          existed: false,
          status: null,
          checkinTime: null,
          isOfflineSync: false,
        };
    let signupChanged = false;

    const effectiveJobId = event.jobId ?? signup?.jobId ?? null;
    if (!signup && !effectiveJobId) {
      throw new BadRequestException('缺少岗位信息，无法补录未报名工人的签到');
    }

    if (effectiveJobId) {
      const job = await jobRepo.findOne({ where: { id: effectiveJobId } });
      if (!job || Number(job.baseId) !== Number(event.baseId)) {
        throw new BadRequestException('补录岗位与基地不匹配，无法通过');
      }
      if (signup && Number(signup.jobId) !== Number(effectiveJobId)) {
        throw new BadRequestException('已有报名记录的岗位与补录岗位不一致，无法通过');
      }
    }

    if (!signup) {
      signup = signupRepo.create({
        userId: resolvedWorker.id,
        baseId: event.baseId,
        jobId: effectiveJobId!,
        workDate: event.workDate,
        status: SignupStatus.CHECKED_IN,
        checkinTime: event.occurredAt,
        isProxy: false,
        isOfflineSync: true,
      });
      signup = await signupRepo.save(signup);
      signupChanged = true;
    } else if (signup.status !== SignupStatus.CHECKED_IN) {
      signup.status = SignupStatus.CHECKED_IN;
      signup.checkinTime = event.occurredAt;
      signup.isOfflineSync = true;
      signup = await signupRepo.save(signup);
      signupChanged = true;
    }

    event.workerId = resolvedWorker.id;
    event.jobId = effectiveJobId;
    event.appliedSignupId = signup.id;
    event.status = nextStatus;
    event.reviewedBy = reviewedBy;
    event.reviewedAt = new Date();
    event.validationMessage = reviewNote || event.validationMessage;

    const savedEvent = await manager.save(OfflineAttendanceEvent, event);
    return { event: savedEvent, signup, worker: resolvedWorker, signupBefore, signupChanged };
  }

  private async logOfflineSignupApplied(params: {
    operatorId: number;
    event: OfflineAttendanceEvent;
    signup: DailySignup;
    signupBefore: {
      existed: boolean;
      status: number | null;
      checkinTime: Date | null;
      isOfflineSync: boolean;
    };
    request?: OperationLogContext['request'];
    decision: 'auto_approved' | 'approved';
  }) {
    await this.operationLogService.logWithContext({
      operationType: OperationType.CHECKIN,
      resourceType: ResourceType.SIGNUP,
      resourceId: params.signup.id,
      userId: params.operatorId,
      request: params.request,
      description: `离线补签到落库: eventId=${params.event.id}, signupId=${params.signup.id}, decision=${params.decision}`,
      beforeData: {
        status: params.signupBefore.status,
        checkinTime: params.signupBefore.checkinTime,
        isOfflineSync: params.signupBefore.isOfflineSync,
        existed: params.signupBefore.existed,
      },
      afterData: {
        status: params.signup.status,
        checkinTime: params.signup.checkinTime,
        isOfflineSync: params.signup.isOfflineSync,
        offlineEventId: params.event.id,
        existed: true,
      },
    });
  }

  /**
   * 生成用户签到二维码载荷。
   * 编码格式为 `Encrypted(UID|Timestamp)`，用于现场扫码时的身份确认和时效校验。
   */
  async generateUserQrCode(userId: number): Promise<{ content: string, validDuration: string, qrImageBase64: string }> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('用户不存在');

    // 【修复】只使用 uid，确保唯一性。User实体没有 username 字段
    const identifier = user.uid;

    // 格式: 标识符 | 时间戳
    const payload = `${identifier}|${Date.now()}`;
    const content = this.securityService.encrypt(payload);

    let qrImageBase64 = '';
    try {
      qrImageBase64 = await this.qrcodeService.generateDataUrl(content);
    } catch (error) {
      this.logger.warn(`二维码图片生成失败: user=${user.uid}, error=${error?.message || error}`);
    }

    return {
      content,
      validDuration: '24h', // 前端展示用
      qrImageBase64,
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
    const operator = await this.userRepo.findOne({ where: { id: adminId, isDeleted: false } });
    const results = [];

    for (let index = 0; index < records.length; index += 1) {
      const record = records[index];
      try {
        const event = await this.createOfflineAttendanceEvent({
          offlineRecordId: record.offlineRecordId || `legacy-${adminId}-${index}-${Date.now()}`,
          deviceId: record.deviceId || `legacy-sync-${adminId}`,
          workerUid: record.uid,
          baseId: Number(record.baseId),
          jobId: record.jobId ? Number(record.jobId) : undefined,
          workDate: record.date,
          occurredAt: record.checkinTime,
          evidenceNote: record.evidenceNote,
        }, operator ?? ({ id: adminId, roleKey: UserRole.SUPER_ADMIN } as any), context);

        results.push({
          uid: record.uid,
          status: event.status === OfflineAttendanceEventStatus.PENDING_REVIEW ? 'pending_review' : 'success',
          eventId: event.id,
          msg: event.validationMessage,
        });
      } catch (e) {
        results.push({ uid: record.uid, status: 'error', msg: e.message });
      }
    }

    return {
      total: records.length,
      results,
    };
  }

  async createOfflineAttendanceEvent(
    dto: CreateOfflineAttendanceEventDto,
    operator: { id: number; role?: string; roleKey?: UserRole },
    context?: OperationLogContext,
  ) {
    const baseId = Number(dto.baseId);
    await this.assertCanSubmitOfflineForBase(operator, baseId);

    const occurredAt = this.normalizeOccurredAt(dto.occurredAt, dto.workDate);
    const workDate = dto.workDate || this.getLocalDateString(occurredAt);
    const deviceId = dto.deviceId?.trim() || 'web-manual';
    const offlineRecordId = dto.offlineRecordId?.trim() || this.createGeneratedOfflineRecordId();
    const workerUid = dto.workerUid.trim();
    const jobId = dto.jobId ? Number(dto.jobId) : null;

    const transactionResult = await this.dataSource.transaction(async (manager) => {
      const existing = await manager.findOne(OfflineAttendanceEvent, {
        where: { deviceId, offlineRecordId },
        relations: ['base', 'job', 'submitter', 'reviewer'],
      });
      if (existing) {
        return {
          event: existing,
          created: false,
        };
      }

      const evaluation = await this.evaluateOfflineEventDraft(manager, {
        workerUid,
        baseId,
        jobId,
        workDate,
        occurredAt,
      });

      let event = manager.create(OfflineAttendanceEvent, {
        offlineRecordId,
        deviceId,
        workerUid,
        workerId: evaluation.worker?.id ?? null,
        baseId,
        jobId: evaluation.normalizedJobId ?? null,
        workDate,
        occurredAt,
        submittedBy: operator.id,
        status: evaluation.autoApply
          ? OfflineAttendanceEventStatus.AUTO_APPROVED
          : OfflineAttendanceEventStatus.PENDING_REVIEW,
        riskLevel: evaluation.riskLevel,
        validationMessage: evaluation.validationMessage,
        evidenceNote: dto.evidenceNote?.trim() || null,
        evidenceJson: JSON.stringify({
          note: dto.evidenceNote?.trim() || null,
          clientOccurredAt: dto.occurredAt || null,
          attachments: Array.isArray(dto.evidenceAttachments) ? dto.evidenceAttachments : [],
        }),
        payloadJson: JSON.stringify(dto),
      });

      event = await manager.save(OfflineAttendanceEvent, event);

      if (!evaluation.autoApply || !evaluation.worker) {
        return {
          event,
          created: true,
        };
      }

      const applied = await this.applyOfflineEventToSignup(
        manager,
        event,
        evaluation.worker,
        operator.id,
        OfflineAttendanceEventStatus.AUTO_APPROVED,
        evaluation.validationMessage,
      );

      if (applied.signupChanged) {
        await this.logOfflineSignupApplied({
          operatorId: operator.id,
          event: applied.event,
          signup: applied.signup,
          signupBefore: applied.signupBefore,
          request: context?.request,
          decision: 'auto_approved',
        });
      }

      return {
        event: applied.event,
        created: true,
      };
    });

    if (transactionResult.created) {
      await this.operationLogService.logWithContext({
        operationType: OperationType.CREATE,
        resourceType: ResourceType.OFFLINE_EVENT,
        resourceId: transactionResult.event.id,
        userId: operator.id,
        request: context?.request,
        description: `提交离线补签到事件: eventId=${transactionResult.event.id}, workerUid=${workerUid}, baseId=${baseId}`,
        afterData: {
          offlineRecordId,
          deviceId,
          status: transactionResult.event.status,
          riskLevel: transactionResult.event.riskLevel,
          validationMessage: transactionResult.event.validationMessage,
          workDate: transactionResult.event.workDate,
          occurredAt: transactionResult.event.occurredAt,
        },
      });
    }

    return transactionResult.event;
  }

  async getOfflineAttendanceEvents(
    query: any,
    operator: { id: number; role?: string; roleKey?: UserRole },
  ) {
    const scopedBaseIds = await this.getScopedBaseIds(operator);
    if (scopedBaseIds !== null && scopedBaseIds.length === 0) {
      return { list: [], total: 0, page: 1, pageSize: Math.min(Math.max(Number(query.pageSize || 10), 1), 100) };
    }

    const qb = this.offlineEventRepo
      .createQueryBuilder('event')
      .leftJoinAndSelect('event.base', 'base')
      .leftJoinAndSelect('event.job', 'job')
      .leftJoinAndSelect('event.submitter', 'submitter')
      .leftJoinAndSelect('event.reviewer', 'reviewer')
      .leftJoinAndSelect('event.worker', 'worker')
      .orderBy('event.createdAt', 'DESC');

    if (scopedBaseIds !== null) {
      qb.andWhere('event.baseId IN (:...scopedBaseIds)', { scopedBaseIds });
    }

    if (query.baseId) {
      qb.andWhere('event.baseId = :baseId', { baseId: Number(query.baseId) });
    }
    if (query.workDate) {
      qb.andWhere('event.workDate = :workDate', { workDate: query.workDate });
    }
    if (query.status !== undefined && query.status !== '') {
      qb.andWhere('event.status = :status', { status: Number(query.status) });
    }
    if (query.onlyMine === 'true') {
      qb.andWhere('event.submittedBy = :submittedBy', { submittedBy: operator.id });
    }

    const page = Math.max(Number(query.page || 1), 1);
    const pageSize = Math.min(Math.max(Number(query.pageSize || 10), 1), 100);
    qb.skip((page - 1) * pageSize).take(pageSize);

    const [list, total] = await qb.getManyAndCount();

    return {
      list: list.map((event) => ({
        id: event.id,
        offlineRecordId: event.offlineRecordId,
        deviceId: event.deviceId,
        workerUid: event.workerUid,
        workerName: event.worker?.name || '-',
        baseId: event.baseId,
        baseName: event.base?.baseName || '-',
        jobId: event.jobId,
        jobTitle: event.job?.jobTitle || '-',
        workDate: event.workDate,
        occurredAt: event.occurredAt,
        submittedBy: event.submittedBy,
        submittedByName: event.submitter?.name || '-',
        status: event.status,
        riskLevel: event.riskLevel,
        validationMessage: event.validationMessage,
        evidenceNote: event.evidenceNote,
        evidenceAttachments: (() => {
          try {
            const parsed = event.evidenceJson ? JSON.parse(event.evidenceJson) : null;
            return Array.isArray(parsed?.attachments) ? parsed.attachments : [];
          } catch {
            return [];
          }
        })(),
        reviewedBy: event.reviewedBy,
        reviewedByName: event.reviewer?.name || '-',
        reviewedAt: event.reviewedAt,
        appliedSignupId: event.appliedSignupId,
        createdAt: event.createdAt,
      })),
      total,
      page,
      pageSize,
    };
  }

  async getOfflineAttendanceEventStats(
    query: any,
    operator: { id: number; role?: string; roleKey?: UserRole },
  ) {
    const scopedBaseIds = await this.getScopedBaseIds(operator);
    if (scopedBaseIds !== null && scopedBaseIds.length === 0) {
      return {
        total: 0,
        pendingReview: 0,
        approved: 0,
        rejected: 0,
        autoApproved: 0,
      };
    }

    const qb = this.offlineEventRepo.createQueryBuilder('event');
    if (scopedBaseIds !== null) {
      qb.andWhere('event.baseId IN (:...scopedBaseIds)', { scopedBaseIds });
    }
    if (query.baseId) {
      qb.andWhere('event.baseId = :baseId', { baseId: Number(query.baseId) });
    }
    if (query.workDate) {
      qb.andWhere('event.workDate = :workDate', { workDate: query.workDate });
    }

    const raw = await qb
      .select('COUNT(1)', 'total')
      .addSelect(`SUM(CASE WHEN event.status = ${OfflineAttendanceEventStatus.PENDING_REVIEW} THEN 1 ELSE 0 END)`, 'pendingReview')
      .addSelect(`SUM(CASE WHEN event.status = ${OfflineAttendanceEventStatus.APPROVED} THEN 1 ELSE 0 END)`, 'approved')
      .addSelect(`SUM(CASE WHEN event.status = ${OfflineAttendanceEventStatus.REJECTED} THEN 1 ELSE 0 END)`, 'rejected')
      .addSelect(`SUM(CASE WHEN event.status = ${OfflineAttendanceEventStatus.AUTO_APPROVED} THEN 1 ELSE 0 END)`, 'autoApproved')
      .getRawOne();

    return {
      total: Number(raw?.total || 0),
      pendingReview: Number(raw?.pendingReview || 0),
      approved: Number(raw?.approved || 0),
      rejected: Number(raw?.rejected || 0),
      autoApproved: Number(raw?.autoApproved || 0),
    };
  }

  async reviewOfflineAttendanceEvent(
    eventId: number,
    body: ReviewOfflineAttendanceEventDto,
    operator: { id: number; role?: string; roleKey?: UserRole },
    context?: OperationLogContext,
  ) {
    const existing = await this.offlineEventRepo.findOne({ where: { id: eventId } });
    if (!existing) {
      throw new NotFoundException('离线补签到事件不存在');
    }

    await this.assertCanReviewOfflineForBase(operator, existing.baseId);

    const result = await this.dataSource.transaction(async (manager) => {
      const event = await manager.findOne(OfflineAttendanceEvent, {
        where: { id: eventId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!event) {
        throw new NotFoundException('离线补签到事件不存在');
      }
      if (event.status !== OfflineAttendanceEventStatus.PENDING_REVIEW) {
        throw new BadRequestException('该离线补签到事件已处理，请刷新后重试');
      }

      if (body.decision === 'reject') {
        event.status = OfflineAttendanceEventStatus.REJECTED;
        event.reviewedBy = operator.id;
        event.reviewedAt = new Date();
        event.validationMessage = body.reason?.trim() || '已拒绝';
        return {
          event: await manager.save(OfflineAttendanceEvent, event),
          signup: null,
          signupBefore: null,
          signupChanged: false,
        };
      }

      const applied = await this.applyOfflineEventToSignup(
        manager,
        event,
        null,
        operator.id,
        OfflineAttendanceEventStatus.APPROVED,
        body.reason?.trim() || '人工审核通过',
      );
      return {
        event: applied.event,
        signup: applied.signup,
        signupBefore: applied.signupBefore,
        signupChanged: applied.signupChanged,
      };
    });

    await this.operationLogService.logWithContext({
      operationType: OperationType.AUDIT,
      resourceType: ResourceType.OFFLINE_EVENT,
      resourceId: result.event.id,
      userId: operator.id,
      request: context?.request,
      description: `审核离线补签到事件: eventId=${eventId}, decision=${body.decision}`,
      beforeData: {
        status: OfflineAttendanceEventStatus.PENDING_REVIEW,
      },
      afterData: {
        status: result.event.status,
        validationMessage: result.event.validationMessage,
        appliedSignupId: result.event.appliedSignupId,
      },
    });

    if (body.decision === 'approve' && result.signup && result.signupChanged) {
      await this.logOfflineSignupApplied({
        operatorId: operator.id,
        event: result.event,
        signup: result.signup,
        signupBefore: result.signupBefore,
        request: context?.request,
        decision: 'approved',
      });
    }

    return result.event;
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
   * 工人端取消报名：删除报名表中的记录。
   * 仅允许删除“已报名/已取消”状态，已签到或缺勤记录不允许删除。
   */
  async cancelSignup(
    userId: number,
    dto: { signupId?: number; baseId?: number; workDate?: string },
    context?: OperationLogContext,
  ) {
    const signupId = Number(dto?.signupId || 0);
    const baseId = Number(dto?.baseId || 0);
    const workDate = dto?.workDate || this.getTodayDateString();

    if (!signupId && !baseId) {
      throw new BadRequestException('缺少报名定位参数');
    }

    const deletedSignup = await this.dataSource.transaction(async (manager) => {
      const signupRepo = manager.getRepository(DailySignup);
      const where: any = signupId
        ? { id: signupId, userId }
        : { userId, baseId, workDate };

      const signup = await signupRepo.findOne({
        where,
        lock: { mode: 'pessimistic_write' },
      });

      if (!signup) {
        throw new NotFoundException('未找到可取消的报名记录');
      }

      if (signup.status === SignupStatus.CHECKED_IN) {
        throw new BadRequestException('已签到记录不可取消');
      }
      if (signup.status === SignupStatus.ABSENT) {
        throw new BadRequestException('缺勤记录不可取消');
      }

      await signupRepo.delete({ id: signup.id });
      return signup;
    });

    await this.operationLogService.logWithContext({
      operationType: OperationType.DELETE,
      resourceType: ResourceType.SIGNUP,
      resourceId: deletedSignup.id,
      userId,
      request: context?.request,
      description: `取消报名并删除记录: signupId=${deletedSignup.id}, baseId=${deletedSignup.baseId}, jobId=${deletedSignup.jobId}`,
      beforeData: {
        id: deletedSignup.id,
        userId: deletedSignup.userId,
        baseId: deletedSignup.baseId,
        jobId: deletedSignup.jobId,
        workDate: deletedSignup.workDate,
        status: deletedSignup.status,
        isProxy: deletedSignup.isProxy,
      },
      afterData: {
        deleted: true,
      },
    });

    return {
      success: true,
      deleted: true,
      signupId: deletedSignup.id,
      baseId: deletedSignup.baseId,
      jobId: deletedSignup.jobId,
      workDate: deletedSignup.workDate,
    };
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
      baseId: r.baseId,
      baseName: r.base?.baseName ?? '-',
      jobId: r.jobId,
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
        workerPhone: r.user?.phone || '-',
        workerIdCard: r.user?.idCard || '-',
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
