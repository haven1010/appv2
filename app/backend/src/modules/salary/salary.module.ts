import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LaborSalary } from './entities/labor-salary.entity';
import { SalaryPayment } from './entities/salary-payment.entity';
import { SalaryService } from './salary.service';
import { SalaryPaymentService } from './services/salary-payment.service';
import { SalaryController } from './salary.controller';
import { DailySignup } from '../attendance/entities/daily-signup.entity';
import { BaseInfo } from '../base/entities/base-info.entity';

@Module({
    imports: [TypeOrmModule.forFeature([LaborSalary, SalaryPayment, DailySignup, BaseInfo])],
    controllers: [SalaryController],
    providers: [SalaryService, SalaryPaymentService],
    exports: [SalaryService, SalaryPaymentService],
})
export class SalaryModule { }
