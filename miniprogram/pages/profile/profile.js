// pages/profile/profile.js
const app = getApp();

function maskPhone(phone) {
  if (!phone || phone.length < 7) return phone || '';
  return phone.slice(0, 3) + '****' + phone.slice(-4);
}

Page({
  data: {
    userInfo: null,
    profileData: null,
    workerStats: null,
    workRecords: [],
    loading: true,
    workRecordsLoading: false,
  },

  onLoad() {
    this.checkLogin();
  },

  onShow() {
    const tabBar = this.getTabBar && this.getTabBar();
    if (tabBar) {
      tabBar.setData({ selected: 3 });
    }
    this.loadProfile();
  },

  onPullDownRefresh() {
    this.loadProfile();
    setTimeout(() => wx.stopPullDownRefresh(), 1500);
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

  async loadProfile() {
    const token = wx.getStorageSync('token');
    if (!token) {
      this.setData({ loading: false });
      return;
    }
    this.setData({ loading: true });
    try {
      var results = await Promise.all([
        app.request({ url: '/user/profile', method: 'GET' }),
        app.request({ url: '/salary/worker/stats', method: 'GET' }),
      ]);
      var profile = results[0];
      var stats = results[1];
      const p = profile || {};
      this.setData({
        profileData: Object.assign({}, p, {
          phoneMasked: maskPhone(p.phone),
          emergencyPhoneMasked: maskPhone(p.emergencyPhone),
        }),
        workerStats: stats || { workDays: 0, pendingAmount: 0 },
        loading: false,
      });
    } catch (err) {
      console.error('加载资料失败:', err);
      this.setData({ loading: false });
    }
  },

  async loadWorkRecords() {
    this.setData({ workRecordsLoading: true });
    try {
      const res = await app.request({ url: '/attendance/worker/records', method: 'GET' });
      const list = Array.isArray(res) ? res : [];
      this.setData({ workRecords: list, workRecordsLoading: false });
    } catch (err) {
      this.setData({ workRecords: [], workRecordsLoading: false });
    }
  },

  goBasicInfo() {
    wx.navigateTo({ url: '/pages/profile/userInfo/userInfo' });
  },

  goSalaryCard() {
    wx.navigateTo({ url: '/pages/profile/salaryCard/salaryCard' });
  },

  showWorkHistory() {
    this.loadWorkRecords();
    wx.navigateTo({
      url: '/pages/profile/workHistory/workHistory',
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
          wx.switchTab({ url: '/pages/index/index' });
        }
      },
    });
  },
});
