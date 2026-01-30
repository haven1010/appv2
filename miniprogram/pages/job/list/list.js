// pages/job/list/list.js
const app = getApp();

Page({
  data: {
    jobs: [],
    loading: true,
  },

  onLoad() {
    this.loadJobs();
  },

  onPullDownRefresh() {
    this.loadJobs();
    setTimeout(() => {
      wx.stopPullDownRefresh();
    }, 1000);
  },

  async loadJobs() {
    this.setData({ loading: true });

    try {
      // 这里可以调用获取所有岗位的接口，或者从基地详情页传入
      // 暂时显示空列表
      this.setData({
        jobs: [],
        loading: false,
      });
    } catch (err) {
      console.error('加载岗位列表失败:', err);
      this.setData({ loading: false });
    }
  },

  goToDetail(e) {
    const jobId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/job/detail/detail?id=${jobId}`
    });
  },
});
