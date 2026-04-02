import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RequestBankCardChangeChallengeDto {
  @ApiProperty({ example: '6222021234567890', description: '即将提交的新银行卡号' })
  @IsString()
  @IsNotEmpty({ message: '银行卡号不能为空' })
  bankCardNo: string;
}
