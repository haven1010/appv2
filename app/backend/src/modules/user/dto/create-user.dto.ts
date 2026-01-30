
import { IsString, IsEnum, IsOptional } from 'class-validator';
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
  @IsEnum(UserRole)
  roleKey: UserRole;

  @ApiProperty({ example: 'https://bucket.cos.region.myqcloud.com/face.jpg', required: false })
  @IsOptional()
  @IsString()
  faceImgUrl?: string;

  @ApiProperty({ example: 3301, required: false, description: '区域管理员需填区域码' })
  @IsOptional()
  regionCode?: number;

  @ApiProperty({ example: '李四-配偶', description: '紧急联系人（姓名及关系）', required: false })
  @IsOptional()
  @IsString()
  emergencyContact?: string;

  @ApiProperty({ example: '13900139000', description: '紧急联系人电话', required: false })
  @IsOptional()
  @IsString()
  emergencyPhone?: string;
}
