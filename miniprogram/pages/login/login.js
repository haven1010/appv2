/**
 * Layer: Mini Program Page
 * Responsibility: Handles warm-style role-based login interactions and authentication flow.
 */
const app = getApp();

const WORKER_HOME_URL = '/pages/index/index';
const BOSS_DASHBOARD_URL = '/pages/boss/dashboard/dashboard';
const BOSS_FALLBACK_URL = '/pages/admin/home/home';
const LOGIN_FADE_MS = 260;
const ADMIN_ROLES = ['super_admin', 'region_admin', 'base_manager', 'field_manager'];

function cleanPhone(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 11);
}

function cleanIdCardLast6(value) {
  const normalized = String(value || '').trim().toUpperCase().replace(/\s+/g, '');
  if (normalized.length <= 6) return normalized;
  return normalized.slice(-6);
}

function normalizeLoginRole(role) {
  return role === 'boss' ? 'boss' : 'worker';
}

function normalizeBackendRole(user) {
  return (user && (user.role || user.roleKey)) || 'worker';
}

function isAdminRole(role) {
  return ADMIN_ROLES.includes(role);
}

function extractRawError(err) {
  const messageFromResponse = Array.isArray(err?.response?.message)
    ? err.response.message.join(' / ')
    : err?.response?.message || err?.response?.msg || '';

  return [err?.message, err?.errMsg, messageFromResponse]
    .filter(Boolean)
    .map((item) => String(item))
    .join(' / ');
}

function toErrorMessage(err) {
  if (!err) return '登录失败，请稍后重试';
  const raw = extractRawError(err);

  if (err.statusCode === 401 || /Unauthorized/i.test(raw)) {
    return '登录失败：手机号未注册，或身份证后6位不匹配。';
  }

  if (/ERR_ADDRESS_UNREACHABLE|request:fail|Network request failed/i.test(raw)) {
    const urlMatch = raw.match(/\((https?:\/\/[^)]+)\)/i);
    const target = urlMatch ? urlMatch[1] : '当前后端地址';
    return `无法连接后端：${target}。请确认接口地址和网络连通。`;
  }

  return raw || '登录失败，请稍后重试';
}

function isPageDeclared(url) {
  try {
    const normalizedPath = String(url || '').replace(/^\//, '');
    const pages = typeof __wxConfig !== 'undefined' && __wxConfig ? __wxConfig.pages : [];
    return Array.isArray(pages) && pages.includes(normalizedPath);
  } catch (_) {
    return false;
  }
}

Page({
  data: {
    phone: '',
    idCardLast6: '',
    loading: false,
    error: '',
    focusField: '',
    loginRole: 'worker',
    canSubmit: false,
    btnPressed: false,
    pageLeaving: false,
    statusBarHeight: 20,
    navBarHeight: 44,
  },

  onLoad(options) {
    const statusBarHeight = this.getStatusBarHeight();
    const navBarHeight = this.getNavBarHeight(statusBarHeight);
    const loginRole = normalizeLoginRole(options?.role);

    this.setData({
      statusBarHeight,
      navBarHeight,
      loginRole,
    });

    this.updateCanSubmit(this.data.phone, this.data.idCardLast6);
  },

  getStatusBarHeight() {
    try {
      const info = wx.getSystemInfoSync();
      return info?.statusBarHeight || 20;
    } catch (_) {
      return 20;
    }
  },

  getNavBarHeight(statusBarHeight) {
    try {
      const menuButton = wx.getMenuButtonBoundingClientRect();
      if (!menuButton || !menuButton.height) return 44;

      const topGap = menuButton.top - statusBarHeight;
      return menuButton.height + topGap * 2;
    } catch (_) {
      return 44;
    }
  },

  onSwitchRole(e) {
    const role = normalizeLoginRole(e.currentTarget.dataset.role);
    if (role === this.data.loginRole) return;

    this.vibrateShort('light');
    this.setData({
      loginRole: role,
      error: '',
    });
  },

  onInputFocus(e) {
    const field = e.currentTarget.dataset.field || '';
    this.setData({ focusField: field });
  },

  onInputBlur() {
    if (!this.data.focusField) return;
    this.setData({ focusField: '' });
  },

  onInputPhone(e) {
    const phone = cleanPhone(e.detail.value);
    this.setData({ phone, error: '' });
    this.updateCanSubmit(phone, this.data.idCardLast6);
  },

  onInputIdCard(e) {
    const idCardLast6 = cleanIdCardLast6(e.detail.value);
    this.setData({ idCardLast6, error: '' });
    this.updateCanSubmit(this.data.phone, idCardLast6);
  },

  updateCanSubmit(phoneInput, idCardInput) {
    const phone = cleanPhone(phoneInput);
    const idCardLast6 = cleanIdCardLast6(idCardInput);
    const canSubmit = phone.length === 11 && idCardLast6.length === 6;

    if (canSubmit !== this.data.canSubmit) {
      this.setData({ canSubmit });
    }
  },

  onLoginPressStart() {
    if (this.data.loading || !this.data.canSubmit) return;
    this.setData({ btnPressed: true });
  },

  onLoginPressEnd() {
    if (!this.data.btnPressed) return;
    this.setData({ btnPressed: false });
  },

  vibrateShort(type = 'light') {
    try {
      wx.vibrateShort({ type });
    } catch (_) {
      // Some clients may not support vibration types.
      try {
        wx.vibrateShort();
      } catch (__) {
        // Ignore vibration failure.
      }
    }
  },

  async handleLogin() {
    if (this.data.loading) return;

    this.onLoginPressEnd();

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

    this.vibrateShort('light');

    this.setData({
      phone,
      idCardLast6,
      loading: true,
      error: '',
      pageLeaving: false,
    });

    try {
      const res = await app.request({
        url: '/auth/login',
        method: 'POST',
        data: {
          phone,
          idCardLast6,
        },
      });

      const selectedRole = normalizeLoginRole(this.data.loginRole);
      const backendRole = normalizeBackendRole(res.user || {});

      if (selectedRole === 'boss' && backendRole !== 'boss') {
        this.setData({
          loading: false,
          pageLeaving: false,
          error: '该账号不是老板账号，请使用老板账号登录或切换为员工入口。',
        });
        return;
      }

      if (selectedRole === 'worker' && backendRole === 'boss') {
        this.setData({
          loading: false,
          pageLeaving: false,
          error: '老板账号请切换到"我是老板"入口登录。',
        });
        return;
      }

      const mergedUser = Object.assign({}, res.user || {}, {
        role: backendRole,
        selectedLoginRole: selectedRole,
      });

      wx.setStorageSync('token', res.access_token);
      wx.setStorageSync('userInfo', mergedUser);

      app.globalData.token = res.access_token;
      app.globalData.userInfo = mergedUser;

      this.setData({
        loading: false,
        pageLeaving: true,
      });

      wx.showToast({
        title: '登录成功',
        icon: 'success',
        duration: 700,
      });

      setTimeout(() => {
        this.navigateByRole(backendRole);
      }, LOGIN_FADE_MS);
    } catch (err) {
      this.setData({
        error: toErrorMessage(err),
        loading: false,
        pageLeaving: false,
      });
    }
  },

  navigateByRole(role) {
    if (isAdminRole(role)) {
      wx.reLaunch({ url: BOSS_FALLBACK_URL });
      return;
    }

    if (role === 'boss') {
      this.navigateToBossDashboard();
      return;
    }

    wx.switchTab({
      url: WORKER_HOME_URL,
      fail: () => {
        wx.reLaunch({ url: WORKER_HOME_URL });
      },
    });
  },

  navigateToBossDashboard() {
    if (isPageDeclared(BOSS_DASHBOARD_URL)) {
      wx.switchTab({
        url: BOSS_DASHBOARD_URL,
        fail: () => {
          wx.reLaunch({ url: BOSS_FALLBACK_URL });
        },
      });
      return;
    }

    wx.reLaunch({ url: BOSS_FALLBACK_URL });
  },

  goToRegister() {
    const role = normalizeLoginRole(this.data.loginRole);
    wx.navigateTo({
      url: `/pages/register/register?role=${role}`,
    });
  },
});

