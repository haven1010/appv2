// pages/applications/applications.js
const app = getApp();

const STATUS_MAP = { 0: '审核中', 1: '已录取', 2: '已拒绝', 3: '已取消' };

Page({
  data: {
    userInfo: null,
    applications: [],
    workerPending: [],
    loading: true,
    pendingLoading: true,
  },

  onLoad() {
    this.checkLogin();
  },

  onShow() {
    const tabBar = this.getTabBar && this.getTabBar();
    if (tabBar) {
      tabBar.setData({ selected: 1 });
    }
    this.loadData();
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
      this.setData({ loading: false, pendingLoading: false });
      return;
    }
    this.loadApplications();
    this.loadWorkerPending();
  },

  async loadApplications() {
    try {
      const res = await app.request({ url: '/base/applications/me', method: 'GET' });
      const list = Array.isArray(res) ? res : [];
      var applications = list.map(function(item) {
        return {
          id: item.id,
          title: (item.job && item.job.jobTitle) || '岗位',
          base: (item.base && item.base.baseName) || '基地',
          status: STATUS_MAP[item.status] || '审核中',
          date: item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '',
          raw: item,
        };
      });
      this.setData({ applications, loading: false });
    } catch (err) {
      console.error('加载报名列表失败:', err);
      this.setData({ applications: [], loading: false });
    }
  },

  async loadWorkerPending() {
    try {
      const res = await app.request({ url: '/salary/worker/pending', method: 'GET' });
      const list = Array.isArray(res) ? res : [];
      var workerPending = list.map(function(item) {
        return Object.assign({}, item, {
          totalAmountText:
            item.totalAmount != null
              ? Number(item.totalAmount).toFixed(2)
              : '0.00',
        });
      });
      this.setData({ workerPending, pendingLoading: false });
    } catch (err) {
      console.error('加载待发放失败:', err);
      this.setData({ workerPending: [], pendingLoading: false });
    }
  },

  goToDetail(e) {
    const jobId = e.currentTarget.dataset.jobId;
    const baseId = e.currentTarget.dataset.baseId;
    if (!jobId || !baseId) return;
    wx.navigateTo({
      url: `/pages/job/detail/detail?id=${jobId}&baseId=${baseId}`,
    });
  },

  async confirmSalary(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    try {
      await app.request({
        url: `/salary/worker/${id}/confirm`,
        method: 'POST',
      });
      wx.showToast({ title: '已确认', icon: 'success' });
      this.loadWorkerPending();
    } catch (err) {
      wx.showToast({ title: err.message || '确认失败', icon: 'none' });
    }
  },
});
