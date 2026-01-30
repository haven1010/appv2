import { Injectable, BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DailySignup, SignupStatus } from './entities/daily-signup.entity';
import { SecurityService } from '../common/services/security.service';
import { SysUser } from '../user/entities/sys-user.entity';
import { RecruitmentJob } from '../base/entities/recruitment-job.entity';
import { SmsService } from '../common/services/sms.service';
import { QrCodeService } from '../qrcode/qrcode.service';

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  constructor(
    @InjectRepository(DailySignup)
    private signupRepo: Repository<DailySignup>,
    @InjectRepository(SysUser)
    private userRepo: Repository<SysUser>,
    @InjectRepository(RecruitmentJob)
    private jobRepo: Repository<RecruitmentJob>,
    private securityService: SecurityService,
    private smsService: SmsService,
    private qrcodeService: QrCodeService,
  ) { }

  /**
   * 辅助方法：获取当前本地日期的 YYYY-MM-DD 格式
   */
  private getTodayDateString(): string {
    const date = new Date();
    // 简单处理：减去时区偏差 (适用于服务器时间正确的情况)
    const offset = date.getTimezoneOffset() * 60000;
    const localDate = new Date(date.getTime() - offset);
    return localDate.toISOString().split('T')[0];
  }

  /**
   * 生成身份码
   * 格式: Encrypted(UID|Timestamp)
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
   * 处理现场扫码签到
   */
  async checkIn(qrContent: string, baseId: number): Promise<DailySignup> {
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
    if (signup.status === SignupStatus.CHECKED_IN) {
      // 如果已经签到，直接返回记录
      return signup;
    }

    signup.status = SignupStatus.CHECKED_IN;
    signup.checkinTime = new Date();

    const saved = await this.signupRepo.save(signup);
    // 【修复】日志改为使用 name 和 uid
    this.logger.log(`[签到成功] 用户: ${user.name} (UID: ${user.uid}), 基地ID: ${baseId}`);
    return saved;
  }

  /**
   * 处理离线批量同步
   */
  async syncOfflineRecords(records: any[], adminId: number) {
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

        const signup = await this.signupRepo.findOne({
          where: { userId: user.id, baseId: record.baseId, workDate: dateToSync }
        });

        if (signup) {
          if (signup.status === SignupStatus.CHECKED_IN) {
            results.push({ uid: record.uid, status: 'skipped', msg: 'Already checked in' });
          } else {
            signup.status = SignupStatus.CHECKED_IN;
            signup.checkinTime = record.checkinTime ? new Date(record.checkinTime) : new Date();
            signup.isOfflineSync = true;
            await this.signupRepo.save(signup);
            results.push({ uid: record.uid, status: 'success' });
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

  async signup(userId: number, dto: any): Promise<DailySignup> {
    const { baseId, jobId, proxyUserIds } = dto;
    // 如果没传日期，默认报今天的名
    const workDate = dto.workDate || this.getTodayDateString();

    // 1. 检查岗位是否存在且在招聘中
    const job = await this.jobRepo.findOne({ where: { id: jobId, baseId } });
    if (!job) {
      throw new NotFoundException('该基地不存在此招聘岗位');
    }
    if (!job.isActive) {
      throw new BadRequestException('该岗位已停止招聘');
    }

    // 2. 检查是否重复报名
    const existing = await this.signupRepo.findOne({
      where: {
        userId,
        baseId,
        workDate, // 限制同一天同一个基地只能报一次
      }
    });

    if (existing) {
      throw new BadRequestException('您今日已报名该基地，请勿重复操作');
    }

    // 3. 创建报名记录
    const signup = this.signupRepo.create({
      userId,
      baseId,
      jobId,
      workDate,
      status: 0, // 0 = 已报名
      isProxy: false,
    });

    const savedSignup = await this.signupRepo.save(signup);

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

    // 5. 处理代报名（一人替最多两人报名）
    if (proxyUserIds && Array.isArray(proxyUserIds) && proxyUserIds.length > 0) {
      if (proxyUserIds.length > 2) {
        throw new BadRequestException('最多只能代两人报名');
      }

      for (const proxyUserId of proxyUserIds) {
        // 检查被代报人是否已报名
        const proxyExisting = await this.signupRepo.findOne({
          where: {
            userId: proxyUserId,
            baseId,
            workDate,
          }
        });

        if (!proxyExisting) {
          const proxySignup = this.signupRepo.create({
            userId: proxyUserId,
            baseId,
            jobId,
            workDate,
            status: 0,
            isProxy: true,
            proxyUserId: userId,
          });
          await this.signupRepo.save(proxySignup);
        }
      }
    }

    return savedSignup;
  }
}