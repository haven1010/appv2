/**
 * Layer: Backend DTO
 * Responsibility: Defines the Create User validation contract for data crossing the User module boundary.
 */
import { IsString, IsEnum, IsOptional, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../entities/sys-user.entity';

export class CreateUserDto {
  @ApiProperty({ example: '张三', description: '真实姓名' })
  @IsString()
  name: string;

  @ApiProperty({ example: '330106199001011234', description: '身份证号' })
  @IsString()
  idCard: string;

  @ApiProperty({ example: '13800138000', description: '手机号' })
  @IsString()
  phone: string;

  @ApiProperty({ example: 'worker', enum: UserRole, description: '角色' })
  @IsOptional()
  @IsEnum(UserRole)
  roleKey?: UserRole;

  @ApiProperty({ example: 'https://bucket.cos.region.myqcloud.com/face.jpg', required: false })
  @IsOptional()
  @IsString()
  faceImgUrl?: string;

  @ApiProperty({ example: 3301, required: false, description: '区域代码（预留）' })
  @IsOptional()
  regionCode?: number;

  @ApiProperty({ example: 1, required: false, description: '绑定基地ID（现场管理员）' })
  @IsOptional()
  @IsNumber()
  assignedBaseId?: number;

  @ApiProperty({ example: '李四-配偶', description: '紧急联系人', required: false })
  @IsOptional()
  @IsString()
  emergencyContact?: string;

  @ApiProperty({ example: '13900139000', description: '紧急联系人电话', required: false })
  @IsOptional()
  @IsString()
  emergencyPhone?: string;

  @ApiProperty({ example: '山东省烟台市福山区演示村 12 号', description: '家庭地址', required: false })
  @IsOptional()
  @IsString()
  homeAddress?: string;

  @ApiProperty({ example: '中国农业银行', description: '开户银行', required: false })
  @IsOptional()
  @IsString()
  bankName?: string;

  @ApiProperty({ example: '6222021234567890', description: '银行卡号', required: false })
  @IsOptional()
  @IsString()
  bankCardNo?: string;
}
