/**
 * Layer: Mini Program Page
 * Responsibility: Implements the Index page lifecycle, local interaction state, and backend integration for the WeChat client.
 * Notes: Keep comments focused on intent, invariants, side effects, and cross-module contracts.
 */
// pages/index/index.js
const app = getApp();
const { resolveRole, isAdminRole } = require('../../utils/role');

function formatSalary(job) {
  if (!job) return '面议';
  const t = job.payType;
  if (t === 1) return job.salaryAmount != null ? `¥${job.salaryAmount}/天` : '面议';
  if (t === 2) return job.hourlyRate != null ? `¥${job.hourlyRate}/小时` : '面议';
  if (t === 3) return job.unitPrice != null ? `¥${job.unitPrice}/件` : '面议';
  return '面议';
}

function formatCategoryName(category) {
  if (category === 1) return '水果';
  if (category === 2) return '蔬菜';
  return '其他';
}

function normalizeApplications(res) {
  const list = Array.isArray(res) ? res : [];
  return list.map((item) =>
    Object.assign({}, item, {
      baseId: Number(item.baseId),
      jobId: Number(item.jobId),
    })
  );
}

Page({
  data: {
    pageReady: false,
    topShadeOpacity: 0,
    statsLifted: false,
    drawerPulse: false,
    userInfo: null,
    recommendedBases: [],
    workerStats: null,
    baseJobs: [],
    selectedBaseId: null,
    loading: true,
    jobsLoading: false,
    applyLoading: false,
    applications: [],
  },

  onLoad() {
    if (this.redirectAdminIfNeeded()) return;
    this.checkLogin();
    this.loadData();
    setTimeout(() => {
      this.setData({ pageReady: true });
    }, 30);
  },

  onShow() {
    if (this.redirectAdminIfNeeded()) return;
    const tabBar = this.getTabBar && this.getTabBar();
    if (tabBar) tabBar.setData({ selected: 0 });
    this.checkLogin();
    if (this.data.userInfo) {
      this.loadData();
    }
  },

  onUnload() {
    if (this.statsTimer) {
      clearTimeout(this.statsTimer);
      this.statsTimer = null;
    }
    if (this.drawerPulseTimer) {
      clearTimeout(this.drawerPulseTimer);
      this.drawerPulseTimer = null;
    }
  },

  onPageScroll(e) {
    const topShadeOpacity = Math.min(1, (e.scrollTop || 0) / 120);
    if (Math.abs(topShadeOpacity - this.data.topShadeOpacity) < 0.05) return;
    this.setData({ topShadeOpacity });
  },

  onPullDownRefresh() {
    this.loadData().finally(() => wx.stopPullDownRefresh());
  },

  noop() {},

  handleBlankTap() {
    if (this.data.selectedBaseId) {
      this.closeJobDrawer();
    }
  },

  triggerStatsLift() {
    this.setData({ statsLifted: true });
    if (this.statsTimer) clearTimeout(this.statsTimer);
    this.statsTimer = setTimeout(() => {
      this.setData({ statsLifted: false });
    }, 260);
  },

  copyUid() {
    const uid = this.data.userInfo && this.data.userInfo.uid;
    if (!uid) return;
    wx.setClipboardData({
      data: String(uid),
      success: () => wx.showToast({ title: '编号已复制', icon: 'none' }),
    });
  },

  copyName() {
    const name = this.data.userInfo && this.data.userInfo.name;
    if (!name) return;
    wx.setClipboardData({
      data: String(name),
      success: () => wx.showToast({ title: '姓名已复制', icon: 'none' }),
    });
  },

  checkLogin() {
    const userInfo = wx.getStorageSync('userInfo');
    if (userInfo) {
      this.setData({ userInfo });
    }
  },

  redirectAdminIfNeeded() {
    const userInfo = wx.getStorageSync('userInfo');
    const role = resolveRole(userInfo);
    if (isAdminRole(role)) {
      wx.reLaunch({ url: '/pages/admin/home/home' });
      return true;
    }
    return false;
  },

  hasAppliedForJob(jobId, baseId) {
    const targetJobId = Number(jobId);
    const targetBaseId = Number(baseId);
    return this.data.applications.some(
      (item) =>
        Number(item.jobId) === targetJobId &&
        Number(item.baseId) === targetBaseId &&
        (item.status === 0 || item.status === 1)
    );
  },

  async loadData() {
    const token = wx.getStorageSync('token');
    if (!token) {
      this.setData({
        loading: false,
        recommendedBases: [],
        workerStats: null,
        applications: [],
      });
      return;
    }

    this.setData({ loading: true });

    const [baseRes, statsRes, appRes] = await Promise.all([
      app.request({ url: '/recommendation/bases', method: 'GET' }).catch(() => []),
      app.request({ url: '/salary/worker/stats', method: 'GET' }).catch(() => null),
      app.request({ url: '/base/applications/me', method: 'GET' }).catch(() => []),
    ]);

    const applications = normalizeApplications(appRes);
    const recommendedBases = (Array.isArray(baseRes) ? baseRes : []).map((item, index) =>
      Object.assign({}, item, {
        categoryName: item.categoryName || formatCategoryName(item.category),
        entryDelay: Math.min(index * 90, 600) + 'ms',
      })
    );

    this.setData({
      recommendedBases,
      workerStats: statsRes || { workDays: 0, pendingAmount: 0 },
      applications,
      loading: false,
    });
  },

  async showBaseJobs(e) {
    const baseId = Number(e.currentTarget.dataset.id);
    if (!baseId) return;

    const apps = this.data.applications;
    this.setData({
      selectedBaseId: baseId,
      jobsLoading: true,
      baseJobs: [],
      drawerPulse: true,
    });
    if (this.drawerPulseTimer) clearTimeout(this.drawerPulseTimer);
    this.drawerPulseTimer = setTimeout(() => {
      this.setData({ drawerPulse: false });
    }, 420);

    try {
      const res = await app.request({
        url: `/base/${baseId}/jobs`,
        method: 'GET',
      });

      const jobs = (Array.isArray(res) ? res : []).map((job) => {
        const jobId = Number(job.id);
        const matchApp = apps.find(
          (item) => Number(item.jobId) === jobId && Number(item.baseId) === baseId
        );
        const applied = Boolean(matchApp) && (matchApp.status === 0 || matchApp.status === 1);
        const appliedText = applied
          ? matchApp.status === 1
            ? '已录用'
            : '已申请'
          : '立即报名';
        return Object.assign({}, job, {
          salaryText: formatSalary(job),
          applied,
          appliedText,
        });
      });

      this.setData({
        baseJobs: jobs,
        jobsLoading: false,
      });
    } catch (err) {
      this.setData({
        baseJobs: [],
        jobsLoading: false,
      });
      wx.showToast({ title: '岗位加载失败', icon: 'none' });
    }
  },

  closeJobDrawer() {
    this.setData({
      selectedBaseId: null,
      baseJobs: [],
      jobsLoading: false,
    });
  },

  async handleApply(e) {
    const jobId = Number(e.currentTarget.dataset.jobId);
    const baseId = Number(e.currentTarget.dataset.baseId);
    if (!jobId || !baseId) return;

    if (this.hasAppliedForJob(jobId, baseId)) {
      wx.showToast({ title: '已申请，请勿重复操作', icon: 'none' });
      return;
    }

    this.setData({ applyLoading: true });
    try {
      await app.request({
        url: `/base/jobs/${jobId}/apply`,
        method: 'POST',
        data: { baseId },
      });
      wx.showToast({ title: '报名成功', icon: 'none' });
      await this.loadData();
      this.closeJobDrawer();
    } catch (err) {
      wx.showToast({ title: err.message || '报名失败', icon: 'none' });
    } finally {
      this.setData({ applyLoading: false });
    }
  },

  goToQrcode() {
    wx.switchTab({ url: '/pages/qrcode/qrcode' });
  },

  goToLogin() {
    wx.navigateTo({ url: '/pages/login/login' });
  },

  goToRegister() {
    wx.navigateTo({ url: '/pages/register/register' });
  },
});
