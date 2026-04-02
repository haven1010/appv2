/**
 * Layer: Mini Program Page
 * Responsibility: Super-admin payroll center for auto-generating, grouping-by-base, exporting, and archiving salary reports.
 */
const app = getApp();
const { resolveRole, isSuperAdminRole, roleLabel } = require('../../../utils/role');

const HISTORY_KEY = 'admin_payroll_report_history_v1';
const MAX_AUTO_DRAFT_DAYS = 62;

function todayString() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function yesterdayString() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function monthStartString() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

function normalizeArray(res) {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.list)) return res.list;
  if (Array.isArray(res?.records)) return res.records;
  return [];
}

function safeNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function inferGender(idCard) {
  const id = String(idCard || '').trim();
  if (id.length !== 18) return '未知';
  const code = Number(id.charAt(16));
  if (!Number.isFinite(code)) return '未知';
  return code % 2 === 0 ? '女' : '男';
}

function formatTime(value) {
  if (!value) return '-';
  const raw = String(value).trim();
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    return raw.replace('T', ' ').slice(0, 19);
  }
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
}

function buildFilterSummary(baseLabel, dateFrom, dateTo, keyword) {
  const rangeText = `${dateFrom || '-'} ~ ${dateTo || '-'}`;
  const keywordText = keyword ? ` · 关键字: ${keyword}` : '';
  return `${baseLabel || '全部基地'} · ${rangeText}${keywordText}`;
}

function parseDurationFromWorkHours(workHours) {
  const text = String(workHours || '').trim();
  if (!text) return 8;

  const match = text.match(/(\d{1,2}):(\d{1,2})\s*[-~]\s*(\d{1,2}):(\d{1,2})/);
  if (!match) return 8;

  const startHour = safeNumber(match[1], 0);
  const startMinute = safeNumber(match[2], 0);
  const endHour = safeNumber(match[3], 0);
  const endMinute = safeNumber(match[4], 0);

  let start = startHour * 60 + startMinute;
  let end = endHour * 60 + endMinute;
  if (end < start) end += 24 * 60;

  const duration = (end - start) / 60;
  if (!Number.isFinite(duration) || duration <= 0) return 8;
  return Math.max(0.5, Math.round(duration * 10) / 10);
}

function parseDate(dateText) {
  if (!dateText) return null;
  const d = new Date(`${dateText}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function buildDateList(dateFrom, dateTo, maxDays = MAX_AUTO_DRAFT_DAYS) {
  const start = parseDate(dateFrom);
  const end = parseDate(dateTo);
  if (!start || !end || start > end) return [];

  const list = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, '0');
    const d = String(cursor.getDate()).padStart(2, '0');
    list.push(`${y}-${m}-${d}`);
    if (list.length > maxDays) return [];
    cursor.setDate(cursor.getDate() + 1);
  }
  return list;
}

function cloneBaseReportList(list) {
  return (Array.isArray(list) ? list : []).map((base) => ({
    key: base.key,
    baseId: String(base.baseId || ''),
    baseName: base.baseName || '-',
    totalWorkers: safeNumber(base.totalWorkers, 0),
    totalIncome: safeNumber(base.totalIncome, 0),
    expanded: !!base.expanded,
    rows: (Array.isArray(base.rows) ? base.rows : []).map((row, index) => ({
      serial: safeNumber(row.serial, index + 1),
      name: row.name || '-',
      gender: row.gender || '未知',
      idCard: row.idCard || '-',
      address: row.address || '-',
      poorHousehold: row.poorHousehold || '未知',
      totalIncome: safeNumber(row.totalIncome, 0),
      signature: row.signature || '',
    })),
  }));
}

function createEmptyAutoSummary(note = '') {
  return {
    enabled: false,
    created: 0,
    skipped: 0,
    failed: 0,
    note,
  };
}

Page({
  data: {
    loading: true,
    reportLoading: false,

    role: 'worker',
    roleText: '',
    userInfo: null,
    activeNav: 'payroll',

    baseOptions: [{ label: '全部基地', value: '' }],
    baseIndex: 0,
    dateFrom: monthStartString(),
    dateTo: todayString(),
    keyword: '',

    hasReport: false,
    reportFilterText: '',
    reportGeneratedAtText: '',

    baseReportList: [],
    totalBases: 0,
    totalWorkers: 0,
    totalIncome: 0,
    autoDraftSummary: createEmptyAutoSummary(),

    historyList: [],
    selectedHistoryId: '',
  },

  onLoad() {
    if (!this.ensureSuperAdmin()) return;
    this.initPage();
  },

  onShow() {
    if (!this.ensureSuperAdmin()) return;
    this.initPage();
  },

  onPullDownRefresh() {
    this.initPage().finally(() => wx.stopPullDownRefresh());
  },

  ensureSuperAdmin() {
    const token = wx.getStorageSync('token');
    const userInfo = app.getCurrentUser();
    const role = resolveRole(userInfo);

    if (!token || !userInfo) {
      wx.reLaunch({ url: '/pages/login/login' });
      return false;
    }

    if (!isSuperAdminRole(role)) {
      wx.showModal({
        title: '无权限',
        content: '工资表中心仅超级管理员可访问。',
        showCancel: false,
        success: () => wx.navigateBack({ delta: 1 }),
      });
      return false;
    }

    this.setData({
      role,
      roleText: roleLabel(role),
      userInfo,
    });
    return true;
  },

  async initPage() {
    this.setData({ loading: true });
    try {
      await this.loadBaseOptions();
      this.loadHistory();
      if (!this.data.hasReport) {
        await this.loadPayrollReport({ autoExpand: false });
      }
    } catch (err) {
      wx.showToast({ title: err.message || '初始化工资中心失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  async loadBaseOptions() {
    const list = await app.request({ url: '/base?showAll=true', method: 'GET' }).catch(() => []);
    const options = [{ label: '全部基地', value: '' }].concat(
      normalizeArray(list).map((item) => ({
        label: item.baseName || item.name || `基地#${item.id}`,
        value: String(item.id),
      })),
    );

    let baseIndex = this.data.baseIndex || 0;
    if (baseIndex >= options.length) baseIndex = 0;
    this.setData({ baseOptions: options, baseIndex });
  },

  getCurrentFilter() {
    return {
      baseValue: this.data.baseOptions[this.data.baseIndex]?.value || '',
      baseLabel: this.data.baseOptions[this.data.baseIndex]?.label || '全部基地',
      dateFrom: this.data.dateFrom,
      dateTo: this.data.dateTo,
      keyword: String(this.data.keyword || '').trim(),
    };
  },

  buildSalaryUrl(filter) {
    const current = filter || this.getCurrentFilter();
    const params = [];

    if (current.baseValue) params.push(`baseId=${encodeURIComponent(current.baseValue)}`);
    if (current.dateFrom) params.push(`dateFrom=${encodeURIComponent(current.dateFrom)}`);
    if (current.dateTo) params.push(`dateTo=${encodeURIComponent(current.dateTo)}`);
    if (current.keyword) params.push(`keyword=${encodeURIComponent(current.keyword)}`);

    const query = params.join('&');
    return query ? `/salary/list?${query}` : '/salary/list';
  },

  buildBaseReports(list, options = {}) {
    const { autoExpand = false } = options;
    const grouped = {};

    for (let i = 0; i < list.length; i += 1) {
      const row = list[i] || {};
      const baseId = String(row.baseId || 'unknown');
      const baseName = row.baseName || `基地#${baseId}`;
      const workerName = row.workerName || '-';
      const workerUid = row.workerUid || `unknown-${i}`;
      const idCard = row.workerIdCard || '';
      const workerKey = `${workerUid}__${idCard || workerName}`;

      if (!grouped[baseId]) {
        grouped[baseId] = {
          baseId,
          baseName,
          workerMap: {},
        };
      }

      if (!grouped[baseId].workerMap[workerKey]) {
        grouped[baseId].workerMap[workerKey] = {
          name: workerName,
          gender: inferGender(idCard),
          idCard: idCard || '-',
          address: row.workerAddress || row.address || '-',
          poorHousehold:
            row.isPoorHousehold === true || row.isPoor === true
              ? '是'
              : row.isPoorHousehold === false || row.isPoor === false
                ? '否'
                : '未知',
          totalIncome: 0,
          signature: '',
        };
      }

      grouped[baseId].workerMap[workerKey].totalIncome += safeNumber(row.totalAmount || row.amount, 0);
    }

    const baseReportList = Object.keys(grouped)
      .map((baseId) => {
        const base = grouped[baseId];
        const rows = Object.keys(base.workerMap)
          .map((key) => ({
            name: base.workerMap[key].name,
            gender: base.workerMap[key].gender,
            idCard: base.workerMap[key].idCard,
            address: base.workerMap[key].address,
            poorHousehold: base.workerMap[key].poorHousehold,
            totalIncome: Number(base.workerMap[key].totalIncome.toFixed(2)),
            signature: base.workerMap[key].signature,
          }))
          .sort((a, b) => b.totalIncome - a.totalIncome)
          .map((item, index) => ({
            serial: index + 1,
            name: item.name,
            gender: item.gender,
            idCard: item.idCard,
            address: item.address,
            poorHousehold: item.poorHousehold,
            totalIncome: item.totalIncome,
            signature: item.signature,
          }));

        const totalIncome = Number(rows.reduce((sum, item) => sum + safeNumber(item.totalIncome, 0), 0).toFixed(2));

        return {
          key: `base-${baseId}`,
          baseId,
          baseName: base.baseName,
          rows,
          totalWorkers: rows.length,
          totalIncome,
          expanded: false,
        };
      })
      .sort((a, b) => String(a.baseName || '').localeCompare(String(b.baseName || '')));

    if (autoExpand && baseReportList.length) {
      baseReportList[0].expanded = true;
    }

    const totalWorkers = baseReportList.reduce((sum, item) => sum + safeNumber(item.totalWorkers, 0), 0);
    const totalIncome = Number(
      baseReportList.reduce((sum, item) => sum + safeNumber(item.totalIncome, 0), 0).toFixed(2),
    );

    return {
      baseReportList,
      totalBases: baseReportList.length,
      totalWorkers,
      totalIncome,
    };
  },

  getTargetBaseIds(filter) {
    if (filter.baseValue) return [String(filter.baseValue)];
    return this.data.baseOptions
      .filter((item) => item.value)
      .map((item) => String(item.value));
  },

  isSkippableDraftError(err) {
    const message = String(err?.message || '').toLowerCase();
    return /not checked in|not_checked_in|already|confirmed|paid|cannot|exists|not found/.test(message);
  },

  async buildSalaryPayload(record, jobCache) {
    const jobId = safeNumber(record?.jobId, 0);
    if (!jobId) return {};

    if (!jobCache[jobId]) {
      jobCache[jobId] = await app.request({
        url: `/base/jobs/${jobId}`,
        method: 'GET',
      }).catch(() => null);
    }

    const job = jobCache[jobId];
    if (!job) return {};

    const payType = safeNumber(job.payType, 0);
    const payload = {};

    if (payType === 2) {
      payload.duration = parseDurationFromWorkHours(job.workHours);
    } else if (payType === 3) {
      payload.count = Math.max(1, safeNumber(job.targetCount, 1));
    }

    return payload;
  },

  async autoGenerateSalaryDrafts(filter) {
    const endOfAuto = filter.dateTo && filter.dateTo < todayString() ? filter.dateTo : yesterdayString();
    if (!filter.dateFrom || !filter.dateTo || filter.dateFrom > filter.dateTo) {
      return createEmptyAutoSummary();
    }
    if (filter.dateFrom > endOfAuto) {
      return createEmptyAutoSummary();
    }

    const dateList = buildDateList(filter.dateFrom, endOfAuto, MAX_AUTO_DRAFT_DAYS);
    if (!dateList.length) {
      return createEmptyAutoSummary(`自动补齐仅支持 ${MAX_AUTO_DRAFT_DAYS} 天内的工期区间`);
    }

    const baseIds = this.getTargetBaseIds(filter);
    if (!baseIds.length) {
      return createEmptyAutoSummary();
    }

    const result = {
      enabled: true,
      created: 0,
      skipped: 0,
      failed: 0,
      note: '',
    };

    const jobCache = {};

    for (let i = 0; i < baseIds.length; i += 1) {
      const baseId = baseIds[i];
      const listRes = await app.request({
        url: `/salary/list?baseId=${encodeURIComponent(baseId)}&dateFrom=${encodeURIComponent(filter.dateFrom)}&dateTo=${encodeURIComponent(endOfAuto)}`,
        method: 'GET',
      }).catch(() => ({ list: [] }));

      const existingSet = new Set(
        normalizeArray(listRes)
          .map((item) => safeNumber(item.signupId, 0))
          .filter((id) => id > 0),
      );

      for (let j = 0; j < dateList.length; j += 1) {
        const workDate = dateList[j];
        const recordsRes = await app.request({
          url: `/attendance/records?baseId=${encodeURIComponent(baseId)}&date=${encodeURIComponent(workDate)}`,
          method: 'GET',
        }).catch(() => ({ records: [] }));

        const records = normalizeArray(recordsRes);
        for (let k = 0; k < records.length; k += 1) {
          const record = records[k] || {};
          const status = safeNumber(record.status, -1);
          const signupId = safeNumber(record.id || record.signupId, 0);

          if (status !== 1 || !signupId) {
            continue;
          }
          if (existingSet.has(signupId)) {
            result.skipped += 1;
            continue;
          }

          const payload = await this.buildSalaryPayload(record, jobCache);
          try {
            await app.request({
              url: `/salary/calculate/${signupId}`,
              method: 'POST',
              data: payload,
            });
            existingSet.add(signupId);
            result.created += 1;
          } catch (err) {
            if (this.isSkippableDraftError(err)) {
              result.skipped += 1;
            } else {
              result.failed += 1;
            }
          }
        }
      }
    }

    return result;
  },

  async loadPayrollReport(options = {}) {
    const { autoExpand = false } = options;
    const filter = this.getCurrentFilter();

    if (filter.dateFrom && filter.dateTo && filter.dateFrom > filter.dateTo) {
      wx.showToast({ title: '开始日期不能晚于结束日期', icon: 'none' });
      return;
    }

    this.setData({ reportLoading: true });
    wx.showLoading({ title: '生成中...', mask: true });
    try {
      const autoDraftSummary = await this.autoGenerateSalaryDrafts(filter);
      const salaryRes = await app.request({ url: this.buildSalaryUrl(filter), method: 'GET' }).catch(() => ({ list: [] }));
      const list = normalizeArray(salaryRes);

      const report = this.buildBaseReports(list, { autoExpand });
      this.setData({
        baseReportList: report.baseReportList,
        totalBases: report.totalBases,
        totalWorkers: report.totalWorkers,
        totalIncome: report.totalIncome,
        autoDraftSummary,
        selectedHistoryId: '',
        hasReport: true,
        reportFilterText: buildFilterSummary(filter.baseLabel, filter.dateFrom, filter.dateTo, filter.keyword),
        reportGeneratedAtText: formatTime(new Date().toISOString()),
      });

      if (!report.baseReportList.length) {
        wx.showToast({ title: '当前筛选暂无工资数据', icon: 'none' });
      }
    } catch (err) {
      wx.showToast({ title: err.message || '加载工资表失败', icon: 'none' });
    } finally {
      wx.hideLoading();
      this.setData({ reportLoading: false });
    }
  },

  toggleBaseReport(e) {
    const baseId = String(e.currentTarget.dataset.baseId || '');
    if (!baseId) return;

    const list = cloneBaseReportList(this.data.baseReportList);
    const index = list.findIndex((item) => String(item.baseId) === baseId);
    if (index < 0) return;

    list[index].expanded = !list[index].expanded;
    this.setData({ baseReportList: list });
  },

  onBaseChange(e) {
    this.setData({ baseIndex: Number(e.detail.value) });
  },

  onDateFromChange(e) {
    this.setData({ dateFrom: e.detail.value });
  },

  onDateToChange(e) {
    this.setData({ dateTo: e.detail.value });
  },

  onKeywordInput(e) {
    this.setData({ keyword: e.detail.value });
  },

  searchReport() {
    this.loadPayrollReport({ autoExpand: true });
  },

  resetReport() {
    this.setData({
      baseIndex: 0,
      dateFrom: monthStartString(),
      dateTo: todayString(),
      keyword: '',
      selectedHistoryId: '',
      baseReportList: [],
      totalBases: 0,
      totalWorkers: 0,
      totalIncome: 0,
      autoDraftSummary: createEmptyAutoSummary(),
      hasReport: false,
      reportFilterText: '',
      reportGeneratedAtText: '',
    });
  },

  async exportReport() {
    const baseReportList = this.data.baseReportList || [];
    if (!baseReportList.length) {
      wx.showToast({ title: '暂无可导出的工资表', icon: 'none' });
      return;
    }

    const listUrl = this.buildSalaryUrl(this.getCurrentFilter());
    const exportUrl = listUrl
      .replace('/salary/list?', '/salary/export/report?')
      .replace('/salary/list', '/salary/export/report');

    wx.showLoading({ title: '导出中...', mask: true });
    try {
      const res = await app.exportXlsx({
        url: exportUrl,
        method: 'GET',
        fileName: `薪资报表-${todayString()}.xlsx`,
      });
      wx.showToast({ title: '导出成功', icon: 'success' });
      if (res?.filePath) {
        console.log('[export] salary xlsx file =', res.filePath);
      }
    } catch (err) {
      wx.showToast({ title: err.message || '导出失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  archiveReport() {
    const baseReportList = this.data.baseReportList || [];
    if (!baseReportList.length) {
      wx.showToast({ title: '暂无数据可存档', icon: 'none' });
      return;
    }

    const filter = this.getCurrentFilter();
    const history = wx.getStorageSync(HISTORY_KEY) || [];
    const snapshot = {
      id: `report-${Date.now()}`,
      version: 2,
      createdAt: new Date().toISOString(),
      filter: {
        baseLabel: filter.baseLabel,
        baseValue: filter.baseValue,
        dateFrom: filter.dateFrom,
        dateTo: filter.dateTo,
        keyword: filter.keyword,
      },
      summary: {
        totalBases: this.data.totalBases,
        totalWorkers: this.data.totalWorkers,
        totalIncome: this.data.totalIncome,
        autoCreated: this.data.autoDraftSummary?.created || 0,
      },
      baseReportList: cloneBaseReportList(baseReportList),
    };

    const next = [snapshot].concat(Array.isArray(history) ? history : []).slice(0, 20);
    wx.setStorageSync(HISTORY_KEY, next);
    this.loadHistory();
    wx.showToast({ title: '已存档', icon: 'success' });
  },

  normalizeHistorySnapshot(item) {
    if (!item || typeof item !== 'object') return null;

    if (Array.isArray(item.baseReportList)) {
      const baseReportList = cloneBaseReportList(item.baseReportList).map((base) => ({
        ...base,
        expanded: false,
      }));
      const totalBases = safeNumber(item.summary?.totalBases, baseReportList.length);
      const totalWorkers = safeNumber(
        item.summary?.totalWorkers,
        baseReportList.reduce((sum, base) => sum + safeNumber(base.totalWorkers, 0), 0),
      );
      const totalIncome = safeNumber(
        item.summary?.totalIncome,
        baseReportList.reduce((sum, base) => sum + safeNumber(base.totalIncome, 0), 0),
      );
      return {
        baseReportList,
        totalBases,
        totalWorkers,
        totalIncome,
      };
    }

    const legacyRows = Array.isArray(item.rows) ? item.rows : [];
    if (!legacyRows.length) {
      return {
        baseReportList: [],
        totalBases: 0,
        totalWorkers: 0,
        totalIncome: 0,
      };
    }

    const rows = legacyRows.map((row, index) => ({
      serial: safeNumber(row.serial, index + 1),
      name: row.name || '-',
      gender: row.gender || '未知',
      idCard: row.idCard || '-',
      address: row.address || '-',
      poorHousehold: row.poorHousehold || '未知',
      totalIncome: safeNumber(row.totalIncome, 0),
      signature: row.signature || '',
    }));

    const totalIncome = Number(rows.reduce((sum, row) => sum + safeNumber(row.totalIncome, 0), 0).toFixed(2));
    const baseName = item.filter?.baseLabel || '历史工资表';

    return {
      baseReportList: [
        {
          key: 'legacy-base',
          baseId: 'legacy',
          baseName,
          totalWorkers: rows.length,
          totalIncome,
          expanded: false,
          rows,
        },
      ],
      totalBases: 1,
      totalWorkers: rows.length,
      totalIncome,
    };
  },

  loadHistory() {
    const history = wx.getStorageSync(HISTORY_KEY) || [];
    const list = (Array.isArray(history) ? history : []).map((item) => {
      const normalized = this.normalizeHistorySnapshot(item);
      return {
        id: item.id,
        createdAtText: formatTime(item.createdAt),
        label: buildFilterSummary(
          item.filter?.baseLabel || '全部基地',
          item.filter?.dateFrom || '-',
          item.filter?.dateTo || '-',
          item.filter?.keyword || '',
        ),
        totalBases: normalized?.totalBases || 0,
        totalWorkers: normalized?.totalWorkers || 0,
        totalIncome: normalized?.totalIncome || 0,
      };
    });
    this.setData({ historyList: list });
  },

  applyHistory(e) {
    const id = e.currentTarget.dataset.id;
    const history = wx.getStorageSync(HISTORY_KEY) || [];
    const item = (Array.isArray(history) ? history : []).find((x) => x.id === id);
    if (!item) return;

    const normalized = this.normalizeHistorySnapshot(item);
    const baseValue = String(item.filter?.baseValue || '');
    const baseIndex = this.data.baseOptions.findIndex((x) => String(x.value) === baseValue);

    this.setData({
      baseIndex: baseIndex >= 0 ? baseIndex : 0,
      dateFrom: item.filter?.dateFrom || monthStartString(),
      dateTo: item.filter?.dateTo || todayString(),
      keyword: item.filter?.keyword || '',
      baseReportList: normalized?.baseReportList || [],
      totalBases: normalized?.totalBases || 0,
      totalWorkers: normalized?.totalWorkers || 0,
      totalIncome: normalized?.totalIncome || 0,
      autoDraftSummary: createEmptyAutoSummary(),
      selectedHistoryId: id,
      hasReport: true,
      reportFilterText: buildFilterSummary(
        item.filter?.baseLabel || '全部基地',
        item.filter?.dateFrom || '-',
        item.filter?.dateTo || '-',
        item.filter?.keyword || '',
      ),
      reportGeneratedAtText: formatTime(item.createdAt),
    });
  },

  clearHistory() {
    wx.removeStorageSync(HISTORY_KEY);
    this.setData({ historyList: [], selectedHistoryId: '' });
    wx.showToast({ title: '历史已清空', icon: 'none' });
  },

  switchAdminNav(e) {
    const target = e.currentTarget.dataset.target;
    const map = {
      home: '/pages/admin/home/home',
      base: '/pages/admin/base/base',
      scan: '/pages/admin/attendance/attendance',
      audit: '/pages/admin/users/users',
      payroll: '/pages/admin/system/system',
      me: '/pages/admin/profile/profile',
    };
    const url = map[target];
    if (!url || target === this.data.activeNav) return;
    wx.redirectTo({ url });
  },
});
