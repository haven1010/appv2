/**
 * Layer: Backend Controller
 * Responsibility: Implements the Base transport boundary for the Base module and delegates business work to application services.
 * Notes: Keep comments focused on intent, invariants, side effects, and cross-module contracts.
 */
import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Patch,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { BaseService } from './base.service';
import { CreateBaseDto } from './dto/create-base.dto';
import { CreateJobDto } from './dto/create-job.dto';
import { SetBaseSupervisorsDto } from './dto/set-base-supervisors.dto';
import { ReviewJobDto } from './dto/review-job.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../user/entities/sys-user.entity';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { mkdirSync } from 'fs';

@ApiTags('基地管理')
@Controller('base')
export class BaseController {
  private static readonly baseAssetDir = join(process.cwd(), 'uploads', 'base-assets');
  private static readonly baseAssetRetentionDays = 30;

  constructor(private readonly baseService: BaseService) {}

  @ApiOperation({ summary: '创建基地' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.BOSS)
  @Post()
  async create(
    @Body() createBaseDto: CreateBaseDto,
    @Request() req,
  ) {
    return this.baseService.create(createBaseDto, req.user.id, { request: req, userId: req.user.id });
  }

  @ApiOperation({ summary: '获取基地列表' })
  @Get()
  async findAll(@Query() query: any) {
    return this.baseService.findAll(query);
  }

  @ApiOperation({ summary: '获取当前用户可管理的基地列表' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.REGION_ADMIN, UserRole.BOSS, UserRole.BASE_MANAGER, UserRole.FIELD_MANAGER)
  @Get('managed')
  async findManaged(@Request() req) {
    return this.baseService.getManagedBases(req.user);
  }

  @ApiOperation({ summary: '上传基地资质图片（营业执照/环境图）' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.BOSS, UserRole.BASE_MANAGER, UserRole.SUPER_ADMIN, UserRole.REGION_ADMIN)
  @Post('upload/image')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: (_req, _file, cb) => {
        mkdirSync(BaseController.baseAssetDir, { recursive: true });
        cb(null, BaseController.baseAssetDir);
      },
      filename: (_req, file, cb) => {
        const timestamp = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
        const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
        cb(null, `${timestamp}${extname(safeName) || ''}`);
      },
    }),
    fileFilter: (_req, file, cb) => {
      if (file.mimetype && file.mimetype.startsWith('image/')) {
        return cb(null, true);
      }
      return cb(new BadRequestException('仅支持图片文件'), false);
    },
    limits: { fileSize: 10 * 1024 * 1024 },
  }))
  async uploadBaseImage(@UploadedFile() file: any, @Request() req) {
    if (!file) {
      throw new BadRequestException('请上传图片文件');
    }

    const publicBaseUrl = process.env.PUBLIC_API_BASE_URL?.replace(/\/$/, '')
      || `${req.protocol}://${req.get('host')}`;
    const retainedUntil = new Date(Date.now() + BaseController.baseAssetRetentionDays * 24 * 60 * 60 * 1000);

    return {
      url: `${publicBaseUrl}/uploads/base-assets/${file.filename}`,
      name: file.originalname,
      size: file.size,
      type: file.mimetype,
      retentionDays: BaseController.baseAssetRetentionDays,
      retainedUntil: retainedUntil.toISOString(),
    };
  }

  @ApiOperation({ summary: '当前用户的岗位申请列表（工人端“我的报名”）' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('applications/me')
  async getMyApplications(@Request() req) {
    return this.baseService.getApplicationsByUser(req.user.id);
  }

  @ApiOperation({ summary: '获取即将过期的招聘岗位（管理用）' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @Get('jobs/expiring')
  async getExpiringJobs(@Query('days') days: string) {
    const daysNum = days ? parseInt(days, 10) : 3;
    return this.baseService.getExpiringJobs(daysNum);
  }

  @ApiOperation({ summary: '批量下架过期岗位（管理用）' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @Post('jobs/deactivate-expired')
  async deactivateExpiredJobs() {
    return this.baseService.deactivateExpiredJobs();
  }

  @ApiOperation({ summary: '获取基地详情' })
  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.baseService.findOne(id);
  }

  @ApiOperation({ summary: '更新基地信息（老板/基地管理员）' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.BOSS, UserRole.BASE_MANAGER, UserRole.SUPER_ADMIN, UserRole.REGION_ADMIN)
  @Patch(':id')
  async updateBase(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateBaseDto: Partial<CreateBaseDto>,
    @Request() req,
  ) {
    return this.baseService.updateBase(id, updateBaseDto, req.user.id, { request: req, userId: req.user.id });
  }

  @ApiOperation({ summary: '删除基地（超级管理员）' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.REGION_ADMIN)
  @Delete(':id')
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
  ) {
    return this.baseService.remove(id, req.user.id, { request: req, userId: req.user.id });
  }

  @ApiOperation({ summary: '审核基地' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @Patch(':id/audit')
  async audit(
    @Param('id', ParseIntPipe) id: number,
    @Body('status') status: any,
    @Request() req,
  ) {
    return this.baseService.audit(id, status, { request: req, userId: req.user.id });
  }

  @ApiOperation({ summary: '转交基地负责人（超级管理员）' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @Patch(':id/owner')
  async transferOwner(
    @Param('id', ParseIntPipe) id: number,
    @Body('ownerId', ParseIntPipe) ownerId: number,
    @Request() req,
  ) {
    return this.baseService.transferOwner(id, ownerId, req.user.id, { request: req, userId: req.user.id });
  }

  @ApiOperation({ summary: '查看基地监督人分配' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.REGION_ADMIN, UserRole.BOSS, UserRole.BASE_MANAGER, UserRole.FIELD_MANAGER)
  @Get(':id/supervisors')
  async getSupervisors(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
  ) {
    return this.baseService.getSupervisors(id, req.user);
  }

  @ApiOperation({ summary: '分配基地管理员和现场管理员（超级管理员）' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @Patch(':id/supervisors')
  async setSupervisors(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SetBaseSupervisorsDto,
    @Request() req,
  ) {
    return this.baseService.setSupervisors(id, dto, req.user.id, { request: req, userId: req.user.id });
  }

  @ApiOperation({ summary: '发布招聘岗位' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.REGION_ADMIN, UserRole.BOSS, UserRole.BASE_MANAGER)
  @Post(':id/jobs')
  async createJob(
    @Param('id', ParseIntPipe) baseId: number,
    @Body() createJobDto: CreateJobDto,
    @Request() req,
  ) {
    return this.baseService.createJob(baseId, createJobDto, req.user.id, { request: req, userId: req.user.id });
  }

  @ApiOperation({ summary: '获取基地招聘岗位列表' })
  @Get(':id/jobs')
  async getJobsByBase(
    @Param('id', ParseIntPipe) baseId: number,
    @Query() query: any,
  ) {
    return this.baseService.getJobsByBase(baseId, query);
  }

  @ApiOperation({ summary: '获取招聘岗位详情' })
  @Get('jobs/:jobId')
  async getJobById(
    @Param('jobId', ParseIntPipe) jobId: number,
  ) {
    return this.baseService.getJobById(jobId);
  }

  @ApiOperation({ summary: '更新招聘岗位状态' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.REGION_ADMIN, UserRole.BOSS, UserRole.BASE_MANAGER)
  @Patch('jobs/:jobId/status')
  async updateJobStatus(
    @Param('jobId', ParseIntPipe) jobId: number,
    @Body('status') status: any,
    @Request() req,
  ) {
    return this.baseService.updateJobStatus(jobId, status, req.user.id, { request: req, userId: req.user.id });
  }

  @ApiOperation({ summary: '续期招聘岗位' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.REGION_ADMIN, UserRole.BOSS, UserRole.BASE_MANAGER)
  @Patch('jobs/:jobId/renew')
  async renewJob(
    @Param('jobId', ParseIntPipe) jobId: number,
    @Request() req,
  ) {
    return this.baseService.renewJob(jobId, req.user.id, { request: req, userId: req.user.id });
  }

  @ApiOperation({ summary: '审核老板提交的招聘岗位' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.REGION_ADMIN, UserRole.BASE_MANAGER)
  @Patch('jobs/:jobId/review')
  async reviewJob(
    @Param('jobId', ParseIntPipe) jobId: number,
    @Body() dto: ReviewJobDto,
    @Request() req,
  ) {
    return this.baseService.reviewJob(jobId, dto, req.user, { request: req, userId: req.user.id });
  }

  @ApiOperation({ summary: '获取基地统计信息' })
  @Get(':id/statistics')
  async getBaseStatistics(@Param('id', ParseIntPipe) id: number) {
    return this.baseService.getBaseStatistics(id);
  }

  @ApiOperation({ summary: '检查基地名称是否可用' })
  @Get('check-name/:name')
  async checkBaseNameAvailability(@Param('name') name: string) {
    return this.baseService.checkBaseNameAvailability(name);
  }

  @ApiOperation({ summary: '用户申请岗位' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('jobs/:jobId/apply')
  async applyJob(
    @Param('jobId', ParseIntPipe) jobId: number,
    @Body('baseId') baseId: number,
    @Body('note') note: string,
    @Request() req,
  ) {
    return this.baseService.applyJob(req.user.id, jobId, baseId, note, { request: req, userId: req.user.id });
  }

  @ApiOperation({ summary: '获取岗位申请列表（管理员）' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.REGION_ADMIN, UserRole.BASE_MANAGER, UserRole.FIELD_MANAGER)
  @Get('jobs/:jobId/applications')
  async getJobApplications(@Param('jobId', ParseIntPipe) jobId: number, @Request() req) {
    return this.baseService.getJobApplications(jobId, req.user);
  }

  @ApiOperation({ summary: '获取基地申请列表（管理员/老板）' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.REGION_ADMIN, UserRole.BASE_MANAGER, UserRole.FIELD_MANAGER, UserRole.BOSS)
  @Get(':id/applications')
  async getBaseApplications(
    @Param('id', ParseIntPipe) baseId: number,
    @Request() req,
    @Query('status') status?: string,
  ) {
    return this.baseService.getApplicationsByBase(baseId, req.user, status !== undefined ? Number(status) : undefined);
  }

  @ApiOperation({ summary: '结束单个人员务工（基地管理员端）' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.REGION_ADMIN, UserRole.BASE_MANAGER, UserRole.FIELD_MANAGER, UserRole.BOSS)
  @Patch(':id/workers/:userId/end-work')
  async endWorkerWork(
    @Param('id', ParseIntPipe) baseId: number,
    @Param('userId', ParseIntPipe) userId: number,
    @Body('endWorkTime') endWorkTime: string,
    @Request() req,
  ) {
    return this.baseService.endWorkerWork(baseId, userId, endWorkTime, req.user, { request: req, userId: req.user.id });
  }

  @ApiOperation({ summary: '批量结束基地人员务工（基地管理员端）' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.REGION_ADMIN, UserRole.BASE_MANAGER, UserRole.FIELD_MANAGER, UserRole.BOSS)
  @Patch(':id/workers/end-work-all')
  async endAllWorkersWork(
    @Param('id', ParseIntPipe) baseId: number,
    @Body('endWorkTime') endWorkTime: string,
    @Request() req,
  ) {
    return this.baseService.endAllWorkersWork(baseId, endWorkTime, req.user, { request: req, userId: req.user.id });
  }

  @ApiOperation({ summary: '审核岗位申请' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.REGION_ADMIN, UserRole.BASE_MANAGER, UserRole.FIELD_MANAGER)
  @Patch('applications/:applicationId/review')
  async reviewApplication(
    @Param('applicationId', ParseIntPipe) applicationId: number,
    @Body('status') status: number,
    @Body('rejectReason') rejectReason: string,
    @Request() req,
  ) {
    return this.baseService.reviewApplication(applicationId, status, req.user, rejectReason, { request: req, userId: req.user.id });
  }

  @ApiOperation({ summary: '提交基地合作申请（区管/超管）' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.REGION_ADMIN)
  @Post('cooperation')
  async createCooperation(
    @Body('baseId') baseId: number,
    @Body('requirement') requirement: string,
    @Request() req,
  ) {
    return this.baseService.createCooperation(req.user.id, baseId, requirement, { request: req, userId: req.user.id });
  }

  @ApiOperation({ summary: '审核基地合作申请' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.REGION_ADMIN)
  @Patch('cooperation/:cooperationId/review')
  async reviewCooperation(
    @Param('cooperationId', ParseIntPipe) cooperationId: number,
    @Body('status') status: number,
    @Body('rejectReason') rejectReason: string,
    @Request() req,
  ) {
    return this.baseService.reviewCooperation(cooperationId, status, req.user.id, rejectReason, { request: req, userId: req.user.id });
  }

  @ApiOperation({ summary: '获取基地合作申请列表' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.REGION_ADMIN, UserRole.BASE_MANAGER, UserRole.FIELD_MANAGER)
  @Get(':id/cooperations')
  async getBaseCooperations(@Param('id', ParseIntPipe) baseId: number) {
    return this.baseService.getBaseCooperations(baseId);
  }
}
