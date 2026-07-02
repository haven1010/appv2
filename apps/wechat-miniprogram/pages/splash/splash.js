Page({
  data: {
    entered: false,
  },

  enterApp() {
    if (this.data.entered) return;
    this.setData({ entered: true });
    wx.switchTab({
      url: '/pages/index/index',
      fail: () => {
        this.setData({ entered: false });
      },
    });
  },
});
