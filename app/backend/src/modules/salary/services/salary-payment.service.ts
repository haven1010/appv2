import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SalaryPayment, PaymentMethod, PaymentStatus } from '../entities/salary-payment.entity';
import { LaborSalary, SalaryStatus } from '../entities/labor-salary.entity';
import { OperationLogService } from '../../common/services/operation-log.service';
import { OperationType, ResourceType } from '../../common/entities/operation-log.entity';

@Injectable()
export class SalaryPaymentService {
  private readonly logger = new Logger(SalaryPaymentService.name);

  constructor(
    @InjectRepository(SalaryPayment)
    private paymentRepo: Repository<SalaryPayment>,
    @InjectRepository(LaborSalary)
    private salaryRepo: Repository<LaborSalary>,
    private operationLogService: OperationLogService,
  ) {}

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

  async getPaymentsBySalary(salaryId: number): Promise<SalaryPayment[]> {
    return this.paymentRepo.find({
      where: { salaryId },
      order: { createdAt: 'DESC' },
    });
  }
}
