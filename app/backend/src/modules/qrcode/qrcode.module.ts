import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { QrCodeService } from './qrcode.service';

@Module({
  imports: [CommonModule],
  providers: [QrCodeService],
  exports: [QrCodeService],
})
export class QrCodeModule {}

