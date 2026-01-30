import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RecommendationService } from './recommendation.service';
import { RecommendationController } from './recommendation.controller';
import { BaseInfo } from '../base/entities/base-info.entity';
import { SysUser } from '../user/entities/sys-user.entity';
import { DailySignup } from '../attendance/entities/daily-signup.entity';

@Module({
  imports: [
    // 注册所有在 Service 中用到的 Repository
    TypeOrmModule.forFeature([BaseInfo, SysUser, DailySignup]),
  ],
  controllers: [RecommendationController],
  providers: [RecommendationService],
  exports: [RecommendationService],
})
export class RecommendationModule { }