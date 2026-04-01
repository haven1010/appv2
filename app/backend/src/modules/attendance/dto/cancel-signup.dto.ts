/**
 * Layer: Backend DTO
 * Responsibility: Defines the Cancel Signup validation contract for data crossing the Attendance module boundary.
 * Notes: Keep comments focused on intent, invariants, side effects, and cross-module contracts.
 */
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional, Min, ValidateIf } from 'class-validator';

export class CancelSignupDto {
  @ApiProperty({ description: '报名记录ID，优先使用该字段定位记录', required: false, example: 1001 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  signupId?: number;

  @ApiProperty({ description: '基地ID（未传 signupId 时必填）', required: false, example: 1 })
  @ValidateIf((dto: CancelSignupDto) => !dto.signupId)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  baseId?: number;

  @ApiProperty({ description: '工作日期，不传默认今天', required: false, example: '2026-04-01' })
  @IsOptional()
  @IsDateString()
  workDate?: string;
}
