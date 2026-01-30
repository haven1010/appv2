import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { DailySignup } from './entities/daily-signup.entity';
import { SysUser } from '../user/entities/sys-user.entity';
import { RecruitmentJob } from '../base/entities/recruitment-job.entity';
import { QrCodeModule } from '../qrcode/qrcode.module';

@Module({
    imports: [
        // 注册实体 Repository
        TypeOrmModule.forFeature([DailySignup, SysUser, RecruitmentJob]),
        QrCodeModule,
    ],
    controllers: [AttendanceController],
    providers: [AttendanceService],
    exports: [AttendanceService],
})
export class AttendanceModule { }