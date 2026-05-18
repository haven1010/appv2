/**
 * Layer: Backend Module
 * Responsibility: Defines provider wiring, repository exposure, and dependency composition for the Attendance module.
 * Notes: Keep comments focused on intent, invariants, side effects, and cross-module contracts.
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { DailySignup } from './entities/daily-signup.entity';
import { OfflineAttendanceEvent } from './entities/offline-attendance-event.entity';
import { SysUser } from '../user/entities/sys-user.entity';
import { RecruitmentJob } from '../base/entities/recruitment-job.entity';
import { BaseInfo } from '../base/entities/base-info.entity';
import { QrCodeModule } from '../qrcode/qrcode.module';
import { BaseModule } from '../base/base.module';

@Module({
    imports: [
        // 注册实体 Repository
        TypeOrmModule.forFeature([DailySignup, OfflineAttendanceEvent, SysUser, RecruitmentJob, BaseInfo]),
        QrCodeModule,
        BaseModule,
    ],
    controllers: [AttendanceController],
    providers: [AttendanceService],
    exports: [AttendanceService],
})
export class AttendanceModule { }
