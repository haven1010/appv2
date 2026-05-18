import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class TakeoverProxyAccountDto {
  @ApiProperty({ description: '本人接管后的新手机号', example: '13800009999' })
  @IsString()
  @IsNotEmpty({ message: '手机号不能为空' })
  phone: string;

  @ApiProperty({ description: '身份证后 6 位校验码', example: '123456' })
  @IsString()
  @IsNotEmpty({ message: '身份证后 6 位不能为空' })
  idCardLast6: string;
}
