import { Controller, Post, Body, Get, UseGuards, Req } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { CheckInDto } from './dto/check-in.dto';
import { SyncOfflineDto } from './dto/sync-offline.dto';
import { CreateSignupDto } from './dto/create-signup.dto';

@ApiTags('签到管理')
@Controller('attendance')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AttendanceController {
  constructor(private attendanceService: AttendanceService) { }

  @Post('signup')
  @ApiOperation({ summary: '工人报名岗位 (创建待签到记录)' })
  async signup(@Body() dto: CreateSignupDto, @Req() req) {
    return this.attendanceService.signup(req.user.id, dto);
  }

  @Get('qrcode')
  @ApiOperation({ summary: '获取个人身份码 (用于被扫)' })
  @ApiResponse({ status: 200, description: '返回加密的二维码字符串' })
  async getMyQrCode(@Req() req) {
    // 假设 req.user.id 是用户的主键 ID
    return this.attendanceService.generateUserQrCode(req.user.id);
  }

  @Post('checkin')
  @ApiOperation({ summary: '现场扫码签到 (管理员/领队扫工人)' })
  @ApiResponse({ status: 201, description: '签到成功' })
  async checkIn(@Body() checkInDto: CheckInDto) {
    return this.attendanceService.checkIn(checkInDto.qrContent, checkInDto.baseId);
  }

  @Post('sync')
  @ApiOperation({ summary: '离线数据批量同步' })
  async syncOffline(@Body() body: SyncOfflineDto, @Req() req) {
    return this.attendanceService.syncOfflineRecords(body.records, req.user.id);
  }
}