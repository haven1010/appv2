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