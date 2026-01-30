import { IsString, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../entities/sys-user.entity';

export class RegisterByOcrDto {
  @ApiProperty({ example: 'https://cos.url/idcard.jpg', description: '身份证照片URL' })
  @IsString()
  imageUrl: string;

  @ApiProperty({ example: 'FRONT', enum: ['FRONT', 'BACK'], description: '身份证正反面' })
  @IsString()
  side: 'FRONT' | 'BACK';

  @ApiProperty({ example: 'worker', enum: UserRole, description: '角色', required: false })
  @IsOptional()
  @IsEnum(UserRole)
  roleKey?: UserRole;

  @ApiProperty({ example: '李四-配偶', description: '紧急联系人（姓名及关系）', required: false })
  @IsOptional()
  @IsString()
  emergencyContact?: string;

  @ApiProperty({ example: '13900139000', description: '紧急联系人电话', required: false })
  @IsOptional()
  @IsString()
  emergencyPhone?: string;
}
