const app = getApp();
const { requireAuth } = require('../../../utils/auth-guard');
const { resolveRole, isSuperAdminRole, roleLabel } = require('../../../utils/role');

function normalizeArray(res) {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.list)) return res.list;
  return [];
}

function formatDateTime(value) {
  if (!value) return '-';
  const raw = String(value).trim();
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw.replace('T', ' ').slice(0, 16);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d} ${hh}:${mm}`;
}

function statusText(status) {
  const num = Number(status);
  if (num === 1) return '已通过';
  if (num === 2) return '已驳回';
  if (num === 3) return '已取消';
  return '待审核';
}

function statusClass(status) {
  const num = Number(status);
  if (num === 1) return 'ok';
  if (num === 2) return 'warn';
  if (num === 3) return 'muted';
  return 'pending';
}

Page({
  data: {
    loading: true,
    role: 'worker',
    roleText: '',
    activeNav: 'base',
    canSuperAdmin: false,
    currentBase: null,
    baseOptions: [],
    baseIndex: 0,
    selectedBaseId: '',
    summary: {
      pending: 0,
      approved: 0,
      notified: 0,
      payroll: 0,
    },
    applicants: [],
    filteredApplicants: [],
    notices: [],
    noticeForm: {
      date: '',
      time: '',
      location: '',
      contactName: '',
      contactPhone: '',
      remark: '',
    },
    noticeSubmitting: false,
    showNoticeForm: false,
    activeFilter: 'pending',
    filters: [
      { key: 'pending', label: '待审核' },
      { key: 'approved', label: '已通过' },
      { key: 'all', label: '全部' },
    ],
  },

  onLoad() {
    if (!requireAuth()) return;
    if (!this.ensureRole()) return;
    this.initPage();
  },

  onShow() {
    if (!this.ensureRole()) return;
    this.initPage();
  },

  onPullDownRefresh() {
    this.initPage().finally(() => wx.stopPullDownRefresh());
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
        content: '当前页面仅基地管理员和超级管理员可访问。',
        showCancel: false,
        success: () => wx.navigateBack({ delta: 1 }),
      });
      return false;
    }

    this.setData({
      role,
      roleText: roleLabel(role),
      canSuperAdmin: isSuperAdminRole(role),
    });
    return true;
  },

  async initPage() {
    this.setData({ loading: true });
    try {
      await this.loadBaseOptions();
      if (this.data.selectedBaseId) {
        await this.loadWorkbench(this.data.selectedBaseId);
      }
    } finally {
      this.setData({ loading: false });
    }
  },

  async loadBaseOptions() {
    const role = this.data.role;
    const userInfo = app.getCurrentUser() || {};
    const url = isSuperAdminRole(role) ? '/base?showAll=true' : `/base?ownerId=${userInfo.id}`;
    const listRes = await app.request({ url, method: 'GET' }).catch(() => []);
    const baseOptions = normalizeArray(listRes).map((item) => ({
      id: String(item.id),
      baseName: item.baseName || item.name || `基地#${item.id}`,
    }));

    const selected = baseOptions[0] || null;
    this.setData({
      baseOptions,
      selectedBaseId: selected ? selected.id : '',
      baseIndex: 0,
    });
  },

  filterApplicants(applicants, activeFilter) {
    const list = Array.isArray(applicants) ? applicants : [];
    if (activeFilter === 'all') return list;
    if (activeFilter === 'approved') return list.filter((item) => item.status === 1);
    return list.filter((item) => item.status === 0);
  },

  async loadWorkbench(baseId) {
    const [baseRes, appsRes, salaryRes, noticesRes] = await Promise.all([
      app.request({ url: `/base/${baseId}`, method: 'GET' }).catch(() => null),
      app.request({ url: `/base/${baseId}/applications`, method: 'GET' }).catch(() => []),
      app.request({ url: `/salary/list?baseId=${encodeURIComponent(baseId)}&page=1&pageSize=200`, method: 'GET' }).catch(() => ({ list: [] })),
      app.request({ url: `/base/${baseId}/notices`, method: 'GET' }).catch(() => []),
    ]);

    const applicants = normalizeArray(appsRes).map((item) => {
      const user = item.user || {};
      return {
        id: Number(item.id || 0),
        userId: Number(item.userId || user.id || 0),
        name: user.name || item.workerName || '未命名工人',
        phone: user.phone || '-',
        idCard: user.idCard || '-',
        jobTitle: item.jobTitle || item.job?.jobTitle || '-',
        status: Number(item.status || 0),
        statusText: statusText(item.status),
        statusClass: statusClass(item.status),
        createdAtText: formatDateTime(item.createdAt),
        trace: `报名ID ${item.id || '-'} · UID ${user.uid || '-'}`,
      };
    });

    const salaryRows = normalizeArray(salaryRes);
    const notices = normalizeArray(noticesRes);
    const pending = applicants.filter((item) => item.status === 0).length;
    const approved = applicants.filter((item) => item.status === 1).length;

    this.setData({
      currentBase: baseRes,
      applicants,
      filteredApplicants: this.filterApplicants(applicants, this.data.activeFilter),
      notices,
      noticeForm: notices.length ? {
        date: notices[0].date || '',
        time: notices[0].time || '',
        location: notices[0].location || '',
        contactName: notices[0].contactName || '',
        contactPhone: notices[0].contactPhone || '',
        remark: notices[0].remark || '',
      } : this.data.noticeForm,
      summary: {
        pending,
        approved,
        notified: notices.length ? approved : 0,
        payroll: salaryRows.length,
      },
    });
  },

  onBaseChange(e) {
    const baseIndex = Number(e.detail.value || 0);
    const selected = this.data.baseOptions[baseIndex];
    if (!selected) return;
    this.setData({
      baseIndex,
      selectedBaseId: selected.id,
    });
    this.loadWorkbench(selected.id);
  },

  onFilterTap(e) {
    const key = e.currentTarget.dataset.key || 'pending';
    this.setData({
      activeFilter: key,
      filteredApplicants: this.filterApplicants(this.data.applicants, key),
    });
  },

  async approveApplicant(e) {
    const id = Number(e.currentTarget.dataset.id || 0);
    if (!id) return;
    wx.showLoading({ title: '处理中...', mask: true });
    try {
      await app.request({
        url: `/base/applications/${id}/review`,
        method: 'PATCH',
        data: { status: 1 },
      });
      wx.showToast({ title: '已通过', icon: 'success' });
      await this.loadWorkbench(this.data.selectedBaseId);
    } catch (err) {
      wx.showToast({ title: err.message || '审核失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  async rejectApplicant(e) {
    const id = Number(e.currentTarget.dataset.id || 0);
    if (!id) return;
    wx.showLoading({ title: '处理中...', mask: true });
    try {
      await app.request({
        url: `/base/applications/${id}/review`,
        method: 'PATCH',
        data: { status: 2, rejectReason: '当前批次名额有限，请等待下一轮安排' },
      });
      wx.showToast({ title: '已驳回', icon: 'success' });
      await this.loadWorkbench(this.data.selectedBaseId);
    } catch (err) {
      wx.showToast({ title: err.message || '驳回失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  onNoticeFieldInput(e) {
    const field = e.currentTarget.dataset.field;
    if (!field) return;
    this.setData({
      noticeForm: Object.assign({}, this.data.noticeForm, {
        [field]: e.detail.value || '',
      }),
    });
  },

  onNoticeDateChange(e) {
    this.setData({
      noticeForm: Object.assign({}, this.data.noticeForm, {
        date: e.detail.value,
      }),
    });
  },

  onNoticeTimeChange(e) {
    this.setData({
      noticeForm: Object.assign({}, this.data.noticeForm, {
        time: e.detail.value,
      }),
    });
  },

  async submitNotice() {
    if (this.data.noticeSubmitting) return;
    const baseId = Number(this.data.selectedBaseId || 0);
    if (!baseId) {
      wx.showToast({ title: '请先选择基地', icon: 'none' });
      return;
    }

    this.setData({ noticeSubmitting: true });
    wx.showLoading({ title: '保存中...', mask: true });
    try {
      await app.request({
        url: `/base/${baseId}/notices`,
        method: 'POST',
        data: this.data.noticeForm,
      });
      wx.showToast({ title: '集合通知已保存', icon: 'success' });
      await this.loadWorkbench(this.data.selectedBaseId);
    } catch (err) {
      wx.showToast({ title: err.message || '保存失败', icon: 'none' });
    } finally {
      wx.hideLoading();
      this.setData({ noticeSubmitting: false });
    }
  },

  goToAttendance() {
    wx.navigateTo({ url: '/pages/admin/attendance/attendance' });
  },

  goToPayroll() {
    wx.navigateTo({ url: '/pages/admin/system/system' });
  },

  toggleNoticeForm() {
    this.setData({ showNoticeForm: !this.data.showNoticeForm });
  },

  goBack() {
    wx.redirectTo({ url: '/pages/admin/home/home' });
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
