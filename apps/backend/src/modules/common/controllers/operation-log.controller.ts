/**
 * Layer: Backend Controller
 * Responsibility: Implements the Operation Log transport boundary for the Common module and delegates business work to application services.
 * Notes: Keep comments focused on intent, invariants, side effects, and cross-module contracts.
 */
import { Controller, Get, UseGuards, Query } from '@nestjs/common';
import { OperationLogService } from '../services/operation-log.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../user/entities/sys-user.entity';

@ApiTags('操作日志')
@Controller('operation-log')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
@ApiBearerAuth()
export class OperationLogController {
  constructor(private readonly logService: OperationLogService) {}

  @Get('list')
  @ApiOperation({ summary: '获取操作日志列表（分页）' })
  @ApiQuery({ name: 'operationType', required: false })
  @ApiQuery({ name: 'resourceType', required: false })
  @ApiQuery({ name: 'keyword', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  async getLogList(@Query() query: any) {
    return this.logService.getLogsPaginated({
      operationType: query.operationType || undefined,
      resourceType: query.resourceType || undefined,
      keyword: query.keyword || undefined,
      page: query.page ? Number(query.page) : 1,
      pageSize: query.pageSize ? Number(query.pageSize) : 20,
    });
  }

  @Get('stats')
  @ApiOperation({ summary: '获取操作日志统计' })
  async getLogStats() {
    return this.logService.getLogStats();
  }
}
