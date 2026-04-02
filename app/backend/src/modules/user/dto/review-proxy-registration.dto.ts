import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class ReviewProxyRegistrationDto {
  @ApiProperty({
    description: '审核动作',
    example: 'approved',
    enum: ['approved', 'rejected', 'revoked'],
  })
  @IsString()
  @IsIn(['approved', 'rejected', 'revoked'])
  status: 'approved' | 'rejected' | 'revoked';

  @ApiProperty({ description: '拒绝/撤销原因', required: false })
  @IsOptional()
  @IsString()
  reason?: string;
}
