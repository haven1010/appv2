/**
 * Layer: Backend DTO
 * Responsibility: Defines the supervisor-assignment payload for a base.
 */
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsInt, IsOptional } from 'class-validator';

export class SetBaseSupervisorsDto {
  @ApiPropertyOptional({ type: [Number], description: '基地管理员用户 ID 列表' })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  baseManagerIds?: number[];

  @ApiPropertyOptional({ type: [Number], description: '现场管理员用户 ID 列表' })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  fieldManagerIds?: number[];
}
