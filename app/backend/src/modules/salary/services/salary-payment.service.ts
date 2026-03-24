/**
 * Layer: Backend Service
 * Responsibility: Implements the Salary Payment application service for the Salary module, including business rules, side effects, and persistence coordination.
 * Notes: Keep comments focused on intent, invariants, side effects, and cross-module contracts.
 */
import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { SalaryPayment, PaymentMethod, PaymentStatus } from '../entities/salary-payment.entity';
import { LaborSalary, SalaryStatus } from '../entities/labor-salary.entity';
import { OperationLogService, OperationLogContext } from '../../common/services/operation-log.service';
import { OperationType, ResourceType } from '../../common/entities/operation-log.entity';

@Injectable()
/**
 * 支付单服务负责工资支付记录创建、签收确认和最终打款完成流转。
 * 它保证支付单与工资单状态保持一致，并补齐支付操作日志。
 */
export class SalaryPaymentService {
  private readonly logger = new Logger(SalaryPaymentService.name);

  constructor(
    @InjectRepository(SalaryPayment)
    private paymentRepo: Repository<SalaryPayment>,
    @InjectRepository(LaborSalary)
    private salaryRepo: Repository<LaborSalary>,
    private dataSource: DataSource,
    private operationLogService: OperationLogService,
  ) {}

  /**
   * 为已确认的工资单创建唯一支付单。
   * 前置条件: 工资状态必须已经由工人确认，且当前工资单尚未存在支付单。
   */
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

  /**
   * 记录支付确认签字图，通常用于纸面或电子签收回执回填。
   */
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

  /**
   * 完成支付并同步工资状态到 `PAID`。
   * 副作用:
   * 1. 写入支付凭证、支付人和支付时间。
   * 2. 联动更新对应工资记录状态。
   * 3. 写入支付操作日志。
   */
  async completePayment(
    paymentId: number,
    voucherUrl: string,
    paidBy: number,
    context?: OperationLogContext,
  ): Promise<SalaryPayment> {
    const { saved, beforeStatus } = await this.dataSource.transaction(async (manager) => {
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

      const next = await paymentRepo.save(payment);
      return { saved: next, beforeStatus: previousStatus };
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

    return saved;
  }

  /**
   * 查询某张工资单关联的支付记录，按时间倒序返回。
   */
  async getPaymentsBySalary(salaryId: number): Promise<SalaryPayment[]> {
    return this.paymentRepo.find({
      where: { salaryId },
      order: { createdAt: 'DESC' },
    });
  }
}
