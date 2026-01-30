// pages/index/index.js
const app = getApp();

Page({
  data: {
    userInfo: null,
    recommendedBases: [],
    loading: true,
  },

  onLoad() {
    this.checkLogin();
    this.loadRecommendedBases();
  },

  onPullDownRefresh() {
    this.loadRecommendedBases();
    setTimeout(() => {
      wx.stopPullDownRefresh();
    }, 1000);
  },

  checkLogin() {
    const userInfo = wx.getStorageSync('userInfo');
    if (userInfo) {
      this.setData({ userInfo });
    }
  },

  async loadRecommendedBases() {
    const token = wx.getStorageSync('token');
    if (!token) {
      this.setData({ loading: false });
      return;
    }

    try {
      const userId = wx.getStorageSync('userInfo').id;
      const res = await app.request({
        url: `/recommendation/bases`,
        method: 'GET',
      });
      this.setData({
        recommendedBases: res || [],
        loading: false,
      });
    } catch (err) {
      console.error('加载推荐基地失败:', err);
      this.setData({ loading: false });
    }
  },

  goToLogin() {
    wx.navigateTo({
      url: '/pages/login/login'
    });
  },

  goToRegister() {
    wx.navigateTo({
      url: '/pages/register/register'
    });
  },

  goToBaseDetail(e) {
    const baseId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/base/detail/detail?id=${baseId}`
    });
  },
});
