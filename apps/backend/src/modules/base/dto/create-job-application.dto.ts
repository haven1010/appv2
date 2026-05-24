/**
 * Layer: Backend DTO
 * Responsibility: Defines the Create Job Application validation contract for data crossing the Base module boundary.
 * Notes: Keep comments focused on intent, invariants, side effects, and cross-module contracts.
 */
import { IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateJobApplicationDto {
  @ApiProperty({ description: '岗位ID', example: 1 })
  @IsNumber()
  jobId: number;

  @ApiProperty({ description: '基地ID', example: 1 })
  @IsNumber()
  baseId: number;

  @ApiProperty({ description: '申请备注', required: false })
  @IsOptional()
  @IsString()
  note?: string;
}
