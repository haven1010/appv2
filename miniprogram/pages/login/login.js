/**
 * Layer: Mini Program Page
 * Responsibility: Implements the Login page lifecycle, local interaction state, and backend integration for the WeChat client.
 * Notes: Keep comments focused on intent, invariants, side effects, and cross-module contracts.
 */
// pages/login/login.js
const app = getApp();
const { resolveRole, isAdminRole } = require('../../utils/role');

function cleanPhone(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 11);
}

function cleanIdCardLast6(value) {
  return String(value || '').trim().toUpperCase().slice(0, 6);
}

function toErrorMessage(err) {
  if (!err) return '登录失败，请稍后重试';
  if (Array.isArray(err.message)) return err.message.join('；');
  return err.message || err.errMsg || '登录失败，请稍后重试';
}

Page({
  data: {
    phone: '',
    idCardLast6: '',
    loading: false,
    error: '',
  },

  onInputPhone(e) {
    this.setData({ phone: cleanPhone(e.detail.value), error: '' });
  },

  onInputIdCard(e) {
    this.setData({ idCardLast6: cleanIdCardLast6(e.detail.value), error: '' });
  },

  async handleLogin() {
    const phone = cleanPhone(this.data.phone);
    const idCardLast6 = cleanIdCardLast6(this.data.idCardLast6);

    if (!phone || !idCardLast6) {
      this.setData({ error: '请填写手机号和身份证后6位' });
      return;
    }

    if (phone.length !== 11) {
      this.setData({ error: '请输入正确的11位手机号' });
      return;
    }

    if (idCardLast6.length !== 6) {
      this.setData({ error: '身份证后6位必须是6位字符' });
      return;
    }

    this.setData({ phone, idCardLast6, loading: true, error: '' });

    try {
      const res = await app.request({
        url: '/auth/login',
        method: 'POST',
        data: {
          phone,
          idCardLast6,
        },
      });

      wx.setStorageSync('token', res.access_token);
      wx.setStorageSync('userInfo', res.user);

      app.globalData.token = res.access_token;
      app.globalData.userInfo = res.user;

      this.setData({ loading: false });
      wx.showToast({
        title: '登录成功',
        icon: 'success',
      });

      const role = resolveRole(res.user);
      setTimeout(() => {
        if (isAdminRole(role)) {
          wx.reLaunch({
            url: '/pages/admin/home/home',
          });
        } else {
          wx.switchTab({
            url: '/pages/index/index',
          });
        }
      }, 1500);
    } catch (err) {
      this.setData({
        error: toErrorMessage(err),
        loading: false,
      });
    }
  },

  goToRegister() {
    wx.navigateTo({
      url: '/pages/register/register',
    });
  },
});
