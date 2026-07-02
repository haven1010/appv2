/**
 * Layer: Mini Program Page
 * Responsibility: Phone + SMS verification code quick registration.
 * Creates a minimal account and auto-logs in. After registration, user
 * is redirected to role selection, then guided real-name auth.
 */
const app = getApp();
const EXPECTED_PHASE1_API_BUILD = 'phase1-identity-20260621-2';

function cleanPhone(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 11);
}

function normalizeBaseUrl(value) {
  let url = String(value || '').trim();
  if (!url) return '';
  if (!/^https?:\/\//i.test(url)) {
    url = `http://${url}`;
  }
  if (!/\/api(?:\/)?$/i.test(url)) {
    url = `${url.replace(/\/+$/, '')}/api`;
  }
  return url.replace(/\/+$/, '');
}

function formatBaseUrlForDisplay(value) {
  const text = String(value || '').trim();
  if (!text) return '未设置';
  if (text.length <= 40) return text;
  return `${text.slice(0, 18)}...${text.slice(-14)}`;
}

Page({
  data: {
    // Step control
    currentStep: 0,        // 0 = phone, 1 = code
    stepClasses: ['current', 'future'],
    progressPercent: 0,

    // Inputs
    phone: '',
    code: '',

    // SMS state
    codeSent: false,
    countdown: 0,
    canResend: false,

    // UI
    loading: false,
    error: '',
    hasAgreed: false,

    // Network
    showApiConfig: false,
    apiBaseUrlInput: '',
  },

  onLoad() {
    this.refreshApiConfig();
    this.computeSteps(0);
  },

  /* ════════════════════════ Step Animation ════════════════════════ */

  computeSteps(step) {
    const classes = ['future', 'future'];
    for (let i = 0; i < 2; i++) {
      if (i === step) classes[i] = 'current';
      else if (i < step) classes[i] = 'past';
    }
    this.setData({
      currentStep: step,
      stepClasses: classes,
      progressPercent: ((step + 1) / 2) * 100,
    });
  },

  /* ════════════════════════ Step 0: Phone ════════════════════════ */

  onInputPhone(e) {
    this.setData({
      phone: cleanPhone(e.detail.value),
      error: '',
    });
  },

  async handleSendCode() {
    const phone = cleanPhone(this.data.phone);
    if (phone.length !== 11) {
      this.setData({ error: '请输入正确的11位手机号' });
      return;
    }
    if (!this.data.hasAgreed) {
      this.setData({ error: '请先阅读并同意用户协议和隐私政策' });
      return;
    }

    this.setData({ loading: true, error: '' });

    try {
      const res = await app.request({
        url: '/auth/send-code',
        method: 'POST',
        data: { phone },
      });
      if (res?.apiBuild !== EXPECTED_PHASE1_API_BUILD) {
        this.setData({
          loading: false,
          error: '云函数未更新，请先上传 phase1Api 后再注册',
        });
        return;
      }

      this.setData({ codeSent: true, loading: false });
      this.startCountdown();
      this.computeSteps(1);  // Slide to code step

      wx.showToast({
        title: '验证码已发送',
        icon: 'success',
        duration: 1500,
      });
    } catch (err) {
      // For development, if backend isn't running, fake it
      if (err && (String(err.errMsg || err.message || '')).match(/request:fail|Network|ERR_ADDRESS/)) {
        this.setData({ codeSent: true, loading: false });
        this.startCountdown();
        this.computeSteps(1);
        wx.showToast({ title: '验证码已发送', icon: 'success', duration: 1500 });
        return;
      }

      this.setData({
        error: err?.message || err?.errMsg || '发送验证码失败，请重试',
        loading: false,
      });
    }
  },

  startCountdown() {
    this.setData({ countdown: 60, canResend: false });
    const timer = setInterval(() => {
      let cd = this.data.countdown;
      if (cd <= 1) {
        clearInterval(timer);
        this.setData({ countdown: 0, canResend: true });
      } else {
        this.setData({ countdown: cd - 1 });
      }
    }, 1000);
  },

  handleResendCode() {
    if (!this.data.canResend) return;
    this.handleSendCode();
  },

  /* ════════════════════════ Step 1: Code ════════════════════════ */

  onInputCode(e) {
    this.setData({
      code: String(e.detail.value || '').replace(/\D/g, '').slice(0, 6),
      error: '',
    });
  },

  goBackToPhone() {
    this.computeSteps(0);
  },

  async handleRegister() {
    if (this.data.loading) return;

    const phone = cleanPhone(this.data.phone);
    const code = String(this.data.code || '').trim();

    if (phone.length !== 11) {
      this.setData({ error: '手机号不正确', currentStep: 0 });
      this.computeSteps(0);
      return;
    }
    if (!this.data.hasAgreed) {
      this.setData({ error: '请先阅读并同意用户协议和隐私政策' });
      return;
    }
    if (code.length !== 6) {
      this.setData({ error: '请输入6位验证码' });
      return;
    }

    this.setData({ loading: true, error: '' });

    try {
      const res = await app.request({
        url: '/auth/register-by-phone',
        method: 'POST',
        data: { phone, code },
      });
      if (res?.apiBuild !== EXPECTED_PHASE1_API_BUILD) {
        wx.removeStorageSync('token');
        wx.removeStorageSync('userInfo');
        app.globalData.token = null;
        app.globalData.userInfo = null;
        this.setData({
          loading: false,
          error: '云函数未更新，请先上传 phase1Api 后再注册',
        });
        return;
      }

      const responsePhone = cleanPhone(res?.user?.phone);
      if (responsePhone && responsePhone !== phone) {
        wx.removeStorageSync('token');
        wx.removeStorageSync('userInfo');
        app.globalData.token = null;
        app.globalData.userInfo = null;
        this.setData({
          loading: false,
          error: '账号登录异常，请重新获取验证码',
        });
        return;
      }
      if (res?.isNewUser === false || res?.user?.name) {
        wx.removeStorageSync('token');
        wx.removeStorageSync('userInfo');
        app.globalData.token = null;
        app.globalData.userInfo = null;
        this.setData({
          loading: false,
          error: '该手机号已注册，请返回登录页登录',
        });
        return;
      }

      const mergedUser = Object.assign({}, res.user || {}, {
        role: res.user?.role || 'worker',
        registerStage: res.registerStage || 'phone_only',
      });

      wx.removeStorageSync('token');
      wx.removeStorageSync('userInfo');
      wx.setStorageSync('token', res.access_token);
      wx.setStorageSync('userInfo', mergedUser);
      app.globalData.token = res.access_token;
      app.globalData.userInfo = mergedUser;

      this.setData({ loading: false });

      wx.showToast({
        title: res.isNewUser ? '注册成功' : '登录成功',
        icon: 'success',
        duration: 800,
      });

      setTimeout(() => {
        // First-time user → role selection
        if (res.isNewUser || res.registerStage === 'phone_only') {
          wx.reLaunch({ url: '/pages/register/role-select' });
        } else {
          // Existing user with info → go home
          const role = mergedUser.role || 'worker';
          const adminRoles = ['super_admin', 'region_admin', 'base_manager', 'field_manager'];
          if (adminRoles.includes(role)) {
            wx.reLaunch({ url: '/pages/admin/home/home' });
          } else if (role === 'boss') {
            wx.switchTab({ url: '/pages/base/list/list' });
          } else {
            wx.switchTab({ url: '/pages/index/index' });
          }
        }
      }, 800);
    } catch (err) {
      let message = err?.message || err?.errMsg || '注册失败，请重试';
      if (err?.statusCode === 401) message = '验证码错误或已过期';
      if (err?.statusCode === 409) message = '该手机号已注册，请返回登录页登录';
      this.setData({ error: message, loading: false });
      if (err?.statusCode === 409) {
        wx.showModal({
          title: '手机号已注册',
          content: '这个手机号已经有账号了，请返回登录页登录。',
          confirmText: '去登录',
          cancelText: '留在此页',
          success: (modalRes) => {
            if (modalRes.confirm) this.goToLogin();
          },
        });
      }
    }
  },

  /* ════════════════════════ Login link ════════════════════════ */

  goToLogin() {
    wx.reLaunch({ url: '/pages/login/login' });
  },

  toggleAgreement() {
    this.setData({
      hasAgreed: !this.data.hasAgreed,
      error: '',
    });
  },

  openUserAgreement() {
    wx.navigateTo({ url: '/pages/legal/user-agreement/user-agreement' });
  },

  openPrivacyPolicy() {
    wx.navigateTo({ url: '/pages/legal/privacy-policy/privacy-policy' });
  },

  /* ════════════════════════ Network Config ════════════════════════ */

  refreshApiConfig() {
    const current = app.globalData.baseUrl || wx.getStorageSync('apiBaseUrl') || '';
    this.setData({
      apiBaseUrlInput: current,
    });
  },

  toggleApiConfig() {
    this.setData({
      showApiConfig: !this.data.showApiConfig,
      apiBaseUrlInput: app.globalData.baseUrl || wx.getStorageSync('apiBaseUrl') || '',
    });
  },

  onInputApiBaseUrl(e) {
    this.setData({ apiBaseUrlInput: e.detail.value || '' });
  },

  saveApiBaseUrl() {
    const normalized = normalizeBaseUrl(this.data.apiBaseUrlInput);
    if (!normalized || !/^https?:\/\//i.test(normalized)) {
      wx.showToast({ title: '请输入正确的接口地址', icon: 'none' });
      return;
    }
    const saved = app.setApiBaseUrl(normalized);
    if (!saved) return;
    this.setData({ showApiConfig: false });
    wx.showToast({ title: '接口地址已更新', icon: 'none' });
  },
});
