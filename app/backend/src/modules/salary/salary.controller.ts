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

  private resolveGender(value: string | null | undefined, idCard: string): string {
    const text = String(value || '').trim().toLowerCase();
    if (text === 'male') return '男';
    if (text === 'female') return '女';
    return this.inferGender(idCard);
  }

  private calcAgeFromIdCard(idCard: string, now = new Date()): string {
    const id = String(idCard || '').trim();
    if (!/^\d{17}[\dX]$/i.test(id)) return '';

    const birth = id.slice(6, 14);
    const year = Number(birth.slice(0, 4));
    const month = Number(birth.slice(4, 6));
    const day = Number(birth.slice(6, 8));
    if (!year || !month || !day) return '';

    let age = now.getFullYear() - year;
    const currentMonth = now.getMonth() + 1;
    const currentDay = now.getDate();
    if (currentMonth < month || (currentMonth === month && currentDay < day)) {
      age -= 1;
    }
    if (!Number.isFinite(age) || age < 0 || age > 120) return '';
    return String(age);
  }

  private normalizePoorHousehold(value: unknown): string {
    if (value === true || value === 1 || value === '1') return '是';
    if (value === false || value === 0 || value === '0') return '否';
    return '未知';
  }

  private formatDateTime(value: string | Date | null | undefined): string {
    if (!value) return '';
    const date = value instanceof Date ? value : new Date(String(value).replace(' ', 'T'));
    if (Number.isNaN(date.getTime())) {
      return String(value).replace('T', ' ').slice(0, 19);
    }
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    const ss = String(date.getSeconds()).padStart(2, '0');
    return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
  }

  private normalizeSheetName(name: string, fallback: string): string {
    const safe = String(name || '').replace(/[\\/?*[\]:]/g, '').trim();
    const source = safe || fallback;
    return source.slice(0, 31) || fallback;
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

    const groupedByBase: Record<string, any> = {};
    for (let i = 0; i < list.length; i += 1) {
      const row = list[i] || {};
      const baseId = String(row.baseId || 'unknown');
      const baseName = row.baseName || `基地#${baseId}`;
      const uid = row.workerUid || `unknown-${i}`;
      const name = row.workerName || '-';
      const idCard = row.workerIdCard || '';
      const workerKey = `${uid}__${idCard || name}`;

      if (!groupedByBase[baseId]) {
        groupedByBase[baseId] = {
          baseName,
          workers: {},
        };
      }

      if (!groupedByBase[baseId].workers[workerKey]) {
        groupedByBase[baseId].workers[workerKey] = {
          name,
          gender: this.resolveGender(row.workerGender, idCard),
          idCard: idCard || '-',
          age: this.calcAgeFromIdCard(idCard),
          address: row.workerAddress || row.address || '-',
          poorHousehold: this.normalizePoorHousehold(row.isPoorHousehold ?? row.isPoor),
          phone: row.workerPhone || '-',
          workLocation: baseName,
          workTypeSet: {},
          workStartTime: row.workerWorkStartTime || null,
          workEndTime: row.workerWorkEndTime || null,
          remark: '',
        };
      }

      const target = groupedByBase[baseId].workers[workerKey];
      if (row.jobTitle) {
        target.workTypeSet[row.jobTitle] = true;
      }

      const startTime = row.workerWorkStartTime ? new Date(String(row.workerWorkStartTime).replace(' ', 'T')) : null;
      const oldStartTime = target.workStartTime ? new Date(String(target.workStartTime).replace(' ', 'T')) : null;
      if (startTime && !Number.isNaN(startTime.getTime()) && (!oldStartTime || startTime.getTime() < oldStartTime.getTime())) {
        target.workStartTime = row.workerWorkStartTime;
      }

      const endTime = row.workerWorkEndTime ? new Date(String(row.workerWorkEndTime).replace(' ', 'T')) : null;
      const oldEndTime = target.workEndTime ? new Date(String(target.workEndTime).replace(' ', 'T')) : null;
      if (endTime && !Number.isNaN(endTime.getTime()) && (!oldEndTime || endTime.getTime() > oldEndTime.getTime())) {
        target.workEndTime = row.workerWorkEndTime;
      }
    }

    const baseRows = Object.keys(groupedByBase).map((baseId) => {
      const base = groupedByBase[baseId];
      const rows = Object.keys(base.workers)
        .map((workerKey) => {
          const item = base.workers[workerKey];
          return {
            name: item.name,
            gender: item.gender,
            idCard: item.idCard,
            age: item.age,
            address: item.address,
            poorHousehold: item.poorHousehold,
            phone: item.phone,
            workLocation: item.workLocation,
            workType: Object.keys(item.workTypeSet).join(' / ') || '-',
            workStartTime: this.formatDateTime(item.workStartTime),
            workEndTime: this.formatDateTime(item.workEndTime),
            remark: item.remark || '',
          };
        })
        .sort((a, b) => String(a.name).localeCompare(String(b.name), 'zh-Hans-CN'))
        .map((item, index) => ({ serial: index + 1, ...item }));

      return {
        baseId,
        baseName: base.baseName,
        rows,
      };
    });

    const totalRows = baseRows
      .flatMap((item) => item.rows.map((row) => ({ ...row, workLocation: item.baseName || row.workLocation })))
      .map((item, index) => ({ ...item, serial: index + 1 }));

    const columns = [
      '序号',
      '姓名',
      '性别',
      '身份证号',
      '年龄',
      '家庭住址',
      '是否贫困户',
      '联系电话',
      '务工地点',
      '从事工种',
      '务工开始时间',
      '务工结束时间',
      '备注',
    ];

    const toSheetRows = (rows: any[]) =>
      rows.map((item) => ([
        item.serial,
        item.name || '-',
        item.gender || '未知',
        item.idCard || '-',
        item.age || '',
        item.address || '-',
        item.poorHousehold || '未知',
        item.phone || '-',
        item.workLocation || '-',
        item.workType || '-',
        item.workStartTime || '',
        item.workEndTime || '',
        item.remark || '',
      ]));

    const dateFrom = String(query?.dateFrom || '').trim();
    const dateTo = String(query?.dateTo || '').trim();
    const range = dateFrom && dateTo ? `${dateFrom}_${dateTo}` : new Date().toISOString().slice(0, 10);

    const sheets = [
      {
        name: this.normalizeSheetName(`总名单${totalRows.length}人`, '总名单'),
        columns,
        rows: toSheetRows(totalRows),
      },
    ].concat(
      baseRows.map((item) => ({
        name: this.normalizeSheetName(`${item.baseName}${item.rows.length}`, `基地${item.baseId}`),
        columns,
        rows: toSheetRows(item.rows),
      })),
    );

    return {
      fileName: `人员信息表-${range}.xlsx`,
      rowCount: totalRows.length,
      fileBase64: buildXlsxBase64(sheets),
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
