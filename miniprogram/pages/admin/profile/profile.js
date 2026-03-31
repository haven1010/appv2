/**
 * Layer: Mini Program Page
 * Responsibility: Admin profile page for personal info and logout.
 */
const app = getApp();
const { resolveRole, isAdminRole, roleLabel } = require('../../../utils/role');

function maskPhone(phone) {
  const p = String(phone || '');
  if (p.length < 7) return p || '-';
  return `${p.slice(0, 3)}****${p.slice(-4)}`;
}

Page({
  data: {
    loading: true,
    role: 'worker',
    roleText: '',
    userInfo: null,
    profile: null,
    activeNav: 'me',
  },

  onLoad() {
    if (!this.ensureAdmin()) return;
    this.loadProfile();
  },

  onShow() {
    if (!this.ensureAdmin()) return;
    this.loadProfile();
  },

  onPullDownRefresh() {
    this.loadProfile().finally(() => wx.stopPullDownRefresh());
  },

  ensureAdmin() {
    const token = wx.getStorageSync('token');
    const userInfo = app.getCurrentUser();
    const role = resolveRole(userInfo);

    if (!token || !userInfo) {
      wx.reLaunch({ url: '/pages/login/login' });
      return false;
    }
    if (!isAdminRole(role)) {
      wx.showModal({
        title: '无权限',
        content: '该页面仅管理员可访问。',
        showCancel: false,
        success: () => wx.switchTab({ url: '/pages/index/index' }),
      });
      return false;
    }

    this.setData({
      role,
      roleText: roleLabel(role),
      userInfo,
    });

    return true;
  },

  async loadProfile() {
    this.setData({ loading: true });
    try {
      const profile = await app.request({ url: '/user/profile', method: 'GET' });
      this.setData({
        profile: {
          uid: profile?.uid || '-',
          name: profile?.name || '-',
          role: roleLabel(profile?.roleKey || profile?.role || this.data.role),
          phoneMasked: maskPhone(profile?.phone),
          emergencyContact: profile?.emergencyContact || '-',
          emergencyPhone: maskPhone(profile?.emergencyPhone),
          assignedBaseId: profile?.assignedBaseId || '-',
        },
      });
    } catch (err) {
      wx.showToast({ title: err.message || '加载个人信息失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  logout() {
    wx.showModal({
      title: '退出登录',
      content: '确定退出当前账号吗？',
      success: (res) => {
        if (!res.confirm) return;
        wx.removeStorageSync('token');
        wx.removeStorageSync('userInfo');
        app.globalData.token = null;
        app.globalData.userInfo = null;
        wx.reLaunch({ url: '/pages/login/login' });
      },
    });
  },

  switchAdminNav(e) {
    const target = e.currentTarget.dataset.target;
    const map = {
      home: '/pages/admin/home/home',
      base: '/pages/admin/base/base',
      scan: '/pages/admin/attendance/attendance',
      audit: '/pages/admin/users/users',
      payroll: '/pages/admin/system/system',
      me: '/pages/admin/profile/profile',
    };
    const url = map[target];
    if (!url || target === this.data.activeNav) return;
    wx.redirectTo({ url });
  },
});