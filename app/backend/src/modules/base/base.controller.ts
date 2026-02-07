import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
  Request
} from '@nestjs/common';
import { BaseService } from './base.service';
import { CreateBaseDto } from './dto/create-base.dto';
import { CreateJobDto } from './dto/create-job.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('基地管理')
@Controller('base')
export class BaseController {
  constructor(private readonly baseService: BaseService) { }

  @ApiOperation({ summary: '创建基地' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post()
  async create(
    @Body() createBaseDto: CreateBaseDto,
    @Request() req
  ) {
    return this.baseService.create(createBaseDto, req.user.id);
  }

  @ApiOperation({ summary: '获取基地列表' })
  @Get()
  async findAll(@Query() query: any) {
    return this.baseService.findAll(query);
  }

  @ApiOperation({ summary: '当前用户的岗位申请列表（工人端「我的报名」）' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('applications/me')
  async getMyApplications(@Request() req) {
    return this.baseService.getApplicationsByUser(req.user.id);
  }

  @ApiOperation({ summary: '获取基地详情' })
  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.baseService.findOne(id);
  }

  @ApiOperation({ summary: '审核基地' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch(':id/audit')
  async audit(
    @Param('id', ParseIntPipe) id: number,
    @Body('status') status: any
  ) {
    return this.baseService.audit(id, status);
  }

  @ApiOperation({ summary: '发布招聘岗位' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post(':id/jobs')
  async createJob(
    @Param('id', ParseIntPipe) baseId: number,
    @Body() createJobDto: CreateJobDto,
    @Request() req
  ) {
    return this.baseService.createJob(baseId, createJobDto, req.user.id);
  }

  @ApiOperation({ summary: '获取基地的招聘岗位列表' })
  @Get(':id/jobs')
  async getJobsByBase(
    @Param('id', ParseIntPipe) baseId: number,
    @Query() query: any
  ) {
    return this.baseService.getJobsByBase(baseId, query);
  }

  @ApiOperation({ summary: '获取招聘岗位详情' })
  @Get('jobs/:jobId')
  async getJobById(
    @Param('jobId', ParseIntPipe) jobId: number
  ) {
    return this.baseService.getJobById(jobId);
  }

  @ApiOperation({ summary: '更新招聘岗位状态' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch('jobs/:jobId/status')
  async updateJobStatus(
    @Param('jobId', ParseIntPipe) jobId: number,
    @Body('status') status: any,
    @Request() req
  ) {
    return this.baseService.updateJobStatus(jobId, status, req.user.id);
  }

  @ApiOperation({ summary: '续期招聘岗位' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch('jobs/:jobId/renew')
  async renewJob(
    @Param('jobId', ParseIntPipe) jobId: number,
    @Request() req
  ) {
    return this.baseService.renewJob(jobId, req.user.id);
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

  @ApiOperation({ summary: '获取即将过期的招聘岗位（管理用）' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('jobs/expiring')
  async getExpiringJobs(
    @Query('days') days: string
  ) {
    const daysNum = days ? parseInt(days) : 3;
    return this.baseService.getExpiringJobs(daysNum);
  }

  @ApiOperation({ summary: '批量下架过期招聘岗位（管理用）' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('jobs/deactivate-expired')
  async deactivateExpiredJobs() {
    return this.baseService.deactivateExpiredJobs();
  }

  @ApiOperation({ summary: '用户申请岗位' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('jobs/:jobId/apply')
  async applyJob(
    @Param('jobId', ParseIntPipe) jobId: number,
    @Body('baseId') baseId: number,
    @Body('note') note: string,
    @Request() req
  ) {
    return this.baseService.applyJob(req.user.id, jobId, baseId, note);
  }

  @ApiOperation({ summary: '获取岗位申请列表（基地管理员查看）' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('jobs/:jobId/applications')
  async getJobApplications(@Param('jobId', ParseIntPipe) jobId: number) {
    return this.baseService.getJobApplications(jobId);
  }

  @ApiOperation({ summary: '获取某基地的全部申请（现场管理员查看本基地人员）' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get(':id/applications')
  async getBaseApplications(
    @Param('id', ParseIntPipe) baseId: number,
    @Query('status') status?: string,
  ) {
    return this.baseService.getApplicationsByBase(baseId, status !== undefined ? Number(status) : undefined);
  }

  @ApiOperation({ summary: '审核岗位申请' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch('applications/:applicationId/review')
  async reviewApplication(
    @Param('applicationId', ParseIntPipe) applicationId: number,
    @Body('status') status: number,
    @Body('rejectReason') rejectReason: string,
    @Request() req
  ) {
    return this.baseService.reviewApplication(applicationId, status, req.user.id, rejectReason);
  }

  @ApiOperation({ summary: '提交基地合作申请（区域管理员/超级管理员）' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('cooperation')
  async createCooperation(
    @Body('baseId') baseId: number,
    @Body('requirement') requirement: string,
    @Request() req
  ) {
    return this.baseService.createCooperation(req.user.id, baseId, requirement);
  }

  @ApiOperation({ summary: '审核基地合作申请' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch('cooperation/:cooperationId/review')
  async reviewCooperation(
    @Param('cooperationId', ParseIntPipe) cooperationId: number,
    @Body('status') status: number,
    @Body('rejectReason') rejectReason: string,
    @Request() req
  ) {
    return this.baseService.reviewCooperation(cooperationId, status, req.user.id, rejectReason);
  }

  @ApiOperation({ summary: '获取基地合作申请列表' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get(':id/cooperations')
  async getBaseCooperations(@Param('id', ParseIntPipe) baseId: number) {
    return this.baseService.getBaseCooperations(baseId);
  }
}