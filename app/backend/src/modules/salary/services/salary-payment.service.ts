/**
 * Layer: Backend Service
 * Responsibility: Implements the Salary Payment application service for the Salary module, including business rules, side effects, and persistence coordination.
 * Notes: Keep comments focused on intent, invariants, side effects, and cross-module contracts.
 */
import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SalaryPayment, PaymentMethod, PaymentStatus } from '../entities/salary-payment.entity';
import { LaborSalary, SalaryStatus } from '../entities/labor-salary.entity';
import { OperationLogService } from '../../common/services/operation-log.service';
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
  ): Promise<SalaryPayment> {
    const salary = await this.salaryRepo.findOne({ where: { id: salaryId } });
    if (!salary) {
      throw new NotFoundException('工资记录不存在');
    }

    if (salary.status !== SalaryStatus.CONFIRMED) {
      throw new BadRequestException('工资记录未确认，无法创建支付记录');
    }

    const existingPayment = await this.paymentRepo.findOne({ where: { salaryId } });
    if (existingPayment) {
      throw new BadRequestException('该工资记录已存在支付单');
    }

    const payment = this.paymentRepo.create({
      salaryId,
      paymentMethod,
      status: PaymentStatus.PENDING,
      paidBy,
    });

    const saved = await this.paymentRepo.save(payment);

    this.operationLogService.log(
      OperationType.PAYMENT,
      ResourceType.SALARY,
      salaryId,
      paidBy,
      `创建薪资支付: salaryId=${salaryId}, method=${paymentMethod}`,
    ).catch(() => {});

    return saved;
  }

  /**
   * 记录支付确认签字图，通常用于纸面或电子签收回执回填。
   */
  async confirmPayment(
    paymentId: number,
    signatureUrl: string,
  ): Promise<SalaryPayment> {
    const payment = await this.paymentRepo.findOne({ where: { id: paymentId } });
    if (!payment) {
      throw new NotFoundException('支付记录不存在');
    }

    payment.status = PaymentStatus.CONFIRMED;
    payment.confirmSignatureUrl = signatureUrl;

    return this.paymentRepo.save(payment);
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
  ): Promise<SalaryPayment> {
    const payment = await this.paymentRepo.findOne({ where: { id: paymentId } });
    if (!payment) {
      throw new NotFoundException('支付记录不存在');
    }

    payment.status = PaymentStatus.PAID;
    payment.paymentVoucherUrl = voucherUrl;
    payment.paidAt = new Date();
    payment.paidBy = paidBy;

    // 更新工资记录状态
    const salary = await this.salaryRepo.findOne({ where: { id: payment.salaryId } });
    if (salary) {
      salary.status = SalaryStatus.PAID;
      await this.salaryRepo.save(salary);
    }

    const saved = await this.paymentRepo.save(payment);

    this.operationLogService.log(
      OperationType.PAYMENT,
      ResourceType.SALARY,
      payment.salaryId,
      paidBy,
      `完成薪资支付: paymentId=${paymentId}`,
    ).catch(() => {});

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
