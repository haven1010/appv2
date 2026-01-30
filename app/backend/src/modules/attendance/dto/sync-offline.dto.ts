import { IsNotEmpty, IsString, IsNumber, IsArray, ValidateNested, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class OfflineRecordDto {
    @ApiProperty({ description: '用户UID', example: 'U123456' })
    @IsNotEmpty()
    @IsString()
    uid: string;

    @ApiProperty({ description: '基地ID', example: 1 })
    @IsNotEmpty()
    @IsNumber()
    baseId: number;

    @ApiProperty({ description: '签到时间', example: '2025-12-21T08:30:00.000Z' })
    @IsOptional()
    @IsDateString()
    checkinTime?: string;

    @ApiProperty({ description: '工作日期 (YYYY-MM-DD)', example: '2025-12-21', required: false })
    @IsOptional()
    @IsString()
    date?: string;
}

export class SyncOfflineDto {
    @ApiProperty({ type: [OfflineRecordDto], description: '离线签到记录列表' })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => OfflineRecordDto)
    records: OfflineRecordDto[];
}