import { IsString, IsOptional, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateUserDto {
  @ApiProperty({ example: '张三', description: '真实姓名', required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ example: '13800138000', description: '手机号', required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ example: '李四-配偶', description: '紧急联系人（姓名及关系）', required: false })
  @IsOptional()
  @IsString()
  emergencyContact?: string;

  @ApiProperty({ example: '13900139000', description: '紧急联系人电话', required: false })
  @IsOptional()
  @IsString()
  emergencyPhone?: string;

  @ApiProperty({ example: 'https://bucket.cos.region.myqcloud.com/face.jpg', required: false })
  @IsOptional()
  @IsString()
  faceImgUrl?: string;

  @ApiProperty({ example: 1, required: false, description: '关联基地ID（现场管理员专用）' })
  @IsOptional()
  @IsNumber()
  assignedBaseId?: number;
}
