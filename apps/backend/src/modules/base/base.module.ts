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
import { BaseSupervisorAssignment } from './entities/base-supervisor-assignment.entity';
import { JobApplicationService } from './services/job-application.service';
import { BaseCooperationService } from './services/base-cooperation.service';
import { BaseSeedService } from './services/base-seed.service';
import { BaseScopeService } from './services/base-scope.service';
import { SysUser } from '../user/entities/sys-user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([BaseInfo, RecruitmentJob, JobApplication, BaseCooperation, BaseSupervisorAssignment, SysUser])],
  controllers: [BaseController],
  providers: [BaseService, JobApplicationService, BaseCooperationService, BaseSeedService, BaseScopeService],
  exports: [BaseService, JobApplicationService, BaseCooperationService, BaseScopeService],
})
export class BaseModule {}
