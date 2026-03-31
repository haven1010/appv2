/**
 * Layer: Mini Program Page
 * Responsibility: Implements the Profile page lifecycle, local interaction state, and backend integration for the WeChat client.
 * Notes: Keep comments focused on intent, invariants, side effects, and cross-module contracts.
 */
// pages/field/profile/profile.js
const app = getApp();
const { resolveRole, isAdminRole, roleLabel } = require('../../../utils/role');

function maskPhone(phone) {
  if (!phone || phone.length < 7) return phone || '';
  return phone.slice(0, 3) + '****' + phone.slice(-4);
}

Page({
  data: {
    userInfo: null,
    profileData: null,
    baseName: '',
    roleText: '现场管理员',
    canOpenAdmin: true,
    loading: true,
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
        success: () => {
          wx.reLaunch({ url: '/pages/login/login' });
        },
      });
      return;
    }
    const role = resolveRole(userInfo);
    this.setData({
      userInfo,
      roleText: roleLabel(role),
      canOpenAdmin: isAdminRole(role),
    });
  },

  async loadProfile() {
    const token = wx.getStorageSync('token');
    if (!token) {
      this.setData({ loading: false });
      return;
    }
    this.setData({ loading: true });

    try {
      const profile = await app.request({ url: '/user/profile', method: 'GET' });
      const p = profile || {};
      const cachedUser = this.data.userInfo || wx.getStorageSync('userInfo');
      const assignedBaseId = p.assignedBaseId || (cachedUser && cachedUser.assignedBaseId);

      this.setData({
        profileData: Object.assign({}, p, {
          assignedBaseId: assignedBaseId,
          phoneMasked: maskPhone(p.phone),
        }),
        loading: false,
      });

      // 加载基地名称
      if (assignedBaseId) {
        this.loadBaseName(assignedBaseId);
      }
    } catch (err) {
      console.error('加载资料失败:', err);
      this.setData({ loading: false });
    }
  },

  async loadBaseName(baseId) {
    try {
      const base = await app.request({ url: '/base/' + baseId, method: 'GET' });
      if (base && (base.baseName || base.name)) {
        this.setData({ baseName: base.baseName || base.name });
      }
    } catch (e) {
      // 忽略
    }
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
          wx.reLaunch({ url: '/pages/login/login' });
        }
      },
    });
  },

  goScan() {
    wx.switchTab({ url: '/pages/field/scan/scan' });
  },

  goRecords() {
    wx.switchTab({ url: '/pages/field/records/records' });
  },

  goSettings() {
    wx.navigateTo({ url: '/pages/profile/settings/settings' });
  },

  goAdminCenter() {
    if (!this.data.canOpenAdmin) {
      wx.showToast({ title: '当前账号无管理权限', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: '/pages/admin/home/home' });
  },
});
