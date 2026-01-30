// pages/profile/profile.js
const app = getApp();

Page({
  data: {
    userInfo: null,
    loading: true,
  },

  onLoad() {
    this.loadUserInfo();
  },

  onShow() {
    this.loadUserInfo();
  },

  async loadUserInfo() {
    const token = wx.getStorageSync('token');
    if (!token) {
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

    this.setData({ loading: true });

    try {
      const res = await app.request({
        url: '/user/profile',
        method: 'GET',
      });

      this.setData({
        userInfo: res,
        loading: false,
      });

      // 更新本地存储
      wx.setStorageSync('userInfo', res);
      app.globalData.userInfo = res;

    } catch (err) {
      console.error('加载用户信息失败:', err);
      this.setData({ loading: false });
      
      if (err.message.includes('登录已过期')) {
        wx.removeStorageSync('token');
        wx.removeStorageSync('userInfo');
        wx.switchTab({
          url: '/pages/index/index'
        });
      }
    }
  },

  goToLogin() {
    wx.navigateTo({
      url: '/pages/login/login'
    });
  },

  logout() {
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('token');
          wx.removeStorageSync('userInfo');
          app.globalData.token = null;
          app.globalData.userInfo = null;
          
          wx.switchTab({
            url: '/pages/index/index'
          });
        }
      }
    });
  },
});
