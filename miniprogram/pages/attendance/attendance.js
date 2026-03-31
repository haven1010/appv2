/**
 * Layer: Mini Program Page
 * Responsibility: Implements the Attendance page lifecycle, local interaction state, and backend integration for the WeChat client.
 * Notes: Keep comments focused on intent, invariants, side effects, and cross-module contracts.
 */
// pages/attendance/attendance.js
Page({
  data: {
    pageReady: false,
  },

  onLoad() {
    setTimeout(() => {
      this.setData({ pageReady: true });
    }, 30);
  },

  goToQrcode() {
    wx.navigateTo({ url: '/pages/qrcode/qrcode' });
  },

  goToWorkHistory() {
    wx.navigateTo({ url: '/pages/profile/workHistory/workHistory' });
  },

  goToSalary() {
    wx.navigateTo({ url: '/pages/salary/salary' });
  },
});
