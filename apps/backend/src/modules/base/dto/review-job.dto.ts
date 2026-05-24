/**
 * Layer: Backend DTO
 * Responsibility: Defines the manager review payload for boss-published jobs.
 */
import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString } from 'class-validator';

export class ReviewJobDto {
  @ApiProperty({ description: '审核状态：1-通过，2-驳回', example: 1 })
  @IsInt()
  status: number;

  @ApiProperty({ description: '审核备注', required: false })
  @IsOptional()
  @IsString()
  reason?: string;
}
