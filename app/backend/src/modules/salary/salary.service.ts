
import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LaborSalary, SalaryStatus } from './entities/labor-salary.entity';
import { DailySignup, SignupStatus } from '../attendance/entities/daily-signup.entity';
import { SalaryCalculatorFactory } from './services/salary-calculator.strategy';

@Injectable()
export class SalaryService {
  constructor(
    @InjectRepository(LaborSalary)
    private salaryRepo: Repository<LaborSalary>,
    @InjectRepository(DailySignup)
    private signupRepo: Repository<DailySignup>,
  ) {}

  async calculateAndDraft(signupId: number, input: { duration?: number; count?: number }, adminId: number) {
    const signup = await this.signupRepo.findOne({ where: { id: signupId }, relations: ['job'] });
    if (!signup) throw new BadRequestException('Signup record not found');
    if (signup.status !== SignupStatus.CHECKED_IN) throw new BadRequestException('Worker has not checked in');

    const job = signup.job;
    const strategy = SalaryCalculatorFactory.getStrategy(job.payType);
    
    const amount = strategy.calculate({
      unitPrice: job.unitPrice,
      workDuration: input.duration,
      pieceCount: input.count,
    });

    let salaryRecord = await this.salaryRepo.findOne({ where: { signupId } });
    if (!salaryRecord) {
      salaryRecord = new LaborSalary();
      salaryRecord.signupId = signupId;
    }

    salaryRecord.unitPriceSnapshot = job.unitPrice;
    salaryRecord.workDuration = input.duration || 0;
    salaryRecord.pieceCount = input.count || 0;
    salaryRecord.totalAmount = amount;
    salaryRecord.status = SalaryStatus.PENDING;
    salaryRecord.adminId = adminId;

    return this.salaryRepo.save(salaryRecord);
  }
}
