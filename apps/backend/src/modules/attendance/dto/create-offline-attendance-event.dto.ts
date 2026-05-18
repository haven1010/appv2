/**
 * Layer: Backend DTO
 * Responsibility: Defines the Create Offline Attendance Event validation contract for data crossing the Attendance module boundary.
 * Notes: Keep comments focused on intent, invariants, side effects, and cross-module contracts.
 */
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';

export class OfflineEvidenceAttachmentDto {
  @ApiProperty({ description: '附件访问地址', example: 'https://api.example.com/uploads/offline-evidence/abc.jpg' })
  @IsString()
  url: string;

  @ApiProperty({ description: '原始文件名', example: 'checkin-proof.jpg' })
  @IsString()
  name: string;

  @ApiProperty({ description: '文件大小（字节）', example: 204800 })
  @IsOptional()
  @IsNumber()
  size?: number;

  @ApiProperty({ description: '文件类型', example: 'image/jpeg' })
  @IsOptional()
  @IsString()
  type?: string;
}

export class CreateOfflineAttendanceEventDto {
  @ApiProperty({ description: '离线端生成的记录ID，用于幂等去重', required: false, example: 'offline-1742812345-001' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  offlineRecordId?: string;

  @ApiProperty({ description: '设备ID，用于幂等和审计', required: false, example: 'field-device-01' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  deviceId?: string;

  @ApiProperty({ description: '工人UID', example: 'UMN4K5B76928C' })
  @IsNotEmpty()
  @IsString()
  workerUid: string;

  @ApiProperty({ description: '基地ID', example: 12 })
  @IsNumber()
  baseId: number;

  @ApiProperty({ description: '岗位ID。未知时可不传，但无法自动补录未报名场景', required: false, example: 14 })
  @IsOptional()
  @IsNumber()
  jobId?: number;

  @ApiProperty({ description: '工作日 YYYY-MM-DD，不传则按 occurredAt/当天推导', required: false, example: '2026-03-24' })
  @IsOptional()
  @IsString()
  workDate?: string;

  @ApiProperty({ description: '实际发生时间', required: false, example: '2026-03-24T08:30:00.000Z' })
  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @ApiProperty({ description: '补录说明', required: false, example: '山区网络中断，回网后补传' })
  @IsOptional()
  @IsString()
  evidenceNote?: string;

  @ApiProperty({ description: '证据附件列表', required: false, type: [OfflineEvidenceAttachmentDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OfflineEvidenceAttachmentDto)
  evidenceAttachments?: OfflineEvidenceAttachmentDto[];
}
