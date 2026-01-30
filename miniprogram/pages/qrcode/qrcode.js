// pages/qrcode/qrcode.js
const app = getApp();

Page({
  data: {
    qrCodeUrl: '',
    qrContent: '',
    loading: false,
    userInfo: null,
  },

  onLoad() {
    this.checkLogin();
  },

  onShow() {
    this.loadQrCode();
  },

  checkLogin() {
    const userInfo = wx.getStorageSync('userInfo');
    if (!userInfo) {
      wx.showModal({
        title: '提示',
        content: '请先登录',
        showCancel: false,
        success: () => {
          wx.switchTab({
            url: '/pages/index/index'
          });
        }
      });
      return;
    }
    this.setData({ userInfo });
  },

  async loadQrCode() {
    const token = wx.getStorageSync('token');
    if (!token) {
      return;
    }

    this.setData({ loading: true });

    try {
      const res = await app.request({
        url: '/attendance/qrcode',
        method: 'GET',
      });

      this.setData({
        qrContent: res.content,
        qrCodeUrl: '', // 可以在这里生成二维码图片
        loading: false,
      });

      // 使用第三方库生成二维码图片（需要引入）
      // 或者使用服务端生成二维码图片URL
      
    } catch (err) {
      console.error('加载二维码失败:', err);
      wx.showToast({
        title: '加载失败',
        icon: 'none',
      });
      this.setData({ loading: false });
    }
  },

  refreshQrCode() {
    this.loadQrCode();
  },

  saveQrCode() {
    // 保存二维码到相册
    wx.showToast({
      title: '功能开发中',
      icon: 'none',
    });
  },
});
