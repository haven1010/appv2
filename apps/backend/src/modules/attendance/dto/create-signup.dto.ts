/**
 * Layer: Backend DTO
 * Responsibility: Defines the Create Signup validation contract for data crossing the Attendance module boundary.
 * Notes: Keep comments focused on intent, invariants, side effects, and cross-module contracts.
 */
import { IsNotEmpty, IsNumber, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSignupDto {
    @ApiProperty({ description: '基地ID', example: 1 })
    @IsNotEmpty()
    @IsNumber()
    baseId: number;

    @ApiProperty({ description: '岗位ID', example: 1 })
    @IsNotEmpty()
    @IsNumber()
    jobId: number;

    @ApiProperty({ description: '报名日期 (不填默认今天)', example: '2025-12-21', required: false })
    @IsOptional()
    @IsDateString()
    workDate?: string;
}