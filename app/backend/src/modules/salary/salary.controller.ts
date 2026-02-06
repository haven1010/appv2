import { Controller, Get, Post, Body, Patch, Param, Query, UseGuards, Req, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SalaryService } from './salary.service';
import { SalaryPaymentService } from './services/salary-payment.service';
import { PaymentMethod } from './entities/salary-payment.entity';

@ApiTags('薪资结算')
@Controller('salary')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SalaryController {
  constructor(
    private salaryService: SalaryService,
    private paymentService: SalaryPaymentService,
  ) {}

  @Get('list')
  @ApiOperation({ summary: '获取工资记录列表' })
  @ApiQuery({ name: 'baseId', required: false, description: '基地ID' })
  @ApiQuery({ name: 'dateFrom', required: false, description: '开始日期 YYYY-MM-DD' })
  @ApiQuery({ name: 'dateTo', required: false, description: '结束日期 YYYY-MM-DD' })
  @ApiQuery({ name: 'status', required: false, description: '状态 0:待审核 1:已确认 2:已发放' })
  async getList(@Query() query: any, @Req() req: any) {
    return this.salaryService.getList(query, req.user);
  }

  @Get('stats')
  @ApiOperation({ summary: '获取薪资汇总统计' })
  @ApiQuery({ name: 'baseId', required: false, description: '基地ID' })
  @ApiQuery({ name: 'dateFrom', required: false, description: '开始日期' })
  @ApiQuery({ name: 'dateTo', required: false, description: '结束日期' })
  async getStats(@Query() query: any, @Req() req: any) {
    return this.salaryService.getStats(query, req.user);
  }

  @Get('worker/stats')
  @ApiOperation({ summary: '采摘工端：获取个人统计（已做天数、待收工资）' })
  async getWorkerStats(@Req() req: any) {
    return this.salaryService.getWorkerStats(req.user.id);
  }

  @Get('worker/pending')
  @ApiOperation({ summary: '采摘工端：获取待确认工资列表' })
  async getWorkerPending(@Req() req: any) {
    return this.salaryService.getWorkerPendingList(req.user.id);
  }

  @Post('worker/:salaryId/confirm')
  @ApiOperation({ summary: '采摘工端：确认工资无误' })
  async workerConfirmSalary(
    @Param('salaryId', ParseIntPipe) salaryId: number,
    @Req() req: any,
  ) {
    return this.salaryService.workerConfirmSalary(salaryId, req.user.id);
  }

  @Post('calculate/:signupId')
  @ApiOperation({ summary: '根据签到记录生成/更新工资草稿' })
  async calculateAndDraft(
    @Param('signupId', ParseIntPipe) signupId: number,
    @Body() body: { duration?: number; count?: number },
    @Req() req: any,
  ) {
    return this.salaryService.calculateAndDraft(signupId, body, req.user.id);
  }

  @Post(':salaryId/payment')
  @ApiOperation({ summary: '创建支付记录（发起发放）' })
  async createPayment(
    @Param('salaryId', ParseIntPipe) salaryId: number,
    @Body() body: { paymentMethod: PaymentMethod },
    @Req() req: any,
  ) {
    return this.paymentService.createPayment(
      salaryId,
      body.paymentMethod,
      req.user.id,
    );
  }

  @Patch('payment/:id/confirm')
  @ApiOperation({ summary: '确认支付（签字）' })
  async confirmPayment(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { confirmSignatureUrl: string },
    @Req() req: any,
  ) {
    return this.paymentService.confirmPayment(id, body.confirmSignatureUrl);
  }

  @Patch('payment/:id/complete')
  @ApiOperation({ summary: '完成支付（上传凭证）' })
  async completePayment(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { paymentVoucherUrl: string },
    @Req() req: any,
  ) {
    return this.paymentService.completePayment(
      id,
      body.paymentVoucherUrl,
      req.user.id,
    );
  }
}
