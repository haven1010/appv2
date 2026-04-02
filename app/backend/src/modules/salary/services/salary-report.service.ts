/**
 * Layer: Backend Service
 * Responsibility: Builds, stores, and exports payroll reports that flow from bosses to super admins.
 * Notes: Keep comments focused on intent, invariants, side effects, and cross-module contracts.
 */
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseScopeService } from '../../base/services/base-scope.service';
import { OperationType, ResourceType } from '../../common/entities/operation-log.entity';
import { OperationLogContext, OperationLogService } from '../../common/services/operation-log.service';
import { buildXlsxBase64 } from '../../common/utils/xlsx-export.util';
import { SysUser, UserRole, isSuperAdmin } from '../../user/entities/sys-user.entity';
import { SalaryStatus } from '../entities/labor-salary.entity';
import { SalaryReportSubmission } from '../entities/salary-report-submission.entity';
import { SalaryService } from '../salary.service';

type SalaryReportRow = {
  serial: number;
  name: string;
  gender: string;
  idCard: string;
  age: string;
  address: string;
  poorHousehold: string;
  phone: string;
  workLocation: string;
  workType: string;
  workStartTime: string;
  workEndTime: string;
  remark: string;
  totalIncome: number;
  signature: string;
};

type SalaryReportBaseSheet = {
  baseId: string;
  baseName: string;
  rows: SalaryReportRow[];
};

type SalaryReportSummary = {
  salaryRecordCount: number;
  workerCount: number;
  totalIncome: number;
};

type SalaryReportPayload = {
  filters: {
    baseId: number;
    baseName: string;
    dateFrom: string | null;
    dateTo: string | null;
    keyword: string | null;
    status: SalaryStatus;
  };
  rows: SalaryReportRow[];
  baseRows?: SalaryReportBaseSheet[];
  summary: SalaryReportSummary;
  sourceSalaryIds: number[];
};

type SalaryReportQuery = {
  baseId?: number | string;
  dateFrom?: string;
  dateTo?: string;
  keyword?: string;
  status?: number | string;
};

@Injectable()
export class SalaryReportService {
  constructor(
    @InjectRepository(SalaryReportSubmission)
    private readonly reportRepo: Repository<SalaryReportSubmission>,
    @InjectRepository(SysUser)
    private readonly userRepo: Repository<SysUser>,
    private readonly salaryService: SalaryService,
    private readonly baseScopeService: BaseScopeService,
    private readonly operationLogService: OperationLogService,
  ) {}

  private resolveRole(user: { role?: string; roleKey?: UserRole }): string | undefined {
    return user.role ?? user.roleKey;
  }

  private inferGender(idCard: string): string {
    const id = String(idCard || '').trim();
    if (id.length !== 18) return '未知';
    const marker = Number(id.charAt(16));
    if (!Number.isFinite(marker)) return '未知';
    return marker % 2 === 0 ? '女' : '男';
  }

  private resolveGender(value: unknown, idCard: string): string {
    const text = String(value || '').trim().toLowerCase();
    if (text === 'male') return '男';
    if (text === 'female') return '女';
    return this.inferGender(idCard);
  }

  private calcAgeFromIdCard(idCard: string, now = new Date()): string {
    const text = String(idCard || '').trim();
    if (!/^\d{17}[\dX]$/i.test(text)) return '';

    const birth = text.slice(6, 14);
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

  private normalizeNumericQuery(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }

  private normalizeDateText(value: unknown): string | null {
    const text = String(value || '').trim();
    return text || null;
  }

  private normalizeKeyword(value: unknown): string {
    return String(value || '').trim();
  }

  private buildFileName(dateFrom: string | null, dateTo: string | null): string {
    const range = dateFrom && dateTo
      ? `${dateFrom}_${dateTo}`
      : new Date().toISOString().slice(0, 10);
    return `salary-report-${range}.xlsx`;
  }

  private buildRowsFromSalaryList(list: any[]): { rows: SalaryReportRow[]; baseRows: SalaryReportBaseSheet[]; summary: SalaryReportSummary; sourceSalaryIds: number[] } {
    const groupedByBase: Record<string, { baseName: string; workers: Record<string, any> }> = {};
    const sourceSalaryIds = new Set<number>();

    for (let i = 0; i < list.length; i += 1) {
      const row: any = list[i] || {};
      const baseId = String(row.baseId || 'unknown');
      const baseName = row.baseName || `基地#${baseId}`;
      const uid = row.workerUid || `unknown-${i}`;
      const name = row.workerName || '-';
      const idCard = row.workerIdCard || '';
      const workerKey = `${uid}__${idCard || name}`;
      const salaryId = Number(row.id);

      if (Number.isFinite(salaryId) && salaryId > 0) {
        sourceSalaryIds.add(salaryId);
      }

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
          totalIncome: 0,
          signature: '',
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

      target.totalIncome += Number(row.totalAmount || row.amount || 0);
    }

    const baseRows = Object.keys(groupedByBase)
      .map((baseId) => {
        const base = groupedByBase[baseId];
        const rows = Object.keys(base.workers)
          .map((workerKey) => {
            const item = base.workers[workerKey];
            return {
              serial: 0,
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
              totalIncome: Number(item.totalIncome.toFixed(2)),
              signature: item.signature || '',
            } as SalaryReportRow;
          })
          .sort((a, b) => String(a.name).localeCompare(String(b.name), 'zh-Hans-CN'))
          .map((item, index) => ({ ...item, serial: index + 1 }));

        return {
          baseId,
          baseName: base.baseName,
          rows,
        };
      })
      .sort((a, b) => String(a.baseName).localeCompare(String(b.baseName), 'zh-Hans-CN'));

    const rows = baseRows
      .flatMap((item) => item.rows.map((row) => ({ ...row, workLocation: item.baseName || row.workLocation })))
      .map((item, index) => ({ ...item, serial: index + 1 }));

    return {
      rows,
      baseRows,
      summary: {
        salaryRecordCount: list.length,
        workerCount: rows.length,
        totalIncome: Number(rows.reduce((sum, item) => sum + Number(item.totalIncome || 0), 0).toFixed(2)),
      },
      sourceSalaryIds: Array.from(sourceSalaryIds),
    };
  }

  private buildXlsxPayload(rows: SalaryReportRow[], fileName: string, baseRows: SalaryReportBaseSheet[] = []) {
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
      '务工总收入',
      '领款签字',
    ];
    const toSheetRows = (items: SalaryReportRow[]) => items.map((item) => ([
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
      item.totalIncome,
      item.signature || '',
    ]));
    const sheets = [
      {
        name: this.normalizeSheetName(`总名单${rows.length}人`, '总名单'),
        columns,
        rows: toSheetRows(rows),
      },
    ].concat(
      baseRows.map((item) => ({
        name: this.normalizeSheetName(`${item.baseName}${item.rows.length}`, `基地${item.baseId}`),
        columns,
        rows: toSheetRows(item.rows),
      })),
    );

    return {
      fileName,
      rowCount: rows.length,
      fileBase64: buildXlsxBase64(sheets),
    };
  }

  private parseReportPayload(raw: string | null | undefined): SalaryReportPayload {
    if (!raw) {
      throw new BadRequestException('工资表快照为空');
    }

    let parsed: SalaryReportPayload | null = null;
    try {
      parsed = JSON.parse(raw);
    } catch (_) {
      parsed = null;
    }

    if (!parsed || !Array.isArray(parsed.rows) || !parsed.summary || !parsed.filters) {
      throw new BadRequestException('工资表快照格式无效');
    }

    return parsed;
  }

  private async assertReportAccess(
    report: SalaryReportSubmission,
    user: { id: number; role?: string; roleKey?: UserRole },
  ): Promise<void> {
    const role = this.resolveRole(user);
    if (isSuperAdmin(role || '')) {
      return;
    }

    if (role === UserRole.BOSS && Number(report.bossId) === Number(user.id || 0)) {
      return;
    }

    throw new ForbiddenException('无权查看该工资表');
  }

  async buildLiveReportData(query: SalaryReportQuery, user: { id: number; role?: string; roleKey?: UserRole }) {
    const role = this.resolveRole(user);
    const baseId = this.normalizeNumericQuery(query.baseId);
    const dateFrom = this.normalizeDateText(query.dateFrom);
    const dateTo = this.normalizeDateText(query.dateTo);
    const keyword = this.normalizeKeyword(query.keyword);

    if (dateFrom && dateTo && dateFrom > dateTo) {
      throw new BadRequestException('开始日期不能晚于结束日期');
    }

    const normalizedQuery: any = {
      ...query,
      baseId: baseId ?? undefined,
      dateFrom: dateFrom ?? undefined,
      dateTo: dateTo ?? undefined,
      keyword: keyword || undefined,
    };

    if (role === UserRole.BOSS && normalizedQuery.status === undefined) {
      normalizedQuery.status = SalaryStatus.PAID;
    }

    const listRes = await this.salaryService.getList(normalizedQuery, user);
    const list: any[] = Array.isArray(listRes?.list) ? listRes.list : [];
    const { rows, baseRows, summary, sourceSalaryIds } = this.buildRowsFromSalaryList(list);
    const uniqueBaseIds = Array.from(
      new Set(
        list
          .map((item) => Number(item?.baseId || 0))
          .filter((item) => Number.isInteger(item) && item > 0),
      ),
    );
    const resolvedBaseId = baseId ?? (uniqueBaseIds.length === 1 ? uniqueBaseIds[0] : null);
    const baseName =
      uniqueBaseIds.length === 1 && list.length > 0
        ? String(list[0]?.baseName || '-')
        : '';
    const status =
      normalizedQuery.status !== undefined && normalizedQuery.status !== null
        ? Number(normalizedQuery.status)
        : null;

    return {
      query: {
        baseId: resolvedBaseId,
        dateFrom,
        dateTo,
        keyword: keyword || null,
        status,
      },
      baseName,
      rows,
      baseRows,
      summary,
      sourceSalaryIds,
    };
  }

  async exportLiveReport(
    query: SalaryReportQuery,
    user: { id: number; role?: string; roleKey?: UserRole },
    context?: OperationLogContext,
  ) {
    const reportData = await this.buildLiveReportData(query, user);
    const fileName = this.buildFileName(reportData.query.dateFrom, reportData.query.dateTo);
    const exportPayload = this.buildXlsxPayload(reportData.rows, fileName, reportData.baseRows);
    const resourceId = Number(reportData.query.baseId || 0);

    await this.operationLogService.logWithContext({
      operationType: OperationType.EXPORT,
      resourceType: ResourceType.SALARY,
      resourceId,
      userId: user.id,
      request: context?.request,
      description: `导出工资报表: baseId=${resourceId || 'all'}, rowCount=${exportPayload.rowCount}, fileName=${fileName}`,
      beforeData: {
        baseId: reportData.query.baseId,
        dateFrom: reportData.query.dateFrom,
        dateTo: reportData.query.dateTo,
        status: reportData.query.status,
        keyword: reportData.query.keyword,
      },
      afterData: {
        rowCount: exportPayload.rowCount,
        fileName,
      },
    });

    return exportPayload;
  }

  async submitReport(
    input: SalaryReportQuery,
    user: { id: number; role?: string; roleKey?: UserRole },
    context?: OperationLogContext,
  ) {
    const role = this.resolveRole(user);
    if (role !== UserRole.BOSS) {
      throw new ForbiddenException('仅老板可提交工资表给超级管理员');
    }

    const baseId = this.normalizeNumericQuery(input.baseId);
    if (!baseId) {
      throw new BadRequestException('请选择需要提交的基地');
    }

    const dateFrom = this.normalizeDateText(input.dateFrom);
    const dateTo = this.normalizeDateText(input.dateTo);
    if (dateFrom && dateTo && dateFrom > dateTo) {
      throw new BadRequestException('开始日期不能晚于结束日期');
    }

    const [base, boss] = await Promise.all([
      this.baseScopeService.assertCanOwnBase(user, baseId),
      this.userRepo.findOne({
        where: { id: user.id, isDeleted: false },
        select: ['id', 'name'],
      }),
    ]);

    const reportData = await this.buildLiveReportData(
      {
        baseId,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        keyword: '',
        status: SalaryStatus.PAID,
      },
      user,
    );

    if (reportData.summary.salaryRecordCount <= 0) {
      throw new BadRequestException('当前筛选暂无已结算工资，无法生成工资表');
    }

    const fileName = this.buildFileName(dateFrom, dateTo);
    const payload: SalaryReportPayload = {
      filters: {
        baseId,
        baseName: base.baseName || reportData.baseName || '-',
        dateFrom,
        dateTo,
        keyword: null,
        status: SalaryStatus.PAID,
      },
      rows: reportData.rows,
      summary: reportData.summary,
      sourceSalaryIds: reportData.sourceSalaryIds,
    };

    const saved = await this.reportRepo.save(this.reportRepo.create({
      baseId,
      bossId: user.id,
      submittedBy: user.id,
      baseNameSnapshot: payload.filters.baseName,
      bossNameSnapshot: boss?.name || '老板',
      dateFrom,
      dateTo,
      salaryRecordCount: payload.summary.salaryRecordCount,
      workerCount: payload.summary.workerCount,
      totalIncome: payload.summary.totalIncome,
      fileName,
      reportPayload: JSON.stringify(payload),
    }));

    await this.operationLogService.logWithContext({
      operationType: OperationType.CREATE,
      resourceType: ResourceType.SALARY,
      resourceId: saved.id,
      userId: user.id,
      request: context?.request,
      description: `老板提交工资表给超级管理员: reportId=${saved.id}, baseId=${baseId}, fileName=${fileName}`,
      afterData: {
        reportId: saved.id,
        baseId,
        dateFrom,
        dateTo,
        fileName,
        salaryRecordCount: saved.salaryRecordCount,
        workerCount: saved.workerCount,
        totalIncome: Number(saved.totalIncome || 0),
      },
    });

    return {
      id: saved.id,
      baseId: saved.baseId,
      baseName: saved.baseNameSnapshot,
      bossId: saved.bossId,
      bossName: saved.bossNameSnapshot,
      dateFrom: saved.dateFrom,
      dateTo: saved.dateTo,
      fileName: saved.fileName,
      salaryRecordCount: saved.salaryRecordCount,
      workerCount: saved.workerCount,
      totalIncome: Number(saved.totalIncome || 0),
      createdAt: saved.createdAt,
    };
  }

  async getSubmittedReports(
    query: SalaryReportQuery,
    user: { id: number; role?: string; roleKey?: UserRole },
  ) {
    const role = this.resolveRole(user);
    if (!isSuperAdmin(role || '') && role !== UserRole.BOSS) {
      throw new ForbiddenException('无权查看工资表提交记录');
    }

    const qb = this.reportRepo
      .createQueryBuilder('report')
      .orderBy('report.createdAt', 'DESC');

    if (role === UserRole.BOSS) {
      qb.andWhere('report.bossId = :bossId', { bossId: user.id });
    }

    const baseId = this.normalizeNumericQuery(query.baseId);
    const dateFrom = this.normalizeDateText(query.dateFrom);
    const dateTo = this.normalizeDateText(query.dateTo);
    const keyword = this.normalizeKeyword(query.keyword);

    if (baseId) {
      qb.andWhere('report.baseId = :baseId', { baseId });
    }
    if (dateFrom) {
      qb.andWhere('(report.dateTo IS NULL OR report.dateTo >= :dateFrom)', { dateFrom });
    }
    if (dateTo) {
      qb.andWhere('(report.dateFrom IS NULL OR report.dateFrom <= :dateTo)', { dateTo });
    }
    if (keyword) {
      qb.andWhere(
        '(report.baseNameSnapshot LIKE :kw OR report.bossNameSnapshot LIKE :kw OR report.fileName LIKE :kw)',
        { kw: `%${keyword}%` },
      );
    }

    const list = await qb.getMany();
    return list.map((item) => ({
      id: item.id,
      baseId: item.baseId,
      baseName: item.baseNameSnapshot,
      bossId: item.bossId,
      bossName: item.bossNameSnapshot,
      dateFrom: item.dateFrom,
      dateTo: item.dateTo,
      fileName: item.fileName,
      salaryRecordCount: item.salaryRecordCount,
      workerCount: item.workerCount,
      totalIncome: Number(item.totalIncome || 0),
      createdAt: item.createdAt,
    }));
  }

  async getSubmittedReportDetail(
    reportId: number,
    user: { id: number; role?: string; roleKey?: UserRole },
  ) {
    const report = await this.reportRepo.findOne({ where: { id: reportId } });
    if (!report) {
      throw new NotFoundException('工资表不存在');
    }

    await this.assertReportAccess(report, user);
    const payload = this.parseReportPayload(report.reportPayload);

    return {
      id: report.id,
      baseId: report.baseId,
      baseName: report.baseNameSnapshot,
      bossId: report.bossId,
      bossName: report.bossNameSnapshot,
      dateFrom: report.dateFrom,
      dateTo: report.dateTo,
      fileName: report.fileName,
      salaryRecordCount: report.salaryRecordCount,
      workerCount: report.workerCount,
      totalIncome: Number(report.totalIncome || 0),
      createdAt: report.createdAt,
      rows: payload.rows,
      summary: payload.summary,
      filters: payload.filters,
      sourceSalaryIds: payload.sourceSalaryIds,
    };
  }

  async exportSubmittedReport(
    reportId: number,
    user: { id: number; role?: string; roleKey?: UserRole },
    context?: OperationLogContext,
  ) {
    const detail = await this.getSubmittedReportDetail(reportId, user);
    const exportPayload = this.buildXlsxPayload(detail.rows, detail.fileName);

    await this.operationLogService.logWithContext({
      operationType: OperationType.EXPORT,
      resourceType: ResourceType.SALARY,
      resourceId: detail.id,
      userId: user.id,
      request: context?.request,
      description: `导出已提交工资表: reportId=${detail.id}, fileName=${detail.fileName}`,
      beforeData: {
        reportId: detail.id,
        baseId: detail.baseId,
        bossId: detail.bossId,
      },
      afterData: {
        rowCount: exportPayload.rowCount,
        fileName: exportPayload.fileName,
      },
    });

    return exportPayload;
  }
}
