// pages/base/detail/detail.js
const app = getApp();

Page({
  data: {
    baseId: null,
    baseInfo: null,
    jobs: [],
    loading: true,
  },

  onLoad(options) {
    if (options.id) {
      this.setData({ baseId: parseInt(options.id) });
      this.loadBaseDetail();
      this.loadJobs();
    }
  },

  async loadBaseDetail() {
    try {
      const res = await app.request({
        url: `/base/${this.data.baseId}`,
        method: 'GET',
      });

      this.setData({ baseInfo: res });
    } catch (err) {
      console.error('加载基地详情失败:', err);
      wx.showToast({
        title: '加载失败',
        icon: 'none',
      });
    }
  },

  async loadJobs() {
    try {
      const res = await app.request({
        url: `/base/${this.data.baseId}/jobs`,
        method: 'GET',
      });

      this.setData({
        jobs: res || [],
        loading: false,
      });
    } catch (err) {
      console.error('加载岗位列表失败:', err);
      this.setData({ loading: false });
    }
  },

  goToJobDetail(e) {
    const jobId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/job/detail/detail?id=${jobId}&baseId=${this.data.baseId}`
    });
  },

  applyJob(e) {
    const jobId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/job/detail/detail?id=${jobId}&baseId=${this.data.baseId}`
    });
  },
});
