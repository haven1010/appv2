/**
 * Layer: Mini Program Page
 * Responsibility: Provides base-management views for base managers and super admins.
 */
const app = getApp();
const { resolveRole, isSuperAdminRole, roleLabel } = require('../../../utils/role');

function formatDateTime(value) {
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

function normalizeArray(res) {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.list)) return res.list;
  return [];
}

function applicationText(status) {
  if (status === 1) return '已录用';
  if (status === 2) return '已拒绝';
  if (status === 3) return '已取消';
  return '待处理';
}

function chipType(status) {
  if (status === 1) return 'success';
  if (status === 2) return 'danger';
  if (status === 0) return 'pending';
  return 'info';
}

function cooperationText(status) {
  if (status === 1) return '已通过';
  if (status === 2) return '已拒绝';
  return '待审核';
}

function baseAuditText(status) {
  if (status === 1) return '已入驻';
  if (status === 2) return '已驳回';
  return '申请中';
}

function salaryText(status) {
  if (status === 2) return '已发放';
  if (status === 1) return '已确认';
  if (status === 0) return '待确认';
  return '未知';
}

function salaryChip(status) {
  if (status === 2) return 'success';
  if (status === 1) return 'info';
  if (status === 0) return 'pending';
  return 'danger';
}

Page({
  data: {
    loading: true,
    role: 'worker',
    roleText: '',
    userInfo: null,
    canSuperAdmin: false,
    activeNav: 'base',

    currentYear: new Date().getFullYear(),
    baseList: [],
    selectedBaseId: '',
    selectedBase: null,
    detailLoading: false,

    yearAppliedBases: [],
    yearSettledBases: [],

    workerFlows: [],
    cooperationFlows: [],
    salaryRows: [],
    salarySummary: {
      totalRecords: 0,
      totalWorkers: 0,
      paidCount: 0,
      pendingCount: 0,
      totalAmount: '0.00',
    },

    cardBaseInfoExpanded: true,
    cardWorkersExpanded: false,
    cardSalaryExpanded: false,
  },

  onLoad() {
    if (!this.ensureRole()) return;
    this.loadData();
  },

  onShow() {
    if (!this.ensureRole()) return;
    this.loadData();
  },

  onPullDownRefresh() {
    this.loadData().finally(() => wx.stopPullDownRefresh());
  },

  ensureRole() {
    const token = wx.getStorageSync('token');
    const userInfo = app.getCurrentUser();
    const role = resolveRole(userInfo);

    if (!token || !userInfo) {
      wx.reLaunch({ url: '/pages/login/login' });
      return false;
    }

    if (!['base_manager', 'super_admin', 'region_admin'].includes(role)) {
      wx.showModal({
        title: '无权限',
        content: '基地管理页面仅基地管理员和超级管理员可访问。',
        showCancel: false,
        success: () => wx.navigateBack({ delta: 1 }),
      });
      return false;
    }

    this.setData({
      role,
      roleText: roleLabel(role),
      userInfo,
      canSuperAdmin: isSuperAdminRole(role),
    });

    return true;
  },

  buildBaseListUrl() {
    if (this.data.canSuperAdmin) return '/base?showAll=true';
    return `/base?ownerId=${this.data.userInfo.id}`;
  },

  async loadData() {
    this.setData({ loading: true });
    try {
      const listRes = await app.request({
        url: this.buildBaseListUrl(),
        method: 'GET',
      }).catch(() => []);

      const currentYear = this.data.currentYear;
      const baseList = normalizeArray(listRes).map((item) => ({
        id: String(item.id),
        baseName: item.baseName || item.name || `基地#${item.id}`,
        auditStatus: Number(item.auditStatus),
        auditText: baseAuditText(Number(item.auditStatus)),
        auditChipType: chipType(Number(item.auditStatus)),
        createdAt: item.createdAt,
        createdAtText: formatDateTime(item.createdAt),
        createdYear: item.createdAt ? new Date(item.createdAt).getFullYear() : currentYear,
      }));

      const yearAppliedBases = baseList.filter((item) => item.createdYear === currentYear && item.auditStatus !== 1);
      const yearSettledBases = baseList.filter((item) => item.createdYear === currentYear && item.auditStatus === 1);

      const previousSelectedId = String(this.data.selectedBaseId || '');
      const selected = previousSelectedId
        ? (baseList.find((item) => item.id === previousSelectedId) || null)
        : null;

      this.setData({
        baseList,
        selectedBaseId: selected ? selected.id : '',
        yearAppliedBases,
        yearSettledBases,
      });

      if (selected) {
        this.setData({ detailLoading: true });
        try {
          await this.loadBaseDetail(selected.id);
        } finally {
          this.setData({ detailLoading: false });
        }
      } else {
        this.setData({
          selectedBase: null,
          detailLoading: false,
          workerFlows: [],
          cooperationFlows: [],
          salaryRows: [],
          salarySummary: {
            totalRecords: 0,
            totalWorkers: 0,
            paidCount: 0,
            pendingCount: 0,
            totalAmount: '0.00',
          },
        });
      }
    } catch (err) {
      wx.showToast({ title: err.message || '加载基地数据失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  async loadBaseDetail(baseId) {
    const [baseRes, appsRes, coopRes, salaryRes] = await Promise.all([
      app.request({ url: `/base/${baseId}`, method: 'GET' }).catch(() => null),
      app.request({ url: `/base/${baseId}/applications`, method: 'GET' }).catch(() => []),
      app.request({ url: `/base/${baseId}/cooperations`, method: 'GET' }).catch(() => []),
      app.request({ url: `/salary/list?baseId=${encodeURIComponent(baseId)}&page=1&pageSize=200`, method: 'GET' }).catch(() => ({ list: [] })),
    ]);

    const workerFlows = normalizeArray(appsRes).map((item, idx) => {
      const user = item.user || {};
      const job = item.job || {};
      const status = Number(item.status);
      return {
        key: `worker-${item.id || idx}`,
        name: user.name || item.workerName || '未知人员',
        uid: user.uid || '-',
        statusText: applicationText(status),
        statusChipType: chipType(status),
        jobTitle: job.jobTitle || item.jobTitle || '-',
        trace: `申请ID: ${item.id || '-'} · 手机: ${user.phone || '-'} · 身份证: ${user.idCard || '-'}`,
        updatedAtText: formatDateTime(item.updatedAt || item.createdAt),
      };
    });

    const cooperationFlows = normalizeArray(coopRes).map((item, idx) => {
      const status = Number(item.status);
      return {
        key: `coop-${item.id || idx}`,
        requirement: item.requirement || '-',
        applicantName: item.applicant?.name || `用户#${item.applicantId || '-'}`,
        statusText: cooperationText(status),
        statusChipType: chipType(status),
        rejectReason: item.rejectReason || '',
        updatedAtText: formatDateTime(item.updatedAt || item.createdAt),
      };
    });

    const salaryList = normalizeArray(salaryRes);
    const workerKeySet = {};
    let totalAmount = 0;
    let paidCount = 0;
    let pendingCount = 0;

    const salaryRows = salaryList.map((item, idx) => {
      const status = Number(item.status);
      const workerUid = item.workerUid || '';
      const workerName = item.workerName || '-';
      const amount = Number(item.totalAmount || item.amount || 0);

      const uniqKey = String(workerUid || workerName || `worker-${idx}`);
      workerKeySet[uniqKey] = true;

      totalAmount += Number.isFinite(amount) ? amount : 0;
      if (status === 2) paidCount += 1;
      else pendingCount += 1;

      return {
        key: `salary-${item.id || idx}`,
        workerName,
        workerUid: workerUid || '-',
        amountText: Number.isFinite(amount) ? amount.toFixed(2) : '0.00',
        statusText: salaryText(status),
        statusChipType: salaryChip(status),
        workDateText: formatDateTime(item.workDate || item.updatedAt || item.createdAt),
        trace: `工资记录ID: ${item.id || '-'} · 报名ID: ${item.signupId || '-'} · 基地ID: ${item.baseId || '-'}`,
      };
    });

    const salarySummary = {
      totalRecords: salaryRows.length,
      totalWorkers: Object.keys(workerKeySet).length,
      paidCount,
      pendingCount,
      totalAmount: totalAmount.toFixed(2),
    };

    this.setData({
      selectedBase: baseRes,
      workerFlows,
      cooperationFlows,
      salaryRows,
      salarySummary,
      cardBaseInfoExpanded: true,
      cardWorkersExpanded: false,
      cardSalaryExpanded: false,
    });
  },

  async onBaseCardTap(e) {
    const id = String(e.currentTarget.dataset.id || '');
    if (!id) return;
    if (id === String(this.data.selectedBaseId || '') && this.data.selectedBase) return;
    const pickedBase = (this.data.baseList || []).find((item) => String(item.id) === id) || null;

    this.setData({
      selectedBaseId: id,
      selectedBase: pickedBase,
      detailLoading: true,
      cardBaseInfoExpanded: true,
      cardWorkersExpanded: false,
      cardSalaryExpanded: false,
    });

    try {
      await this.loadBaseDetail(id);
    } finally {
      this.setData({ detailLoading: false });
    }
  },

  toggleDetailCard(e) {
    const key = String(e.currentTarget.dataset.key || '');
    const keyMap = {
      baseInfo: 'cardBaseInfoExpanded',
      workers: 'cardWorkersExpanded',
      salary: 'cardSalaryExpanded',
    };
    const targetField = keyMap[key];
    if (!targetField) return;

    const next = {
      cardBaseInfoExpanded: false,
      cardWorkersExpanded: false,
      cardSalaryExpanded: false,
    };
    next[targetField] = !this.data[targetField];
    this.setData(next);
  },

  async deleteBase(e) {
    if (!this.data.canSuperAdmin) {
      wx.showToast({ title: '仅超级管理员可删除基地', icon: 'none' });
      return;
    }

    const id = Number(e.currentTarget.dataset.id || this.data.selectedBaseId);
    if (!id) return;

    const modalRes = await new Promise((resolve) => {
      wx.showModal({
        title: '删除基地',
        content: '删除后该基地将不可见，且关联招聘岗位将下线，是否继续？',
        success: resolve,
      });
    });
    if (!modalRes.confirm) return;

    try {
      await app.request({
        url: `/base/${id}`,
        method: 'DELETE',
      });
      wx.showToast({ title: '基地删除成功', icon: 'success' });
      this.loadData();
    } catch (err) {
      wx.showToast({ title: err.message || '基地删除失败', icon: 'none' });
    }
  },

  goScanCenter() {
    wx.navigateTo({ url: '/pages/admin/attendance/attendance' });
  },

  goHomeCenter() {
    wx.navigateTo({ url: '/pages/admin/home/home' });
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
