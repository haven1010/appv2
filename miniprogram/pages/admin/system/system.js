/**
 * Layer: Mini Program Page
 * Responsibility: Provides super-admin-only payroll center with filter, export, and history archive.
 */
const app = getApp();
const { resolveRole, isSuperAdminRole, roleLabel } = require('../../../utils/role');

const HISTORY_KEY = 'admin_payroll_report_history_v1';

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

function inferGender(idCard) {
  const id = String(idCard || '').trim();
  if (id.length !== 18) return '未知';
  const code = Number(id.charAt(16));
  if (!Number.isFinite(code)) return '未知';
  return code % 2 === 0 ? '女' : '男';
}

function toCsvCell(value) {
  const text = String(value == null ? '' : value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function formatTime(value) {
  if (!value) return '-';
  return String(value).replace('T', ' ').slice(0, 19);
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

    rows: [],
    totalWorkers: 0,
    totalIncome: 0,

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
      await this.loadPayrollReport();
      this.loadHistory();
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

  buildSalaryUrl() {
    const params = [];
    const baseId = this.data.baseOptions[this.data.baseIndex]?.value || '';
    const dateFrom = this.data.dateFrom;
    const dateTo = this.data.dateTo;
    const keyword = String(this.data.keyword || '').trim();

    if (baseId) params.push(`baseId=${encodeURIComponent(baseId)}`);
    if (dateFrom) params.push(`dateFrom=${encodeURIComponent(dateFrom)}`);
    if (dateTo) params.push(`dateTo=${encodeURIComponent(dateTo)}`);
    if (keyword) params.push(`keyword=${encodeURIComponent(keyword)}`);

    return `/salary/list?${params.join('&')}`;
  },

  async loadPayrollReport() {
    if (this.data.dateFrom && this.data.dateTo && this.data.dateFrom > this.data.dateTo) {
      wx.showToast({ title: '开始日期不能晚于结束日期', icon: 'none' });
      return;
    }

    this.setData({ reportLoading: true });
    try {
      const salaryRes = await app.request({ url: this.buildSalaryUrl(), method: 'GET' }).catch(() => ({ list: [] }));
      const list = normalizeArray(salaryRes);

      const grouped = {};
      for (let i = 0; i < list.length; i += 1) {
        const row = list[i] || {};
        const name = row.workerName || '-';
        const uid = row.workerUid || `unknown-${i}`;
        const idCard = row.workerIdCard || '';
        const key = `${uid}__${idCard || name}`;

        if (!grouped[key]) {
          grouped[key] = {
            name,
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

        grouped[key].totalIncome += Number(row.totalAmount || 0);
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
            signature: item.signature,
          };
        })
        .sort((a, b) => b.totalIncome - a.totalIncome)
        .map((item, index) => Object.assign({}, item, { serial: index + 1 }));

      const totalIncome = Number(rows.reduce((sum, item) => sum + Number(item.totalIncome || 0), 0).toFixed(2));

      this.setData({
        rows,
        totalWorkers: rows.length,
        totalIncome,
        selectedHistoryId: '',
      });
    } catch (err) {
      wx.showToast({ title: err.message || '加载工资表失败', icon: 'none' });
    } finally {
      this.setData({ reportLoading: false });
    }
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
    this.loadPayrollReport();
  },

  resetReport() {
    this.setData({
      baseIndex: 0,
      dateFrom: monthStartString(),
      dateTo: todayString(),
      keyword: '',
      selectedHistoryId: '',
    });
    this.loadPayrollReport();
  },

  exportReport() {
    const rows = this.data.rows || [];
    if (!rows.length) {
      wx.showToast({ title: '暂无可导出工资表', icon: 'none' });
      return;
    }

    const header = ['序号', '姓名', '性别', '身份证号', '家庭住址', '是否贫困户', '务工总收入', '领款人签章'];
    const body = rows.map((item) => [
      item.serial,
      item.name,
      item.gender,
      item.idCard,
      item.address,
      item.poorHousehold,
      item.totalIncome,
      item.signature,
    ].map(toCsvCell).join(','));

    const csv = [header.map(toCsvCell).join(',')].concat(body).join('\n');
    wx.setClipboardData({
      data: csv,
      success: () => {
        wx.showModal({
          title: '导出成功',
          content: `已复制 ${rows.length} 条工资记录，可直接粘贴到 Excel。`,
          showCancel: false,
        });
      },
      fail: () => wx.showToast({ title: '导出失败', icon: 'none' }),
    });
  },

  archiveReport() {
    const rows = this.data.rows || [];
    if (!rows.length) {
      wx.showToast({ title: '暂无数据可存档', icon: 'none' });
      return;
    }

    const history = wx.getStorageSync(HISTORY_KEY) || [];
    const snapshot = {
      id: `report-${Date.now()}`,
      createdAt: new Date().toISOString(),
      filter: {
        baseLabel: this.data.baseOptions[this.data.baseIndex]?.label || '全部基地',
        baseValue: this.data.baseOptions[this.data.baseIndex]?.value || '',
        dateFrom: this.data.dateFrom,
        dateTo: this.data.dateTo,
        keyword: this.data.keyword,
      },
      summary: {
        totalWorkers: this.data.totalWorkers,
        totalIncome: this.data.totalIncome,
      },
      rows,
    };

    const next = [snapshot].concat(Array.isArray(history) ? history : []).slice(0, 20);
    wx.setStorageSync(HISTORY_KEY, next);
    this.loadHistory();
    wx.showToast({ title: '已存档', icon: 'success' });
  },

  loadHistory() {
    const history = wx.getStorageSync(HISTORY_KEY) || [];
    const list = (Array.isArray(history) ? history : []).map((item) => ({
      id: item.id,
      createdAtText: formatTime(item.createdAt),
      label: `${item.filter?.baseLabel || '全部基地'} · ${item.filter?.dateFrom || '-'} ~ ${item.filter?.dateTo || '-'}`,
      totalWorkers: item.summary?.totalWorkers || 0,
      totalIncome: item.summary?.totalIncome || 0,
    }));
    this.setData({ historyList: list });
  },

  applyHistory(e) {
    const id = e.currentTarget.dataset.id;
    const history = wx.getStorageSync(HISTORY_KEY) || [];
    const item = (Array.isArray(history) ? history : []).find((x) => x.id === id);
    if (!item) return;

    const baseValue = String(item.filter?.baseValue || '');
    const baseIndex = this.data.baseOptions.findIndex((x) => String(x.value) === baseValue);

    this.setData({
      baseIndex: baseIndex >= 0 ? baseIndex : 0,
      dateFrom: item.filter?.dateFrom || monthStartString(),
      dateTo: item.filter?.dateTo || todayString(),
      keyword: item.filter?.keyword || '',
      rows: Array.isArray(item.rows) ? item.rows : [],
      totalWorkers: item.summary?.totalWorkers || 0,
      totalIncome: item.summary?.totalIncome || 0,
      selectedHistoryId: id,
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