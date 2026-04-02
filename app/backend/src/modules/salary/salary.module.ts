/**
 * Layer: Backend Module
 * Responsibility: Defines provider wiring, repository exposure, and dependency composition for the Salary module.
 * Notes: Keep comments focused on intent, invariants, side effects, and cross-module contracts.
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LaborSalary } from './entities/labor-salary.entity';
import { SalaryPayment } from './entities/salary-payment.entity';
import { SalaryReportSubmission } from './entities/salary-report-submission.entity';
import { SalaryService } from './salary.service';
import { SalaryPaymentService } from './services/salary-payment.service';
import { SalaryAutoDraftService } from './services/salary-auto-draft.service';
import { SalaryReportService } from './services/salary-report.service';
import { SalaryController } from './salary.controller';
import { DailySignup } from '../attendance/entities/daily-signup.entity';
import { SysUser } from '../user/entities/sys-user.entity';
import { BaseModule } from '../base/base.module';

@Module({
    imports: [TypeOrmModule.forFeature([LaborSalary, SalaryPayment, SalaryReportSubmission, DailySignup, SysUser]), BaseModule],
    controllers: [SalaryController],
    providers: [SalaryService, SalaryPaymentService, SalaryAutoDraftService, SalaryReportService],
    exports: [SalaryService, SalaryPaymentService, SalaryAutoDraftService, SalaryReportService],
})
export class SalaryModule { }
