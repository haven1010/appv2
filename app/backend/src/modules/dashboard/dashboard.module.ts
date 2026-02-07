import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { SysUser } from '../user/entities/sys-user.entity';
import { BaseInfo } from '../base/entities/base-info.entity';
import { DailySignup } from '../attendance/entities/daily-signup.entity';
import { LaborSalary } from '../salary/entities/labor-salary.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([SysUser, BaseInfo, DailySignup, LaborSalary]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
