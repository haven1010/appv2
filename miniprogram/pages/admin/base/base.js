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
    baseIndex: 0,
    selectedBaseId: '',
    selectedBase: null,

    yearAppliedBases: [],
    yearSettledBases: [],

    workerFlows: [],
    cooperationFlows: [],
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
        createdAt: item.createdAt,
        createdYear: item.createdAt ? new Date(item.createdAt).getFullYear() : currentYear,
      }));

      const yearAppliedBases = baseList.filter((item) => item.createdYear === currentYear && item.auditStatus !== 1);
      const yearSettledBases = baseList.filter((item) => item.createdYear === currentYear && item.auditStatus === 1);

      let baseIndex = this.data.baseIndex || 0;
      if (baseIndex >= baseList.length) baseIndex = 0;
      const selected = baseList[baseIndex] || null;

      this.setData({
        baseList,
        baseIndex,
        selectedBaseId: selected ? selected.id : '',
        yearAppliedBases,
        yearSettledBases,
      });

      if (selected) {
        await this.loadBaseDetail(selected.id);
      } else {
        this.setData({ selectedBase: null, workerFlows: [], cooperationFlows: [] });
      }
    } catch (err) {
      wx.showToast({ title: err.message || '加载基地数据失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  async loadBaseDetail(baseId) {
    const [baseRes, appsRes, coopRes] = await Promise.all([
      app.request({ url: `/base/${baseId}`, method: 'GET' }).catch(() => null),
      app.request({ url: `/base/${baseId}/applications`, method: 'GET' }).catch(() => []),
      app.request({ url: `/base/${baseId}/cooperations`, method: 'GET' }).catch(() => []),
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

    this.setData({
      selectedBase: baseRes,
      workerFlows,
      cooperationFlows,
    });
  },

  onBaseChange(e) {
    const baseIndex = Number(e.detail.value);
    const selected = this.data.baseList[baseIndex];
    if (!selected) return;

    this.setData({
      baseIndex,
      selectedBaseId: selected.id,
    });
    this.loadBaseDetail(selected.id);
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
