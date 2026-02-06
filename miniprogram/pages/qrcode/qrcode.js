// pages/qrcode/qrcode.js
const app = getApp();

Page({
  data: {
    qrContent: '',
    qrImageUrl: '',
    validDuration: '',
    loading: true,
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
        success: () => wx.switchTab({ url: '/pages/index/index' }),
      });
      return;
    }
    this.setData({ userInfo });
  },

  async loadQrCode() {
    const token = wx.getStorageSync('token');
    if (!token) {
      this.setData({ loading: false });
      return;
    }

    this.setData({ loading: true });

    try {
      const res = await app.request({ url: '/attendance/qrcode', method: 'GET' });
      const content = res.content || '';
      const validDuration = res.validDuration || '24h';
      const qrImageUrl = content
        ? 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=' + encodeURIComponent(content)
        : '';

      this.setData({
        qrContent: content,
        qrImageUrl,
        validDuration,
        loading: false,
      });
    } catch (err) {
      console.error('加载二维码失败:', err);
      wx.showToast({ title: '加载失败', icon: 'none' });
      this.setData({ loading: false });
    }
  },

  refreshQrCode() {
    this.loadQrCode();
  },
});
