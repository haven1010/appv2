/**
 * Layer: Backend Service
 * Responsibility: Implements the Salary Payment application service for the Salary module, including business rules, side effects, and persistence coordination.
 * Notes: Keep comments focused on intent, invariants, side effects, and cross-module contracts.
 */
import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { SalaryPayment, PaymentMethod, PaymentStatus } from '../entities/salary-payment.entity';
import { LaborSalary, SalaryStatus } from '../entities/labor-salary.entity';
import { OperationLogService, OperationLogContext } from '../../common/services/operation-log.service';
import { OperationType, ResourceType } from '../../common/entities/operation-log.entity';
import { SmsService } from '../../common/services/sms.service';

@Injectable()
export class SalaryPaymentService {
  private readonly logger = new Logger(SalaryPaymentService.name);

  constructor(
    @InjectRepository(SalaryPayment)
    private paymentRepo: Repository<SalaryPayment>,
    @InjectRepository(LaborSalary)
    private salaryRepo: Repository<LaborSalary>,
    private dataSource: DataSource,
    private operationLogService: OperationLogService,
    private smsService: SmsService,
  ) {}

  private async sendPaidNotification(
    paymentId: number,
    notifyContext: {
      phone?: string;
      amount?: number;
      bankName?: string;
      bankCardNo?: string;
      paidAt?: string;
      baseName?: string;
      jobTitle?: string;
    } | null,
  ) {
    if (!notifyContext?.phone) {
      return;
    }

    const bankCardLast4 = String(notifyContext.bankCardNo || '').replace(/\D/g, '').slice(-4);
    await this.smsService.sendSalaryPaidNotification(notifyContext.phone, {
      amount: Number(notifyContext.amount || 0),
      bankName: notifyContext.bankName || '银行卡',
      bankCardLast4,
      paidAt: notifyContext.paidAt,
      baseName: notifyContext.baseName,
      jobTitle: notifyContext.jobTitle,
    }).catch((error) => {
      this.logger.warn(`工资到账提醒发送失败: paymentId=${paymentId}, error=${error?.message || error}`);
    });
  }

  async createPayment(
    salaryId: number,
    paymentMethod: PaymentMethod,
    paidBy: number,
    context?: OperationLogContext,
  ): Promise<SalaryPayment> {
    const saved = await this.dataSource.transaction(async (manager) => {
      const salary = await manager.findOne(LaborSalary, {
        where: { id: salaryId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!salary) {
        throw new NotFoundException('工资记录不存在');
      }

      if (salary.status !== SalaryStatus.CONFIRMED) {
        throw new BadRequestException('工资记录未确认，无法创建支付记录');
      }

      const existingPayment = await manager.findOne(SalaryPayment, {
        where: { salaryId },
        lock: { mode: 'pessimistic_write' },
      });
      if (existingPayment) {
        throw new BadRequestException('该工资记录已存在支付单');
      }

      const payment = manager.create(SalaryPayment, {
        salaryId,
        paymentMethod,
        status: PaymentStatus.PENDING,
        paidBy,
      });

      try {
        return await manager.save(SalaryPayment, payment);
      } catch (error) {
        if (error?.code === 'ER_DUP_ENTRY') {
          throw new BadRequestException('该工资记录已存在支付单');
        }
        throw error;
      }
    });

    await this.operationLogService.logWithContext({
      operationType: OperationType.PAYMENT,
      resourceType: ResourceType.SALARY,
      resourceId: salaryId,
      userId: paidBy,
      request: context?.request,
      description: `创建薪资支付: salaryId=${salaryId}, method=${paymentMethod}`,
      afterData: {
        paymentId: saved.id,
        status: saved.status,
        paymentMethod: saved.paymentMethod,
      },
    });

    return saved;
  }

  async confirmPayment(
    paymentId: number,
    signatureUrl: string,
    paidBy?: number,
    context?: OperationLogContext,
  ): Promise<SalaryPayment> {
    const { saved, beforeStatus } = await this.dataSource.transaction(async (manager) => {
      const payment = await manager.findOne(SalaryPayment, {
        where: { id: paymentId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!payment) {
        throw new NotFoundException('支付记录不存在');
      }
      if (payment.status !== PaymentStatus.PENDING) {
        throw new BadRequestException('该支付记录当前状态不允许确认');
      }

      const previousStatus = payment.status;
      payment.status = PaymentStatus.CONFIRMED;
      payment.confirmSignatureUrl = signatureUrl;

      const next = await manager.save(SalaryPayment, payment);
      return { saved: next, beforeStatus: previousStatus };
    });

    await this.operationLogService.logWithContext({
      operationType: OperationType.UPDATE,
      resourceType: ResourceType.SALARY,
      resourceId: saved.salaryId,
      userId: paidBy,
      request: context?.request,
      description: `确认薪资支付: paymentId=${saved.id}`,
      beforeData: {
        paymentId: saved.id,
        status: beforeStatus,
      },
      afterData: {
        paymentId: saved.id,
        status: saved.status,
        confirmSignatureUrl: saved.confirmSignatureUrl,
      },
    });

    return saved;
  }

  async completePayment(
    paymentId: number,
    voucherUrl: string,
    paidBy: number,
    context?: OperationLogContext,
  ): Promise<SalaryPayment> {
    const { saved, beforeStatus, notifyContext } = await this.dataSource.transaction(async (manager) => {
      const paymentRepo = manager.getRepository(SalaryPayment);
      const salaryRepo = manager.getRepository(LaborSalary);

      const payment = await paymentRepo.findOne({
        where: { id: paymentId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!payment) {
        throw new NotFoundException('支付记录不存在');
      }
      if (payment.status !== PaymentStatus.CONFIRMED) {
        throw new BadRequestException('该支付记录当前状态不允许完成发放');
      }

      const previousStatus = payment.status;
      payment.status = PaymentStatus.PAID;
      payment.paymentVoucherUrl = voucherUrl;
      payment.paidAt = new Date();
      payment.paidBy = paidBy;

      const salary = await salaryRepo.findOne({
        where: { id: payment.salaryId },
        relations: ['signup', 'signup.user', 'signup.base', 'signup.job'],
        lock: { mode: 'pessimistic_write' },
      });
      if (!salary) {
        throw new NotFoundException('工资记录不存在');
      }
      if (salary.status !== SalaryStatus.CONFIRMED) {
        throw new BadRequestException('工资记录当前状态不允许发放');
      }

      salary.status = SalaryStatus.PAID;
      await salaryRepo.save(salary);

      const signup = salary.signup as any;
      const worker = signup?.user || null;
      const notify = worker
        ? {
            phone: worker.phone,
            amount: Number(salary.totalAmount || 0),
            bankName: worker.bankName || '',
            bankCardNo: worker.bankCardNo || '',
            paidAt: payment.paidAt ? payment.paidAt.toISOString() : '',
            baseName: signup?.base?.baseName || '',
            jobTitle: signup?.job?.jobTitle || '',
          }
        : null;

      const next = await paymentRepo.save(payment);
      return { saved: next, beforeStatus: previousStatus, notifyContext: notify };
    });

    await this.operationLogService.logWithContext({
      operationType: OperationType.PAYMENT,
      resourceType: ResourceType.SALARY,
      resourceId: saved.salaryId,
      userId: paidBy,
      request: context?.request,
      description: `完成薪资支付: paymentId=${paymentId}`,
      beforeData: {
        paymentId,
        status: beforeStatus,
      },
      afterData: {
        paymentId: saved.id,
        status: saved.status,
        paidAt: saved.paidAt,
        paymentVoucherUrl: saved.paymentVoucherUrl,
      },
    });

    await this.sendPaidNotification(paymentId, notifyContext);

    return saved;
  }

  async settleSalary(
    salaryId: number,
    paymentMethod: PaymentMethod | undefined,
    paidBy: number,
    context?: OperationLogContext,
    paymentVoucherUrl?: string,
  ): Promise<SalaryPayment> {
    const { saved, beforeSalaryStatus, beforePaymentStatus, notifyContext } = await this.dataSource.transaction(async (manager) => {
      const paymentRepo = manager.getRepository(SalaryPayment);
      const salaryRepo = manager.getRepository(LaborSalary);

      const salary = await salaryRepo.findOne({
        where: { id: salaryId },
        relations: ['signup', 'signup.user', 'signup.base', 'signup.job'],
        lock: { mode: 'pessimistic_write' },
      });
      if (!salary) {
        throw new NotFoundException('工资记录不存在');
      }

      const signup = salary.signup as any;
      const ownerId = Number(signup?.base?.ownerId || 0);
      if (!ownerId || ownerId !== Number(paidBy || 0)) {
        throw new ForbiddenException('无权结算该工资单');
      }

      if (salary.status === SalaryStatus.PAID) {
        throw new BadRequestException('该工资单已结算');
      }
      if (salary.status !== SalaryStatus.CONFIRMED) {
        throw new BadRequestException('工人确认后才能结算工资');
      }

      const existingPayment = await paymentRepo.findOne({
        where: { salaryId },
        lock: { mode: 'pessimistic_write' },
      });
      if (existingPayment?.status === PaymentStatus.CANCELLED) {
        throw new BadRequestException('该工资单支付单已取消，无法继续结算');
      }

      const beforeStatus = salary.status;
      const beforePayment = existingPayment?.status ?? null;
      const nextMethod = paymentMethod || existingPayment?.paymentMethod || PaymentMethod.TRANSFER;
      const payment = existingPayment || paymentRepo.create({ salaryId });
      const nextVoucherUrl = String(paymentVoucherUrl || '').trim() || existingPayment?.paymentVoucherUrl || '';

      payment.paymentMethod = nextMethod;
      payment.status = PaymentStatus.PAID;
      payment.paymentVoucherUrl = nextVoucherUrl;
      payment.paidAt = new Date();
      payment.paidBy = paidBy;

      salary.status = SalaryStatus.PAID;
      await salaryRepo.save(salary);

      const savedPayment = await paymentRepo.save(payment);
      const worker = signup?.user || null;
      const notify = worker
        ? {
            phone: worker.phone,
            amount: Number(salary.totalAmount || 0),
            bankName: worker.bankName || '',
            bankCardNo: worker.bankCardNo || '',
            paidAt: savedPayment.paidAt ? savedPayment.paidAt.toISOString() : '',
            baseName: signup?.base?.baseName || '',
            jobTitle: signup?.job?.jobTitle || '',
          }
        : null;

      return {
        saved: savedPayment,
        beforeSalaryStatus: beforeStatus,
        beforePaymentStatus: beforePayment,
        notifyContext: notify,
      };
    });

    await this.operationLogService.logWithContext({
      operationType: OperationType.PAYMENT,
      resourceType: ResourceType.SALARY,
      resourceId: salaryId,
      userId: paidBy,
      request: context?.request,
      description: `老板结算工资: salaryId=${salaryId}, method=${saved.paymentMethod}`,
      beforeData: {
        salaryStatus: beforeSalaryStatus,
        paymentStatus: beforePaymentStatus,
      },
      afterData: {
        paymentId: saved.id,
        paymentMethod: saved.paymentMethod,
        paymentStatus: saved.status,
        salaryStatus: SalaryStatus.PAID,
        paidAt: saved.paidAt,
        paymentVoucherUrl: saved.paymentVoucherUrl || null,
      },
    });

    await this.sendPaidNotification(saved.id, notifyContext);

    return saved;
  }

  async getPaymentsBySalary(salaryId: number): Promise<SalaryPayment[]> {
    return this.paymentRepo.find({
      where: { salaryId },
      order: { createdAt: 'DESC' },
    });
  }
}
