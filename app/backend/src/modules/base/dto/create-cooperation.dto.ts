import { IsNumber, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCooperationDto {
  @ApiProperty({ description: '基地ID', example: 1 })
  @IsNumber()
  baseId: number;

  @ApiProperty({ description: '合作需求描述（工种、人数、周期等）', example: '需要10名水果采摘工，工作周期7天' })
  @IsString()
  requirement: string;
}
