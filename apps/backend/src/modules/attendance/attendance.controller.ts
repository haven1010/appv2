/**
 * Layer: Backend Controller
 * Responsibility: Implements the Attendance transport boundary for the Attendance module and delegates business work to application services.
 * Notes: Keep comments focused on intent, invariants, side effects, and cross-module contracts.
 */
import { Controller, Post, Body, Get, UseGuards, Req, Query, Patch, Param, ParseIntPipe, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { CheckInDto } from './dto/check-in.dto';
import { SyncOfflineDto } from './dto/sync-offline.dto';
import { CreateSignupDto } from './dto/create-signup.dto';
import { CancelSignupDto } from './dto/cancel-signup.dto';
import { CreateOfflineAttendanceEventDto } from './dto/create-offline-attendance-event.dto';
import { ReviewOfflineAttendanceEventDto } from './dto/review-offline-attendance-event.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { mkdirSync } from 'fs';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../user/entities/sys-user.entity';
import { buildXlsxBase64 } from '../common/utils/xlsx-export.util';

@ApiTags('签到管理')
@Controller('attendance')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AttendanceController {
  constructor(private attendanceService: AttendanceService) { }

  private static readonly offlineEvidenceDir = join(process.cwd(), 'uploads', 'offline-evidence');

  private formatDateTime(value: any): string {
    if (!value) return '-';
    return String(value).replace('T', ' ').slice(0, 19);
  }

  private formatSignupStatus(status: number): string {
    switch (Number(status)) {
      case 0:
        return '已报名';
      case 1:
        return '已签到';
      case 2:
        return '缺勤';
      case 3:
        return '已取消';
      default:
        return '未知状态';
    }
  }

  @Post('signup')
  @ApiOperation({ summary: '工人报名岗位 (创建待签到记录)' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.WORKER)
  async signup(@Body() dto: CreateSignupDto, @Req() req) {
    return this.attendanceService.signup(req.user.id, dto, { request: req, userId: req.user.id });
  }

  @Post('signup/cancel')
  @ApiOperation({ summary: '工人取消报名并删除报名记录' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.WORKER)
  async cancelSignup(@Body() dto: CancelSignupDto, @Req() req) {
    return this.attendanceService.cancelSignup(req.user.id, dto, { request: req, userId: req.user.id });
  }

  @Get('qrcode')
  @ApiOperation({ summary: '获取个人身份码 (用于被扫)' })
  @ApiResponse({ status: 200, description: '返回加密的二维码字符串' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.WORKER)
  async getMyQrCode(@Req() req) {
    // 假设 req.user.id 是用户的主键 ID
    return this.attendanceService.generateUserQrCode(req.user.id);
  }

  @Post('checkin')
  @ApiOperation({ summary: '现场扫码签到 (管理员/领队扫工人)' })
  @ApiResponse({ status: 201, description: '签到成功' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.BASE_MANAGER, UserRole.FIELD_MANAGER)
  async checkIn(@Body() checkInDto: CheckInDto, @Req() req) {
    return this.attendanceService.checkIn(checkInDto.qrContent, checkInDto.baseId, { request: req, userId: req.user.id });
  }

  @Post('sync')
  @ApiOperation({ summary: '离线数据批量同步' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.REGION_ADMIN, UserRole.BASE_MANAGER, UserRole.FIELD_MANAGER)
  async syncOffline(@Body() body: SyncOfflineDto, @Req() req) {
    return this.attendanceService.syncOfflineRecords(body.records, req.user.id, { request: req, userId: req.user.id });
  }

  @Post('offline-events')
  @ApiOperation({ summary: '提交离线补签到事件' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.REGION_ADMIN, UserRole.BASE_MANAGER, UserRole.FIELD_MANAGER)
  async createOfflineEvent(@Body() dto: CreateOfflineAttendanceEventDto, @Req() req) {
    return this.attendanceService.createOfflineAttendanceEvent(dto, req.user, { request: req, userId: req.user.id });
  }

  @Get('offline-events')
  @ApiOperation({ summary: '查询离线补签到事件列表' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.REGION_ADMIN, UserRole.BASE_MANAGER, UserRole.FIELD_MANAGER)
  async getOfflineEvents(@Query() query: any, @Req() req) {
    return this.attendanceService.getOfflineAttendanceEvents(query, req.user);
  }

  @Get('offline-events/stats')
  @ApiOperation({ summary: '查询离线补签到统计' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.REGION_ADMIN, UserRole.BASE_MANAGER, UserRole.FIELD_MANAGER)
  async getOfflineEventStats(@Query() query: any, @Req() req) {
    return this.attendanceService.getOfflineAttendanceEventStats(query, req.user);
  }

  @Post('offline-events/evidence')
  @ApiOperation({ summary: '上传离线补签到证据附件' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.REGION_ADMIN, UserRole.BASE_MANAGER, UserRole.FIELD_MANAGER)
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: (_req, _file, cb) => {
        mkdirSync(AttendanceController.offlineEvidenceDir, { recursive: true });
        cb(null, AttendanceController.offlineEvidenceDir);
      },
      filename: (_req, file, cb) => {
        const timestamp = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
        const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
        cb(null, `${timestamp}${extname(safeName) || ''}`);
      },
    }),
    fileFilter: (_req, file, cb) => {
      if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
        return cb(null, true);
      }
      return cb(new BadRequestException('仅支持图片或 PDF 附件'), false);
    },
    limits: { fileSize: 10 * 1024 * 1024 },
  }))
  async uploadOfflineEvidence(@UploadedFile() file: any, @Req() req) {
    if (!file) {
      throw new BadRequestException('请上传文件');
    }

    const publicBaseUrl = process.env.PUBLIC_API_BASE_URL?.replace(/\/$/, '')
      || `${req.protocol}://${req.get('host')}`;

    return {
      url: `${publicBaseUrl}/uploads/offline-evidence/${file.filename}`,
      name: file.originalname,
      size: file.size,
      type: file.mimetype,
    };
  }

  @Patch('offline-events/:id/review')
  @ApiOperation({ summary: '审核离线补签到事件' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.REGION_ADMIN, UserRole.BASE_MANAGER)
  async reviewOfflineEvent(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: ReviewOfflineAttendanceEventDto,
    @Req() req,
  ) {
    return this.attendanceService.reviewOfflineAttendanceEvent(
      id,
      body,
      req.user,
      { request: req, userId: req.user.id },
    );
  }

  @Get('worker/records')
  @ApiOperation({ summary: '采摘工端：获取个人签到/工作历程' })
  @ApiQuery({ name: 'limit', required: false, description: '条数限制，默认50' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.WORKER)
  async getWorkerRecords(@Query() query: any, @Req() req) {
    return this.attendanceService.getWorkerSignupRecords(req.user.id, query.limit ? Number(query.limit) : 50);
  }

  @Get('records')
  @ApiOperation({ summary: '获取签到记录列表' })
  @ApiQuery({ name: 'baseId', required: false, description: '基地ID，不传则查询所有基地' })
  @ApiQuery({ name: 'date', required: false, description: '日期 YYYY-MM-DD，不传则查询今日' })
  @ApiQuery({ name: 'status', required: false, description: '状态：0-已报名, 1-已签到, 2-缺勤' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.REGION_ADMIN, UserRole.BASE_MANAGER, UserRole.FIELD_MANAGER)
  async getRecords(@Query() query: any, @Req() req) {
    return this.attendanceService.getRecords(query, req.user);
  }

  @Get('stats')
  @ApiOperation({ summary: '获取考勤汇总统计' })
  @ApiQuery({ name: 'date', required: false, description: '日期 YYYY-MM-DD，不传则查询今日' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.REGION_ADMIN, UserRole.BASE_MANAGER, UserRole.FIELD_MANAGER)
  async getStats(@Query() query: any, @Req() req) {
    return this.attendanceService.getStats(query, req.user);
  }

  @Get('bases')
  @ApiOperation({ summary: '获取各基地的签到统计' })
  @ApiQuery({ name: 'date', required: false, description: '日期 YYYY-MM-DD，不传则查询今日' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.REGION_ADMIN, UserRole.BASE_MANAGER, UserRole.FIELD_MANAGER)
  async getBaseStats(@Query() query: any, @Req() req) {
    return this.attendanceService.getBaseStats(query, req.user);
  }

  @Get('export/records')
  @ApiOperation({ summary: 'Export attendance records as XLSX' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.REGION_ADMIN, UserRole.BASE_MANAGER, UserRole.FIELD_MANAGER)
  async exportRecords(@Query() query: any, @Req() req) {
    const payload = await this.attendanceService.getRecords(query, req.user);
    const records = Array.isArray(payload?.records) ? payload.records : [];
    const date = payload?.date || query?.date || new Date().toISOString().slice(0, 10);
    const rows = records.map((item: any) => ([
      item.id,
      item.workDate || date,
      item.baseName || '-',
      item.jobTitle || '-',
      item.workerName || '-',
      item.workerUid || '-',
      item.workerPhone || '-',
      item.workerIdCard || '-',
      this.formatSignupStatus(item.status),
      this.formatDateTime(item.checkinTime || item.createdAt),
    ]));

    return {
      fileName: `考勤明细-${date}.xlsx`,
      rowCount: rows.length,
      fileBase64: buildXlsxBase64([
        {
          name: '考勤明细',
          columns: [
            '报名记录ID',
            '工作日期',
            '基地名称',
            '岗位名称',
            '工人姓名',
            '工人UID',
            '工人手机号',
            '工人身份证号',
            '状态',
            '签到时间',
          ],
          rows,
        },
      ]),
    };
  }

  @Get('export/base-stats')
  @ApiOperation({ summary: 'Export attendance base stats as XLSX' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.REGION_ADMIN, UserRole.BASE_MANAGER, UserRole.FIELD_MANAGER)
  async exportBaseStats(@Query() query: any, @Req() req) {
    const payload = await this.attendanceService.getBaseStats(query, req.user);
    const bases = Array.isArray(payload?.bases) ? payload.bases : [];
    const date = payload?.date || query?.date || new Date().toISOString().slice(0, 10);
    const rows = bases.map((item: any) => ([
      item.baseName || '-',
      Number(item.present || 0),
      Number(item.total || 0),
      Number(item.attendanceRate || 0),
    ]));

    return {
      fileName: `基地考勤统计-${date}.xlsx`,
      rowCount: rows.length,
      fileBase64: buildXlsxBase64([
        {
          name: '基地考勤统计',
          columns: ['基地名称', '已签到人数', '报名总人数', '出勤率(%)'],
          rows,
        },
      ]),
    };
  }
}
