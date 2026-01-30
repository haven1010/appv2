import {
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsString,
  IsNumber,
  Min,
  Max,
  IsBoolean,
  IsDateString,
  IsArray,
  IsEnum,
  MaxLength,
  ValidateIf
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
// 【关键修改 1】导入 Swagger 装饰器
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PayType, WorkCycle } from '../entities/recruitment-job.entity';

export class CreateJobDto {
  // 【关键修改 2】添加 @ApiProperty 描述
  @ApiProperty({ description: '岗位名称', example: '草莓采摘工' })
  @IsNotEmpty({ message: '岗位名称不能为空' })
  @IsString({ message: '岗位名称必须是字符串' })
  @MaxLength(100, { message: '岗位名称不能超过100个字符' })
  jobTitle: string;

  @ApiPropertyOptional({ description: '招聘人数', example: 5, default: 1 })
  @IsOptional()
  @IsInt({ message: '招聘人数必须是整数' })
  @Min(1, { message: '招聘人数至少为1人' })
  @Transform(({ value }) => value ? parseInt(value) : 1)
  recruitCount?: number = 1;

  @ApiPropertyOptional({ description: '工作周期', enum: WorkCycle, example: WorkCycle.DAILY })
  @IsOptional()
  @IsEnum(WorkCycle, { message: '无效的工作周期类型' })
  @Transform(({ value }) => value ? parseInt(value) : WorkCycle.DAILY)
  workCycle?: WorkCycle = WorkCycle.DAILY;

  @ApiPropertyOptional({ description: '工作内容', example: '负责大棚内草莓采摘、装筐' })
  @IsOptional()
  @IsString({ message: '工作内容必须是字符串' })
  workContent?: string;

  @ApiPropertyOptional({ description: '工作时间', example: '08:00-17:00' })
  @IsOptional()
  @IsString({ message: '工作时间必须是字符串' })
  workHours?: string;

  @ApiPropertyOptional({ description: '工作开始日期', example: '2023-10-01' })
  @IsOptional()
  @IsDateString({}, { message: '工作开始日期格式不正确' })
  workStartDate?: string;

  @ApiPropertyOptional({ description: '工作结束日期', example: '2023-12-31' })
  @IsOptional()
  @IsDateString({}, { message: '工作结束日期格式不正确' })
  workEndDate?: string;

  @ApiProperty({ description: '薪资类型: 1-固定, 2-时薪, 3-计件', enum: PayType, example: PayType.HOURLY })
  @IsNotEmpty({ message: '薪资类型不能为空' })
  @IsEnum(PayType, { message: '无效的薪资类型' })
  @Transform(({ value }) => parseInt(value))
  payType: PayType;

  // 单价仅在「计件」时使用（时薪使用 hourlyRate）
  @ApiPropertyOptional({ description: '单价（计件使用）', example: 1.5 })
  @ValidateIf(o => o.payType === PayType.PIECEWORK)
  @IsNumber({}, { message: '单价必须是数字' })
  @Min(0.01, { message: '单价必须大于0' })
  @Transform(({ value }) => value ? parseFloat(value) : null)
  unitPrice?: number;

  // 当薪资类型为固定工资时，薪资金额是必须的
  @ApiPropertyOptional({ description: '固定工资金额', example: 5000 })
  @ValidateIf(o => o.payType === PayType.FIXED)
  @IsNumber({}, { message: '薪资金额必须是数字' })
  @Min(0.01, { message: '薪资金额必须大于0' })
  @Transform(({ value }) => value ? parseFloat(value) : null)
  salaryAmount?: number;

  // 当薪资类型为时薪时，时薪是必须的
  @ApiPropertyOptional({ description: '时薪', example: 25 })
  @ValidateIf(o => o.payType === PayType.HOURLY)
  @IsNumber({}, { message: '时薪必须是数字' })
  @Min(0.01, { message: '时薪必须大于0' })
  @Transform(({ value }) => value ? parseFloat(value) : null)
  hourlyRate?: number;

  // 当薪资类型为计件时，目标数量是必须的
  @ApiPropertyOptional({ description: '目标数量（计件用）', example: 100 })
  @ValidateIf(o => o.payType === PayType.PIECEWORK)
  @IsInt({ message: '目标数量必须是整数' })
  @Min(1, { message: '目标数量至少为1' })
  @Transform(({ value }) => value ? parseInt(value) : null)
  targetCount?: number;

  @ApiPropertyOptional({ description: '招聘要求', example: '身体健康，吃苦耐劳' })
  @IsOptional()
  @IsString({ message: '招聘要求必须是字符串' })
  requirements?: string;

  @ApiPropertyOptional({ description: '最小年龄', example: 18 })
  @IsOptional()
  @IsInt({ message: '最小年龄必须是整数' })
  @Min(16, { message: '最小年龄不能低于16岁' })
  @Max(70, { message: '最大年龄不能超过70岁' })
  @Transform(({ value }) => value ? parseInt(value) : null)
  minAge?: number;

  @ApiPropertyOptional({ description: '最大年龄', example: 60 })
  @IsOptional()
  @IsInt({ message: '最大年龄必须是整数' })
  @Min(16, { message: '最小年龄不能低于16岁' })
  @Max(70, { message: '最大年龄不能超过70岁' })
  @Transform(({ value }) => value ? parseInt(value) : null)
  maxAge?: number;

  @ApiPropertyOptional({ description: '经验要求', example: '无经验要求' })
  @IsOptional()
  @IsString({ message: '经验要求必须是字符串' })
  experienceRequired?: string;

  @ApiPropertyOptional({ description: '体力要求', example: '适中' })
  @IsOptional()
  @IsString({ message: '体力要求必须是字符串' })
  physicalRequirement?: string;

  @ApiPropertyOptional({ description: '福利描述', example: '包午餐，有高温补贴' })
  @IsOptional()
  @IsString({ message: '福利描述必须是字符串' })
  benefits?: string;

  @ApiPropertyOptional({ description: '是否提供住宿', example: false })
  @IsOptional()
  @IsBoolean({ message: '是否提供住宿必须是布尔值' })
  @Transform(({ value }) => value === 'true' || value === true)
  hasAccommodation?: boolean = false;

  @ApiPropertyOptional({ description: '是否提供餐食', example: true })
  @IsOptional()
  @IsBoolean({ message: '是否提供餐食必须是布尔值' })
  @Transform(({ value }) => value === 'true' || value === true)
  hasMeals?: boolean = false;

  @ApiPropertyOptional({ description: '是否有交通补贴', example: false })
  @IsOptional()
  @IsBoolean({ message: '是否有交通补贴必须是布尔值' })
  @Transform(({ value }) => value === 'true' || value === true)
  hasTransportation?: boolean = false;

  @ApiPropertyOptional({ description: '交通补贴金额', example: 0 })
  @IsOptional()
  @IsNumber({}, { message: '交通补贴金额必须是数字' })
  @Min(0, { message: '交通补贴金额不能为负数' })
  @Transform(({ value }) => value ? parseFloat(value) : 0)
  transportationSubsidy?: number = 0;

  @ApiPropertyOptional({ description: '工作场景图片URL数组', example: ['https://url.com/1.jpg'] })
  @IsOptional()
  @IsArray({ message: '工作场景图片必须是数组' })
  @IsString({ each: true, message: '每张图片URL必须是字符串' })
  @Type(() => String)
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return value.split(',').map((item: string) => item.trim());
      }
    }
    return value;
  })
  workplaceImages?: string[];

  @ApiPropertyOptional({ description: '视频URL', example: 'https://url.com/video.mp4' })
  @IsOptional()
  @IsString({ message: '视频URL必须是字符串' })
  @MaxLength(500, { message: '视频URL不能超过500个字符' })
  videoUrl?: string;

  @ApiPropertyOptional({ description: '有效期至', example: '2023-12-31' })
  @IsOptional()
  @IsDateString({}, { message: '有效期格式不正确' })
  validUntil?: string;

  @ApiPropertyOptional({ description: '是否自动续期', example: false })
  @IsOptional()
  @IsBoolean({ message: '是否自动续期必须是布尔值' })
  @Transform(({ value }) => value === 'true' || value === true)
  autoRenew?: boolean = false;

  @ApiPropertyOptional({ description: '续期天数', example: 7 })
  @IsOptional()
  @IsInt({ message: '续期天数必须是整数' })
  @Min(1, { message: '续期天数至少为1天' })
  @Transform(({ value }) => value ? parseInt(value) : 7)
  renewalDays?: number = 7;
}