/**
 * Layer: Backend Controller
 * Responsibility: Implements the Salary transport boundary for the Salary module and delegates business work to application services.
 * Notes: Keep comments focused on intent, invariants, side effects, and cross-module contracts.
 */
import { Controller, Get, Post, Body, Patch, Param, Query, UseGuards, Req, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SalaryService } from './salary.service';
import { SalaryPaymentService } from './services/salary-payment.service';
import { SalaryReportService } from './services/salary-report.service';
import { PaymentMethod } from './entities/salary-payment.entity';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../user/entities/sys-user.entity';

@ApiTags('薪资结算')
@Controller('salary')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SalaryController {
  constructor(
    private salaryService: SalaryService,
    private paymentService: SalaryPaymentService,
    private reportService: SalaryReportService,
  ) {}

  @Get('list')
  @ApiOperation({ summary: '获取工资记录列表' })
  @ApiQuery({ name: 'baseId', required: false, description: '基地ID' })
  @ApiQuery({ name: 'dateFrom', required: false, description: '开始日期 YYYY-MM-DD' })
  @ApiQuery({ name: 'dateTo', required: false, description: '结束日期 YYYY-MM-DD' })
  @ApiQuery({ name: 'status', required: false, description: '状态 0:待审核 1:已确认 2:已发放' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.REGION_ADMIN, UserRole.BOSS, UserRole.BASE_MANAGER, UserRole.FIELD_MANAGER)
  async getList(@Query() query: any, @Req() req: any) {
    return this.salaryService.getList(query, req.user);
  }

  @Get('stats')
  @ApiOperation({ summary: '获取薪资汇总统计' })
  @ApiQuery({ name: 'baseId', required: false, description: '基地ID' })
  @ApiQuery({ name: 'dateFrom', required: false, description: '开始日期' })
  @ApiQuery({ name: 'dateTo', required: false, description: '结束日期' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.REGION_ADMIN, UserRole.BOSS, UserRole.BASE_MANAGER, UserRole.FIELD_MANAGER)
  async getStats(@Query() query: any, @Req() req: any) {
    return this.salaryService.getStats(query, req.user);
  }

  @Get('worker/stats')
  @ApiOperation({ summary: '采摘工端：获取个人统计（已做天数、待收工资）' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.WORKER)
  async getWorkerStats(@Req() req: any) {
    return this.salaryService.getWorkerStats(req.user.id);
  }

  @Get('worker/pending')
  @ApiOperation({ summary: '采摘工端：获取待确认工资列表' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.WORKER)
  async getWorkerPending(@Req() req: any) {
    return this.salaryService.getWorkerPendingList(req.user.id);
  }

  @Get('worker/paid')
  @ApiOperation({ summary: '工人端：获取已到账工资列表' })
  @ApiQuery({ name: 'limit', required: false, description: '返回条数，默认20' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.WORKER)
  async getWorkerPaid(@Req() req: any, @Query('limit') limit?: string) {
    return this.salaryService.getWorkerPaidList(req.user.id, limit ? Number(limit) : 20);
  }

  @Post('worker/:salaryId/confirm')
  @ApiOperation({ summary: '采摘工端：确认工资无误' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.WORKER)
  async workerConfirmSalary(
    @Param('salaryId', ParseIntPipe) salaryId: number,
    @Req() req: any,
  ) {
    return this.salaryService.workerConfirmSalary(salaryId, req.user.id, { request: req, userId: req.user.id });
  }

  @Post('worker/:salaryId/appeal')
  @ApiOperation({ summary: '采摘工端：提交工资申诉' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.WORKER)
  async workerSubmitAppeal(
    @Param('salaryId', ParseIntPipe) salaryId: number,
    @Body() body: { reason?: string; expectedAmount?: number | string | null },
    @Req() req: any,
  ) {
    return this.salaryService.workerSubmitAppeal(
      salaryId,
      req.user.id,
      body,
      { request: req, userId: req.user.id },
    );
  }

  @Post('calculate/:signupId')
  @ApiOperation({ summary: '根据签到记录生成/更新工资草稿' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.REGION_ADMIN, UserRole.BASE_MANAGER)
  async calculateAndDraft(
    @Param('signupId', ParseIntPipe) signupId: number,
    @Body() body: { duration?: number; count?: number },
    @Req() req: any,
  ) {
    return this.salaryService.calculateAndDraft(signupId, body, req.user.id, { request: req, userId: req.user.id });
  }

  @Patch(':salaryId/appeal')
  @ApiOperation({ summary: '基地管理员处理工资申诉并修改工资单' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.REGION_ADMIN, UserRole.BASE_MANAGER)
  async handleAppeal(
    @Param('salaryId', ParseIntPipe) salaryId: number,
    @Body() body: { action?: string; duration?: number | string; count?: number | string; totalAmount?: number | string; reply?: string },
    @Req() req: any,
  ) {
    return this.salaryService.managerHandleAppeal(
      salaryId,
      body,
      req.user.id,
      { request: req, userId: req.user.id },
    );
  }

  @Post(':salaryId/payment')
  @ApiOperation({ summary: '创建支付记录（发起发放）' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.REGION_ADMIN, UserRole.BASE_MANAGER)
  async createPayment(
    @Param('salaryId', ParseIntPipe) salaryId: number,
    @Body() body: { paymentMethod: PaymentMethod },
    @Req() req: any,
  ) {
    return this.paymentService.createPayment(
      salaryId,
      body.paymentMethod,
      req.user.id,
      { request: req, userId: req.user.id },
    );
  }

  @Post(':salaryId/settle')
  @ApiOperation({ summary: '老板结算工资（不修改工资单金额）' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.BOSS)
  async settleSalary(
    @Param('salaryId', ParseIntPipe) salaryId: number,
    @Body() body: { paymentMethod?: PaymentMethod; paymentVoucherUrl?: string },
    @Req() req: any,
  ) {
    return this.paymentService.settleSalary(
      salaryId,
      body.paymentMethod,
      req.user.id,
      { request: req, userId: req.user.id },
      body.paymentVoucherUrl,
    );
  }

  @Patch('payment/:id/confirm')
  @ApiOperation({ summary: '确认支付（签字）' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.REGION_ADMIN, UserRole.BASE_MANAGER, UserRole.WORKER)
  async confirmPayment(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { confirmSignatureUrl: string },
    @Req() req: any,
  ) {
    return this.paymentService.confirmPayment(id, body.confirmSignatureUrl, req.user.id, { request: req, userId: req.user.id });
  }

  @Patch('payment/:id/complete')
  @ApiOperation({ summary: '完成支付（上传凭证）' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.REGION_ADMIN, UserRole.BASE_MANAGER)
  async completePayment(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { paymentVoucherUrl: string },
    @Req() req: any,
  ) {
    return this.paymentService.completePayment(
      id,
      body.paymentVoucherUrl,
      req.user.id,
      { request: req, userId: req.user.id },
    );
  }

  @Post('reports/submit')
  @ApiOperation({ summary: '结算后同步已结算工资表给超级管理员' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.BOSS)
  async submitReport(
    @Body() body: { baseId: number; dateFrom?: string; dateTo?: string },
    @Req() req: any,
  ) {
    return this.reportService.submitReport(body, req.user, { request: req, userId: req.user.id });
  }

  @Get('reports/submitted')
  @ApiOperation({ summary: '查询系统自动生成的工资表列表' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.REGION_ADMIN, UserRole.BOSS)
  async getSubmittedReports(@Query() query: any, @Req() req: any) {
    return this.reportService.getSubmittedReports(query, req.user);
  }

  @Get('reports/:reportId')
  @ApiOperation({ summary: '查询系统自动生成的工资表明细' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.REGION_ADMIN, UserRole.BOSS)
  async getSubmittedReportDetail(
    @Param('reportId', ParseIntPipe) reportId: number,
    @Req() req: any,
  ) {
    return this.reportService.getSubmittedReportDetail(reportId, req.user);
  }

  @Get('reports/:reportId/export')
  @ApiOperation({ summary: '导出系统自动生成的工资表 XLSX' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.REGION_ADMIN, UserRole.BOSS)
  async exportSubmittedReport(
    @Param('reportId', ParseIntPipe) reportId: number,
    @Req() req: any,
  ) {
    return this.reportService.exportSubmittedReport(reportId, req.user, { request: req, userId: req.user.id });
  }

  @Get('export/report')
  @ApiOperation({ summary: 'Export salary report as XLSX' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.REGION_ADMIN, UserRole.BOSS, UserRole.BASE_MANAGER, UserRole.FIELD_MANAGER)
  async exportReport(@Query() query: any, @Req() req: any) {
    return this.reportService.exportLiveReport(query, req.user, { request: req, userId: req.user.id });
  }

  @Get(':salaryId/payments')
  @ApiOperation({ summary: '查询工资单关联的支付记录' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.REGION_ADMIN, UserRole.BASE_MANAGER, UserRole.FIELD_MANAGER, UserRole.WORKER)
  async getPaymentsBySalary(
    @Param('salaryId', ParseIntPipe) salaryId: number,
  ) {
    return this.paymentService.getPaymentsBySalary(salaryId);
  }
}
