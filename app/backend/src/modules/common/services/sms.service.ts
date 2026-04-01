/**
 * Layer: Backend Service
 * Responsibility: Implements the Sms application service for the Common module, including business rules, side effects, and persistence coordination.
 * Notes: Keep comments focused on intent, invariants, side effects, and cross-module contracts.
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(private configService: ConfigService) {}

  /**
   * 发送报名确认短信
   * @param phone 手机号
   * @param qrCodeUrl 二维码链接
   * @param baseName 基地名称
   * @param workDate 工作日期
   */
  async sendSignupConfirmation(
    phone: string,
    qrCodeUrl: string,
    baseName: string,
    workDate: string,
  ): Promise<boolean> {
    try {
      // 这里可以集成腾讯云SMS、阿里云SMS等
      // 示例：使用腾讯云SMS
      const smsEnabled = this.configService.get<string>('SMS_ENABLED') === 'true';
      
      if (!smsEnabled) {
        this.logger.log(`[短信模拟] 发送报名确认短信到 ${phone}`);
        this.logger.log(`内容: 您已成功报名${baseName}的${workDate}工作，签到二维码：${qrCodeUrl}`);
        return true;
      }

      // TODO: 集成真实的短信服务
      // const tencentCloud = require('tencentcloud-sdk-nodejs');
      // const smsClient = new tencentCloud.sms.v20210111.Client({...});
      // await smsClient.SendSms({...});

      this.logger.log(`[短信] 发送报名确认短信到 ${phone}`);
      return true;
    } catch (error) {
      this.logger.error(`[短信] 发送失败: ${error.message}`);
      return false;
    }
  }

  /**
   * 发送审核结果通知
   */
  async sendAuditNotification(phone: string, approved: boolean, reason?: string): Promise<boolean> {
    try {
      const message = approved 
        ? '您的信息审核已通过'
        : `您的信息审核未通过，原因：${reason || '信息不完整'}`;
      
      this.logger.log(`[短信] 发送审核通知到 ${phone}: ${message}`);
      return true;
    } catch (error) {
      this.logger.error(`[短信] 发送失败: ${error.message}`);
      return false;
    }
  }

  /**
   * 发送工资到账提醒（银行卡转账场景）。
   */
  async sendSalaryPaidNotification(
    phone: string,
    payload: {
      amount: number;
      bankName?: string;
      bankCardLast4?: string;
      paidAt?: string;
      baseName?: string;
      jobTitle?: string;
    },
  ): Promise<boolean> {
    try {
      const amountText = Number(payload?.amount || 0).toFixed(2);
      const bankName = payload?.bankName || '银行卡';
      const bankCardLast4 = payload?.bankCardLast4 ? `尾号${payload.bankCardLast4}` : '';
      const paidAt = payload?.paidAt || '';
      const baseName = payload?.baseName || '基地';
      const jobTitle = payload?.jobTitle || '岗位';

      this.logger.log(`[短信] 发送工资到账提醒到 ${phone}`);
      this.logger.log(`内容: 您在${baseName}-${jobTitle}的工资 ¥${amountText} 已到账（${bankName}${bankCardLast4}），时间：${paidAt}`);
      return true;
    } catch (error) {
      this.logger.error(`[短信] 工资到账提醒发送失败: ${error.message}`);
      return false;
    }
  }
}
