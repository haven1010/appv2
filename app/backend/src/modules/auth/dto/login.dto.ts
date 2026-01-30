// 文件: auth/dto/login.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class LoginDto {
  @ApiProperty({ description: '手机号，用作登录账号', example: '13800138000' })
  @IsString()
  @IsNotEmpty({ message: '手机号不能为空' })
  phone: string;

  @ApiProperty({ description: '身份证后6位（即登录密码）', example: '123456' })
  @IsString()
  @IsNotEmpty({ message: '密码不能为空' })
  idCardLast6: string;
}