import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SalaryPayment, PaymentMethod, PaymentStatus } from '../entities/salary-payment.entity';
import { LaborSalary, SalaryStatus } from '../entities/labor-salary.entity';

@Injectable()
export class SalaryPaymentService {
  private readonly logger = new Logger(SalaryPaymentService.name);

  constructor(
    @InjectRepository(SalaryPayment)
    private paymentRepo: Repository<SalaryPayment>,
    @InjectRepository(LaborSalary)
    private salaryRepo: Repository<LaborSalary>,
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

    return this.paymentRepo.save(payment);
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

    return this.paymentRepo.save(payment);
  }

  async getPaymentsBySalary(salaryId: number): Promise<SalaryPayment[]> {
    return this.paymentRepo.find({
      where: { salaryId },
      order: { createdAt: 'DESC' },
    });
  }
}
