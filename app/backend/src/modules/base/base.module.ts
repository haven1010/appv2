/**
 * Layer: Backend Module
 * Responsibility: Defines provider wiring, repository exposure, and dependency composition for the Base module.
 * Notes: Keep comments focused on intent, invariants, side effects, and cross-module contracts.
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BaseController } from './base.controller';
import { BaseService } from './base.service';
import { BaseInfo } from './entities/base-info.entity';
import { RecruitmentJob } from './entities/recruitment-job.entity';
import { JobApplication } from './entities/job-application.entity';
import { BaseCooperation } from './entities/base-cooperation.entity';
import { JobApplicationService } from './services/job-application.service';
import { BaseCooperationService } from './services/base-cooperation.service';
import { SysUser } from '../user/entities/sys-user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([BaseInfo, RecruitmentJob, JobApplication, BaseCooperation, SysUser])],
  controllers: [BaseController],
  providers: [BaseService, JobApplicationService, BaseCooperationService],
  exports: [BaseService, JobApplicationService, BaseCooperationService],
})
export class BaseModule {}
