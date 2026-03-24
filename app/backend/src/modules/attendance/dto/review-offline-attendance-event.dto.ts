/**
 * Layer: Backend DTO
 * Responsibility: Defines the Review Offline Attendance Event validation contract for data crossing the Attendance module boundary.
 * Notes: Keep comments focused on intent, invariants, side effects, and cross-module contracts.
 */
import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class ReviewOfflineAttendanceEventDto {
  @ApiProperty({ description: '审核决策', enum: ['approve', 'reject'] })
  @IsIn(['approve', 'reject'])
  decision: 'approve' | 'reject';

  @ApiProperty({ description: '审核备注/拒绝原因', required: false })
  @IsOptional()
  @IsString()
  reason?: string;
}
