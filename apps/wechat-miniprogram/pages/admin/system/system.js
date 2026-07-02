/**
 * Layer: Mini Program Page
 * Responsibility: Lets super admins review payroll reports that the system auto-generates after settlement.
 */
const app = getApp();
const { requireAuth } = require('../../../utils/auth-guard');
const { resolveRole, isSuperAdminRole, roleLabel } = require('../../../utils/role');

function todayString() {
  const d = new Date();
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
  return [];
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

function formatAmount(value) {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num.toFixed(2) : '0.00';
}

function buildPeriodText(dateFrom, dateTo) {
  return `${dateFrom || '-'} ~ ${dateTo || '-'}`;
}

function buildFilterSummary(baseName, bossName, dateFrom, dateTo) {
  return `${baseName || '全部基地'} · ${bossName || '未知老板'} · ${buildPeriodText(dateFrom, dateTo)}`;
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

    reportList: [],
    selectedReportId: '',
    selectedReportFileName: '',

    hasReport: false,
    reportExpanded: false,
    reportFilterText: '',
    reportGeneratedAtText: '',

    rows: [],
    totalWorkers: 0,
    salaryRecordCount: 0,
    totalIncome: '0.00',
  },

  onLoad() {
    if (!requireAuth()) return;
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
      await this.loadSubmittedReports({ autoSelect: true, showEmptyToast: false });
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

  buildSubmittedReportListUrl() {
    const params = [];
    const baseId = this.data.baseOptions[this.data.baseIndex]?.value || '';
    const dateFrom = this.data.dateFrom;
    const dateTo = this.data.dateTo;
    const keyword = String(this.data.keyword || '').trim();

    if (baseId) params.push(`baseId=${encodeURIComponent(baseId)}`);
    if (dateFrom) params.push(`dateFrom=${encodeURIComponent(dateFrom)}`);
    if (dateTo) params.push(`dateTo=${encodeURIComponent(dateTo)}`);
    if (keyword) params.push(`keyword=${encodeURIComponent(keyword)}`);

    const query = params.join('&');
    return query ? `/salary/reports/submitted?${query}` : '/salary/reports/submitted';
  },

  async loadSubmittedReports(options = {}) {
    const { autoSelect = true, showEmptyToast = true } = options;

    if (this.data.dateFrom && this.data.dateTo && this.data.dateFrom > this.data.dateTo) {
      wx.showToast({ title: '开始日期不能晚于结束日期', icon: 'none' });
      return;
    }

    this.setData({ reportLoading: true });
    try {
      const reportRes = await app.request({
        url: this.buildSubmittedReportListUrl(),
        method: 'GET',
      }).catch(() => []);

      const reportList = normalizeArray(reportRes).map((item) => ({
        id: String(item.id),
        baseId: String(item.baseId || ''),
        baseName: item.baseName || '-',
        bossName: item.bossName || '-',
        fileName: item.fileName || '-',
        dateFrom: item.dateFrom || '',
        dateTo: item.dateTo || '',
        createdAt: item.createdAt,
        createdAtText: formatTime(item.createdAt),
        totalIncomeText: formatAmount(item.totalIncome),
        totalIncome: formatAmount(item.totalIncome),
        workerCount: Number(item.workerCount || 0),
        salaryRecordCount: Number(item.salaryRecordCount || 0),
        periodText: buildPeriodText(item.dateFrom, item.dateTo),
      }));

      const currentSelectedId = String(this.data.selectedReportId || '');
      const selectedStillExists = reportList.some((item) => item.id === currentSelectedId);
      const nextSelectedId = selectedStillExists
        ? currentSelectedId
        : autoSelect && reportList.length
          ? reportList[0].id
          : '';

      this.setData({
        reportList,
        selectedReportId: nextSelectedId,
      });

      if (!reportList.length) {
        this.setData({
          selectedReportId: '',
          selectedReportFileName: '',
          rows: [],
          totalWorkers: 0,
          salaryRecordCount: 0,
          totalIncome: '0.00',
          hasReport: false,
          reportExpanded: false,
          reportFilterText: '',
          reportGeneratedAtText: '',
        });
        if (showEmptyToast) {
          wx.showToast({ title: '当前筛选暂无系统生成的工资表', icon: 'none' });
        }
        return;
      }

      if (nextSelectedId) {
        await this.loadSubmittedReportDetail(nextSelectedId, { keepLoading: true });
      }
    } catch (err) {
      wx.showToast({ title: err.message || '加载系统工资表失败', icon: 'none' });
    } finally {
      this.setData({ reportLoading: false });
    }
  },

  async loadSubmittedReportDetail(reportId, options = {}) {
    const { keepLoading = false } = options;

    if (!keepLoading) {
      this.setData({ reportLoading: true });
    }

    try {
      const detail = await app.request({
        url: `/salary/reports/${encodeURIComponent(reportId)}`,
        method: 'GET',
      });

      const rows = normalizeArray(detail.rows).map((item) => ({
        serial: Number(item.serial || 0),
        name: item.name || '-',
        gender: item.gender || '-',
        idCard: item.idCard || '-',
        address: item.address || '-',
        poorHousehold: item.poorHousehold || 'unknown',
        totalIncome: formatAmount(item.totalIncome),
        signature: item.signature || '',
      }));

      this.setData({
        selectedReportId: String(detail.id),
        selectedReportFileName: detail.fileName || '',
        rows,
        totalWorkers: Number(detail.workerCount || detail.summary?.workerCount || rows.length || 0),
        salaryRecordCount: Number(detail.salaryRecordCount || detail.summary?.salaryRecordCount || 0),
        totalIncome: formatAmount(detail.totalIncome || detail.summary?.totalIncome || 0),
        hasReport: true,
        reportExpanded: rows.length > 0,
        reportFilterText: buildFilterSummary(detail.baseName, detail.bossName, detail.dateFrom, detail.dateTo),
        reportGeneratedAtText: formatTime(detail.createdAt),
      });
    } catch (err) {
      wx.showToast({ title: err.message || '加载工资表明细失败', icon: 'none' });
    } finally {
      if (!keepLoading) {
        this.setData({ reportLoading: false });
      }
    }
  },

  toggleReport() {
    if (!this.data.hasReport) return;
    this.setData({ reportExpanded: !this.data.reportExpanded });
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
    this.loadSubmittedReports({ autoSelect: true, showEmptyToast: true });
  },

  resetReport() {
    this.setData({
      baseIndex: 0,
      dateFrom: monthStartString(),
      dateTo: todayString(),
      keyword: '',
      reportList: [],
      selectedReportId: '',
      selectedReportFileName: '',
      rows: [],
      totalWorkers: 0,
      salaryRecordCount: 0,
      totalIncome: '0.00',
      hasReport: false,
      reportExpanded: false,
      reportFilterText: '',
      reportGeneratedAtText: '',
    });
  },

  selectSubmittedReport(e) {
    const reportId = String(e.currentTarget.dataset.id || '');
    if (!reportId || reportId === this.data.selectedReportId) return;
    this.loadSubmittedReportDetail(reportId);
  },

  async exportReport() {
    if (!this.data.selectedReportId) {
      wx.showToast({ title: '请先选择工资表', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '导出中...', mask: true });
    try {
      const res = await app.exportXlsx({
        url: `/salary/reports/${encodeURIComponent(this.data.selectedReportId)}/export`,
        method: 'GET',
        fileName: this.data.selectedReportFileName || `salary-report-${todayString()}.xlsx`,
      });
      wx.showToast({ title: '导出成功', icon: 'success' });
      if (res?.filePath) {
        console.log('[export] submitted salary report xlsx file =', res.filePath);
      }
    } catch (err) {
      wx.showToast({ title: err.message || '导出失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
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
