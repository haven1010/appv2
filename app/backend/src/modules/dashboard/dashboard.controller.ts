import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('仪表盘')
@Controller('dashboard')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  @ApiOperation({ summary: '获取仪表盘聚合统计（按角色过滤）' })
  async getStats(@Req() req) {
    return this.dashboardService.getStats(req.user);
  }

  @Get('trend')
  @ApiOperation({ summary: '获取最近7天签到/工资趋势（按角色过滤）' })
  async getWeeklyTrend(@Req() req) {
    return this.dashboardService.getWeeklyTrend(req.user);
  }

  @Get('category')
  @ApiOperation({ summary: '获取基地类型占比' })
  async getCategoryDistribution() {
    return this.dashboardService.getCategoryDistribution();
  }

  @Get('recent-bases')
  @ApiOperation({ summary: '获取最新入驻基地' })
  async getRecentBases() {
    return this.dashboardService.getRecentBases();
  }
}
