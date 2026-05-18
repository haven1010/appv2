/**
 * Layer: Backend DTO
 * Responsibility: Defines the Check In validation contract for data crossing the Attendance module boundary.
 * Notes: Keep comments focused on intent, invariants, side effects, and cross-module contracts.
 */
import { IsNotEmpty, IsString, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CheckInDto {
    @ApiProperty({ description: '加密的二维码内容', example: 'a1b2c3d4...' })
    @IsNotEmpty({ message: '二维码内容不能为空' })
    @IsString()
    qrContent: string;

    @ApiProperty({ description: '基地ID', example: 1 })
    @IsNotEmpty({ message: '基地ID不能为空' })
    @IsNumber()
    baseId: number;
}