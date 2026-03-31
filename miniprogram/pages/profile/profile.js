/**
 * Layer: Mini Program Page
 * Responsibility: Implements the Profile page lifecycle, local interaction state, and backend integration for the WeChat client.
 * Notes: Keep comments focused on intent, invariants, side effects, and cross-module contracts.
 */
// pages/profile/profile.js
const app = getApp();
const { resolveRole, isAdminRole, roleLabel } = require('../../utils/role');

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
    role: 'worker',
    roleText: '采摘工',
    canOpenAdmin: false,
    loading: true,
    workRecordsLoading: false,
  },

  onLoad() {
    if (this.redirectAdminIfNeeded()) return;
    this.checkLogin();
  },

  onShow() {
    if (this.redirectAdminIfNeeded()) return;
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
    const role = resolveRole(userInfo);
    this.setData({
      userInfo,
      role,
      roleText: roleLabel(role),
      canOpenAdmin: isAdminRole(role),
    });
  },

  redirectAdminIfNeeded() {
    const userInfo = wx.getStorageSync('userInfo');
    const role = resolveRole(userInfo);
    if (isAdminRole(role)) {
      wx.reLaunch({ url: '/pages/admin/home/home' });
      return true;
    }
    return false;
  },

  async loadProfile() {
    const token = wx.getStorageSync('token');
    if (!token) {
      this.setData({ loading: false });
      return;
    }

    this.setData({ loading: true });

    try {
      const results = await Promise.all([
        app.request({ url: '/user/profile', method: 'GET' }),
        app.request({ url: '/salary/worker/stats', method: 'GET' }),
      ]);

      const profile = results[0] || {};
      const stats = results[1] || { workDays: 0, pendingAmount: 0 };

      this.setData({
        profileData: Object.assign({}, profile, {
          phoneMasked: maskPhone(profile.phone),
          emergencyPhoneMasked: maskPhone(profile.emergencyPhone),
        }),
        workerStats: stats,
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
    wx.navigateTo({ url: '/pages/profile/workHistory/workHistory' });
  },

  goSettings() {
    wx.navigateTo({ url: '/pages/profile/settings/settings' });
  },

  goAdminCenter() {
    const role = this.data.role || resolveRole(this.data.userInfo);
    if (!isAdminRole(role)) {
      wx.showToast({ title: '当前账号无管理权限', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: '/pages/admin/home/home' });
  },

  logout() {
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (!res.confirm) return;
        wx.removeStorageSync('token');
        wx.removeStorageSync('userInfo');
        app.globalData.token = null;
        app.globalData.userInfo = null;
        wx.switchTab({ url: '/pages/index/index' });
      },
    });
  },
});
