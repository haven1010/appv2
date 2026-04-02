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
import { PaymentMethod } from './entities/salary-payment.entity';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../user/entities/sys-user.entity';
import { buildXlsxBase64 } from '../common/utils/xlsx-export.util';

@ApiTags('薪资结算')
@Controller('salary')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SalaryController {
  constructor(
    private salaryService: SalaryService,
    private paymentService: SalaryPaymentService,
  ) {}

  private inferGender(idCard: string): string {
    const id = String(idCard || '').trim();
    if (id.length !== 18) return '未知';
    const marker = Number(id.charAt(16));
    if (!Number.isFinite(marker)) return '未知';
    return marker % 2 === 0 ? '女' : '男';
  }

  @Get('list')
  @ApiOperation({ summary: '获取工资记录列表' })
  @ApiQuery({ name: 'baseId', required: false, description: '基地ID' })
  @ApiQuery({ name: 'dateFrom', required: false, description: '开始日期 YYYY-MM-DD' })
  @ApiQuery({ name: 'dateTo', required: false, description: '结束日期 YYYY-MM-DD' })
  @ApiQuery({ name: 'status', required: false, description: '状态 0:待审核 1:已确认 2:已发放' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.REGION_ADMIN, UserRole.BASE_MANAGER, UserRole.FIELD_MANAGER, UserRole.BOSS)
  async getList(@Query() query: any, @Req() req: any) {
    return this.salaryService.getList(query, req.user);
  }

  @Get('stats')
  @ApiOperation({ summary: '获取薪资汇总统计' })
  @ApiQuery({ name: 'baseId', required: false, description: '基地ID' })
  @ApiQuery({ name: 'dateFrom', required: false, description: '开始日期' })
  @ApiQuery({ name: 'dateTo', required: false, description: '结束日期' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.REGION_ADMIN, UserRole.BASE_MANAGER, UserRole.FIELD_MANAGER, UserRole.BOSS)
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

  @Post('calculate/:signupId')
  @ApiOperation({ summary: '根据签到记录生成/更新工资草稿' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.REGION_ADMIN, UserRole.BASE_MANAGER, UserRole.FIELD_MANAGER)
  async calculateAndDraft(
    @Param('signupId', ParseIntPipe) signupId: number,
    @Body() body: { duration?: number; count?: number },
    @Req() req: any,
  ) {
    return this.salaryService.calculateAndDraft(signupId, body, req.user.id, { request: req, userId: req.user.id });
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

  @Get('export/report')
  @ApiOperation({ summary: 'Export salary report as XLSX' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.REGION_ADMIN, UserRole.BASE_MANAGER, UserRole.FIELD_MANAGER)
  async exportReport(@Query() query: any, @Req() req: any) {
    const listRes = await this.salaryService.getList(query, req.user);
    const list: any[] = Array.isArray(listRes?.list) ? listRes.list : [];

    const grouped: Record<string, any> = {};
    for (let i = 0; i < list.length; i += 1) {
      const row: any = list[i] || {};
      const name = row.workerName || '-';
      const uid = row.workerUid || `unknown-${i}`;
      const idCard = row.workerIdCard || '';
      const groupKey = `${uid}__${idCard || name}`;

      if (!grouped[groupKey]) {
        grouped[groupKey] = {
          name,
          gender: this.inferGender(idCard),
          idCard: idCard || '-',
          address: row.workerAddress || row.address || '-',
          poorHousehold:
            row.isPoorHousehold === true || row.isPoor === true
              ? '是'
              : row.isPoorHousehold === false || row.isPoor === false
                ? '否'
                : '未知',
          totalIncome: 0,
        };
      }

      grouped[groupKey].totalIncome += Number(row.totalAmount || row.amount || 0);
    }

    const rows = Object.keys(grouped)
      .map((key, index) => {
        const item = grouped[key];
        return {
          serial: index + 1,
          name: item.name,
          gender: item.gender,
          idCard: item.idCard,
          address: item.address,
          poorHousehold: item.poorHousehold,
          totalIncome: Number(item.totalIncome.toFixed(2)),
        };
      })
      .sort((a, b) => b.totalIncome - a.totalIncome)
      .map((item, index) => Object.assign({}, item, { serial: index + 1 }));

    const excelRows = rows.map((item) => ([
      item.serial,
      item.name,
      item.gender,
      item.idCard,
      item.address,
      item.poorHousehold,
      item.totalIncome,
      '',
    ]));

    const dateFrom = String(query?.dateFrom || '').trim();
    const dateTo = String(query?.dateTo || '').trim();
    const range = dateFrom && dateTo ? `${dateFrom}_${dateTo}` : new Date().toISOString().slice(0, 10);

    return {
      fileName: `薪资报表-${range}.xlsx`,
      rowCount: excelRows.length,
      fileBase64: buildXlsxBase64([
        {
          name: '薪资报表',
          columns: ['序号', '姓名', '性别', '身份证号', '地址', '是否脱贫户', '总收入', '签字'],
          rows: excelRows,
        },
      ]),
    };
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
