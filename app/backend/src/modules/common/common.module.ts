
import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { SecurityService } from './services/security.service';
import { TencentCosService } from './services/tencent-cos.service';
import { TencentOcrService } from './services/tencent-ocr.service';
import { SmsService } from './services/sms.service';
import { OperationLogService } from './services/operation-log.service';
import { BackupService } from './services/backup.service';
import { OperationLog } from './entities/operation-log.entity';

@Global() // Make these services available everywhere without re-importing
@Module({
  imports: [
    ConfigModule,
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([OperationLog]),
  ],
  providers: [
    SecurityService,
    TencentCosService,
    TencentOcrService,
    SmsService,
    OperationLogService,
    BackupService,
  ],
  exports: [
    SecurityService,
    TencentCosService,
    TencentOcrService,
    SmsService,
    OperationLogService,
    BackupService,
  ],
})
export class CommonModule {}
