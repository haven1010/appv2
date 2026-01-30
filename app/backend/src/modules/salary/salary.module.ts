import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LaborSalary } from './entities/labor-salary.entity';
import { SalaryPayment } from './entities/salary-payment.entity';
import { SalaryService } from './salary.service';
import { SalaryPaymentService } from './services/salary-payment.service';
import { DailySignup } from '../attendance/entities/daily-signup.entity';

@Module({
    imports: [TypeOrmModule.forFeature([LaborSalary, SalaryPayment, DailySignup])],
    providers: [SalaryService, SalaryPaymentService],
    exports: [SalaryService, SalaryPaymentService],
})
export class SalaryModule { }
