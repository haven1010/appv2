// pages/index/index.js
const app = getApp();

function formatSalary(job) {
  if (!job) return '面议';
  const t = job.payType;
  if (t === 1) return job.salaryAmount != null ? `¥${job.salaryAmount}/天` : '面议';
  if (t === 2) return job.hourlyRate != null ? `¥${job.hourlyRate}/小时` : '面议';
  if (t === 3) return job.unitPrice != null ? `¥${job.unitPrice}/件` : '面议';
  return '面议';
}

Page({
  data: {
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
    this.checkLogin();
    this.loadData();
  },

  onShow() {
    this.checkLogin();
  },

  onPullDownRefresh() {
    this.loadData();
    setTimeout(() => wx.stopPullDownRefresh(), 1500);
  },

  checkLogin() {
    const userInfo = wx.getStorageSync('userInfo');
    if (userInfo) this.setData({ userInfo });
  },

  async loadData() {
    const token = wx.getStorageSync('token');
    if (!token) {
      this.setData({ loading: false });
      return;
    }
    this.loadRecommendedBases();
    this.loadWorkerStats();
    this.loadApplications();
  },

  async loadRecommendedBases() {
    try {
      const res = await app.request({ url: '/recommendation/bases', method: 'GET' });
      this.setData({
        recommendedBases: Array.isArray(res) ? res : [],
        loading: false,
      });
    } catch (err) {
      console.error('加载推荐基地失败:', err);
      this.setData({ recommendedBases: [], loading: false });
    }
  },

  async loadWorkerStats() {
    try {
      const res = await app.request({ url: '/salary/worker/stats', method: 'GET' });
      this.setData({ workerStats: res });
    } catch (err) {
      console.error('加载统计失败:', err);
    }
  },

  async loadApplications() {
    try {
      const res = await app.request({ url: '/base/applications/me', method: 'GET' });
      const list = Array.isArray(res) ? res : [];
      this.setData({ applications: list });
    } catch (err) {
      this.setData({ applications: [] });
    }
  },

  hasAppliedForJob(jobId, baseId) {
    const apps = this.data.applications;
    return apps.some(a => (a.jobId === jobId || a.jobId === jobId) && (a.baseId === baseId || a.baseId === baseId) && (a.status === 0 || a.status === 1));
  },

  async showBaseJobs(e) {
    const baseId = e.currentTarget.dataset.id;
    const apps = this.data.applications;
    this.setData({ selectedBaseId: baseId, jobsLoading: true, baseJobs: [] });
    try {
      const res = await app.request({
        url: `/base/${baseId}/jobs`,
        method: 'GET',
      });
      const jobs = Array.isArray(res) ? res.map(j => {
        const applied = apps.some(a => (a.jobId === j.id || a.jobId == j.id) && (a.baseId === parseInt(baseId) || a.baseId == baseId) && (a.status === 0 || a.status === 1));
        return { ...j, salaryText: formatSalary(j), applied, appliedText: applied ? (apps.find(a => (a.jobId === j.id || a.jobId == j.id) && a.baseId == baseId)?.status === 1 ? '已录取' : '已申请') : '立即报名' };
      }) : [];
      this.setData({ baseJobs: jobs, jobsLoading: false });
    } catch (err) {
      console.error('加载岗位失败:', err);
      this.setData({ baseJobs: [], jobsLoading: false });
    }
  },

  closeJobDrawer() {
    this.setData({ selectedBaseId: null, baseJobs: [] });
  },

  async handleApply(e) {
    const jobId = e.currentTarget.dataset.jobId;
    const baseId = e.currentTarget.dataset.baseId;
    if (!jobId || !baseId) return;
    if (this.hasAppliedForJob(jobId, baseId)) {
      wx.showToast({ title: '已申请', icon: 'none' });
      return;
    }
    this.setData({ applyLoading: true });
    try {
      await app.request({
        url: `/base/jobs/${jobId}/apply`,
        method: 'POST',
        data: { baseId: parseInt(baseId) },
      });
      wx.showToast({ title: '报名成功', icon: 'success' });
      this.loadApplications();
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

  goToBaseDetail(e) {
    const baseId = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/base/detail/detail?id=${baseId}` });
  },
});
