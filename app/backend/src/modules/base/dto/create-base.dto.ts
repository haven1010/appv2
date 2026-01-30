
import { IsString, IsEnum, IsNumber, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { BaseCategory } from '../entities/base-info.entity';

export class CreateBaseDto {
  @ApiProperty({ example: '青山湖草莓采摘园' })
  @IsString()
  baseName: string;

  @ApiProperty({ example: 'https://cos.url/license.jpg', description: '营业执照URL' })
  @IsString()
  licenseUrl: string;

  @ApiProperty({ example: '13800138000' })
  @IsString()
  contactPhone: string;

  @ApiProperty({ enum: BaseCategory, example: 1 })
  @IsEnum(BaseCategory)
  category: BaseCategory;

  @ApiProperty({ example: 330100 })
  @IsNumber()
  regionCode: number;

  @ApiProperty({ example: '杭州市临安区xxx路', required: false })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ example: '{"video": "...", "vr": "..."}', required: false })
  @IsOptional()
  @IsString()
  description?: string;
}
