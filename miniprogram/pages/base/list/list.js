// pages/base/list/list.js
const app = getApp();

Page({
  data: {
    bases: [],
    loading: true,
    category: 0, // 0=全部, 1=水果, 2=蔬菜, 3=其他
    regionCode: '',
  },

  onLoad(options) {
    if (options.category) {
      this.setData({ category: parseInt(options.category) });
    }
    this.loadBases();
  },

  onPullDownRefresh() {
    this.loadBases();
    setTimeout(() => {
      wx.stopPullDownRefresh();
    }, 1000);
  },

  async loadBases() {
    this.setData({ loading: true });

    try {
      const params = {};
      if (this.data.category > 0) {
        params.category = this.data.category;
      }
      if (this.data.regionCode) {
        params.regionCode = this.data.regionCode;
      }

      const queryString = Object.keys(params).map(key => `${key}=${params[key]}`).join('&');
      const url = queryString ? `/base?${queryString}` : '/base';

      const res = await app.request({
        url: url,
        method: 'GET',
      });

      this.setData({
        bases: res || [],
        loading: false,
      });
    } catch (err) {
      console.error('加载基地列表失败:', err);
      wx.showToast({
        title: '加载失败',
        icon: 'none',
      });
      this.setData({ loading: false });
    }
  },

  goToDetail(e) {
    const baseId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/base/detail/detail?id=${baseId}`
    });
  },

  filterByCategory(e) {
    const category = e.currentTarget.dataset.category;
    this.setData({ category });
    this.loadBases();
  },
});
