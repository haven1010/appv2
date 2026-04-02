import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateProxyRegistrationDto {
  @ApiProperty({ example: '张三', description: '工人真实姓名' })
  @IsString()
  @IsNotEmpty({ message: '工人姓名不能为空' })
  workerName: string;

  @ApiProperty({ example: '330106199001011234', description: '工人身份证号' })
  @IsString()
  @IsNotEmpty({ message: '工人身份证号不能为空' })
  workerIdCard: string;

  @ApiProperty({ example: '13800000001', description: '工人手机号（后续可交接）' })
  @IsString()
  @IsNotEmpty({ message: '工人手机号不能为空' })
  workerPhone: string;

  @ApiProperty({ example: '山东省烟台市福山区演示村 12 号', description: '工人家庭地址', required: false })
  @IsOptional()
  @IsString()
  workerHomeAddress?: string;

  @ApiProperty({ example: '中国农业银行', description: '工人开户银行', required: false })
  @IsOptional()
  @IsString()
  workerBankName?: string;

  @ApiProperty({ example: '6222021234567890', description: '工人银行卡号', required: false })
  @IsOptional()
  @IsString()
  workerBankCardNo?: string;

  @ApiProperty({ example: '李四-配偶', description: '工人紧急联系人', required: false })
  @IsOptional()
  @IsString()
  workerEmergencyContact?: string;

  @ApiProperty({ example: '13900139000', description: '工人紧急联系人电话', required: false })
  @IsOptional()
  @IsString()
  workerEmergencyPhone?: string;

  @ApiProperty({ example: '王小明', description: '代办人姓名' })
  @IsString()
  @IsNotEmpty({ message: '代办人姓名不能为空' })
  proxyName: string;

  @ApiProperty({ example: '13988889999', description: '代办人手机号' })
  @IsString()
  @IsNotEmpty({ message: '代办人手机号不能为空' })
  proxyPhone: string;

  @ApiProperty({ example: '子女', description: '与工人的关系' })
  @IsString()
  @IsNotEmpty({ message: '与工人的关系不能为空' })
  relationToWorker: string;

  @ApiProperty({ example: 'family_confirm', description: '授权方式（family_confirm/sms/signature）', required: false })
  @IsOptional()
  @IsString()
  consentType?: string;

  @ApiProperty({ example: '代办人已获得工人授权并确认提交。', description: '授权声明文本', required: false })
  @IsOptional()
  @IsString()
  consentStatement?: string;

  @ApiProperty({ example: 'https://example.com/evidence.jpg', description: '授权凭证链接', required: false })
  @IsOptional()
  @IsString()
  consentEvidenceUrl?: string;
}
