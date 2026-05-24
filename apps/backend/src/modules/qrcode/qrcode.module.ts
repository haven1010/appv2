/**
 * Layer: Backend Module
 * Responsibility: Defines provider wiring, repository exposure, and dependency composition for the Qrcode module.
 * Notes: Keep comments focused on intent, invariants, side effects, and cross-module contracts.
 */
import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { QrCodeService } from './qrcode.service';

@Module({
  imports: [CommonModule],
  providers: [QrCodeService],
  exports: [QrCodeService],
})
export class QrCodeModule {}

