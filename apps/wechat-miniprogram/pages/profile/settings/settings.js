/**
 * Layer: Mini Program Page
 * Responsibility: Implements the Settings page lifecycle and local preference management for the WeChat client.
 * Notes: Keep comments focused on intent, invariants, side effects, and cross-module contracts.
 */
// pages/profile/settings/settings.js
const STORAGE_KEY = 'worker_settings';
const { requireAuth } = require('../../../utils/auth-guard');

Page({
  data: {
    notifyJob: true,
    notifySalary: true,
    privacyMask: true,
    lowDataMode: false,
    cacheSize: '\u8ba1\u7b97\u4e2d...',
  },

  onLoad() {
    if (!requireAuth()) return;
    this.loadSettings();
    this.calcCacheSize();
  },

  loadSettings() {
    const saved = wx.getStorageSync(STORAGE_KEY);
    if (!saved || typeof saved !== 'object') return;
    this.setData({
      notifyJob: saved.notifyJob !== false,
      notifySalary: saved.notifySalary !== false,
      privacyMask: saved.privacyMask !== false,
      lowDataMode: saved.lowDataMode === true,
    });
  },

  saveSettings() {
    const payload = {
      notifyJob: this.data.notifyJob,
      notifySalary: this.data.notifySalary,
      privacyMask: this.data.privacyMask,
      lowDataMode: this.data.lowDataMode,
    };
    wx.setStorageSync(STORAGE_KEY, payload);
  },

  onSwitchJob(e) {
    this.setData({ notifyJob: !!e.detail.value });
    this.saveSettings();
  },

  onSwitchSalary(e) {
    this.setData({ notifySalary: !!e.detail.value });
    this.saveSettings();
  },

  onSwitchPrivacy(e) {
    this.setData({ privacyMask: !!e.detail.value });
    this.saveSettings();
  },

  onSwitchLowData(e) {
    this.setData({ lowDataMode: !!e.detail.value });
    this.saveSettings();
  },

  calcCacheSize() {
    try {
      const info = wx.getStorageInfoSync();
      const kb = Number(info.currentSize || 0);
      const text = kb >= 1024 ? (kb / 1024).toFixed(2) + ' MB' : kb + ' KB';
      this.setData({ cacheSize: text });
    } catch (err) {
      this.setData({ cacheSize: '\u672a\u77e5' });
    }
  },

  clearCache() {
    wx.showModal({
      title: '\u6e05\u7406\u7f13\u5b58',
      content: '\u5c06\u6e05\u7406\u672c\u5730\u4e34\u65f6\u7f13\u5b58\uff0c\u662f\u5426\u7ee7\u7eed\uff1f',
      success: (res) => {
        if (!res.confirm) return;
        const token = wx.getStorageSync('token');
        const userInfo = wx.getStorageSync('userInfo');
        wx.clearStorageSync();
        if (token) wx.setStorageSync('token', token);
        if (userInfo) wx.setStorageSync('userInfo', userInfo);
        this.saveSettings();
        this.calcCacheSize();
        wx.showToast({ title: '\u7f13\u5b58\u5df2\u6e05\u7406', icon: 'none' });
      },
    });
  },

  contactSupport() {
    wx.showModal({
      title: '\u6280\u672f\u652f\u6301',
      content: '\u5982\u9700\u5e2e\u52a9\uff0c\u8bf7\u8054\u7cfb\u7ba1\u7406\u5458\u6216\u63d0\u4ea4\u95ee\u9898\u53cd\u9988\u3002',
      showCancel: false,
    });
  },

  logout() {
    wx.showModal({
      title: '退出账号',
      content: '确定要退出当前账号吗？',
      confirmText: '退出',
      confirmColor: '#ff3b30',
      success: (res) => {
        if (!res.confirm) return;
        const settings = wx.getStorageSync(STORAGE_KEY);
        wx.clearStorageSync();
        if (settings) wx.setStorageSync(STORAGE_KEY, settings);
        const app = getApp();
        if (app && app.globalData) {
          app.globalData.userInfo = null;
        }
        wx.reLaunch({ url: '/pages/login/login' });
      },
    });
  },
});
