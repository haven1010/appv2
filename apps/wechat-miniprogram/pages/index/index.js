/**
 * Layer: Mini Program Page
 * Responsibility: Senior-friendly home page with 3 core actions.
 */
const app = getApp();
const { requireAuth, needsRealNameAuth } = require('../../utils/auth-guard');
const { resolveRole, isAdminRole, roleLabel } = require('../../utils/role');

const DEFAULT_AVATAR = '/images/zhihui-logo.webp';
const HOME_ACTION_BACKGROUNDS = [
  '/images/home-action-bg-1.png',
  '/images/home-action-bg-2.png',
  '/images/home-action-bg-3.png',
  '/images/home-action-bg-4.png',
];

let storageReadFailed = false;

function trimText(value) {
  return String(value || '').trim();
}

function safeGetStorageSync(key, fallback = '') {
  try {
    const value = wx.getStorageSync(key);
    return value === undefined ? fallback : value;
  } catch (_) {
    storageReadFailed = true;
    return fallback;
  }
}

function safeSetStorageSync(key, value) {
  try {
    wx.setStorageSync(key, value);
    return true;
  } catch (_) {
    return false;
  }
}

function safeRemoveStorageSync(key) {
  try {
    wx.removeStorageSync(key);
    return true;
  } catch (_) {
    return false;
  }
}

function isTemporaryImageUrl(value) {
  const text = trimText(value);
  if (!text) return false;
  return (
    /^https?:\/\/127\.0\.0\.1:\d+\/__tmp__\//i.test(text)
    || /^wxfile:\/\//i.test(text)
    || /^[a-zA-Z]:\\/.test(text)
    || /^file:\/\//i.test(text)
  );
}

function pickAvatar(userInfo) {
  if (!userInfo) return DEFAULT_AVATAR;
  const candidates = [
    userInfo.faceImgUrl,
    userInfo.avatarUrl,
    userInfo.headImgUrl,
    userInfo.photoUrl,
  ];
  for (let i = 0; i < candidates.length; i += 1) {
    const url = trimText(candidates[i]);
    if (url && !isTemporaryImageUrl(url)) return url;
  }
  return DEFAULT_AVATAR;
}

function sanitizeAvatarInCache() {
  const cached = safeGetStorageSync('userInfo', {}) || {};
  if (!cached || typeof cached !== 'object') return;
  const next = Object.assign({}, cached);
  let changed = false;
  ['faceImgUrl', 'avatarUrl', 'headImgUrl', 'photoUrl'].forEach((key) => {
    if (isTemporaryImageUrl(next[key])) {
      next[key] = '';
      changed = true;
    }
  });
  if (!changed) return;
  safeSetStorageSync('userInfo', next);
  app.globalData.userInfo = next;
}

function hasLoginSession() {
  storageReadFailed = false;
  const token = safeGetStorageSync('token', '');
  const userInfo = safeGetStorageSync('userInfo', null);
  return Boolean(token && userInfo);
}

function isSelfVerifiedProfile(profile = {}) {
  return Boolean(
    trimText(profile.name)
    && /^\d{17}[\dX]$/i.test(trimText(profile.idCard))
    && /^1\d{10}$/.test(String(profile.phone || '').replace(/\D/g, ''))
    && trimText(profile.homeAddress).length >= 5
    && Number(profile.infoAuditStatus || 0) !== 2
  );
}

function getUserIdentity(userInfo = {}) {
  return {
    id: trimText(userInfo.id),
    uid: trimText(userInfo.uid),
    phone: String(userInfo.phone || '').replace(/\D/g, ''),
  };
}

function isSameUser(left = {}, right = {}) {
  const a = getUserIdentity(left);
  const b = getUserIdentity(right);
  if (a.phone && a.phone !== b.phone) return false;
  if (a.id && b.id && a.id !== b.id) return false;
  if (a.uid && b.uid && a.uid !== b.uid) return false;
  return true;
}

function getDisplayName(userInfo = {}) {
  const name = trimText(userInfo.name);
  if (name) return name;
  const phone = String(userInfo.phone || '').replace(/\D/g, '');
  if (phone.length === 11) return `用户${phone.slice(-4)}`;
  return '用户';
}

function syncUserInfoCache(profile = {}) {
  const cached = safeGetStorageSync('userInfo', {}) || {};
  const base = isSameUser(cached, profile) ? cached : {};
  const merged = Object.assign({}, base, profile);
  const avatar = pickAvatar(profile);
  if (avatar && avatar !== DEFAULT_AVATAR) {
    merged.avatarUrl = avatar;
    merged.faceImgUrl = avatar;
  }
  if (isSelfVerifiedProfile(merged)) {
    merged.infoAuditStatus = 1;
  }
  safeSetStorageSync('userInfo', merged);
  app.globalData.userInfo = merged;
  return merged;
}

function clearInvalidSession() {
  safeRemoveStorageSync('token');
  safeRemoveStorageSync('userInfo');
  app.globalData.token = null;
  app.globalData.userInfo = null;
}

function getHomeTimeCopy() {
  const now = new Date();
  const hour = now.getHours();
  let greeting = '上午好';
  if (hour >= 5 && hour < 9) {
    greeting = '早上好';
  } else if (hour >= 11 && hour < 13) {
    greeting = '中午好';
  } else if (hour >= 13 && hour < 18) {
    greeting = '下午好';
  } else if (hour >= 18 && hour < 23) {
    greeting = '晚上好';
  } else if (hour >= 23 || hour < 5) {
    greeting = '夜深了';
  }

  const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  const dateText = `${now.getMonth() + 1}月${now.getDate()}日，${weekdays[now.getDay()]}`;
  return { greeting, dateText };
}

Page({
  data: {
    showSplash: true,
    user: {
      name: '',
      avatar: DEFAULT_AVATAR,
      initial: '?',
      roleText: '采摘工',
    },
    checkedIn: false,
    salaryHint: '查看收入与工资',
    signupHint: '查看报名进度',
    showVerifyBanner: false,
    greetingLabel: '',
    greetingName: '',
    greetingText: '',
    dateText: '',
    actionCardBg: HOME_ACTION_BACKGROUNDS[0],
  },

  onLoad() {
    this.pickActionCardBackground();
    this.startSplashTimer();
    setTimeout(() => this.syncTabBarSplash(this.data.showSplash), 120);
    this.bootstrapTimer = setTimeout(() => {
      this.bootstrapTimer = null;
      this.bootstrapHome();
    }, 80);
  },

  bootstrapHome() {
    if (!requireAuth()) return;
    if (!this.ensureLoggedIn()) return;
    if (this.redirectIfRoleNotWorker()) return;
    this.setData({ showVerifyBanner: needsRealNameAuth() });
    this.loadUserData();
  },

  onShow() {
    setTimeout(() => this.syncTabBarSplash(this.data.showSplash), 80);
    if (this.bootstrapTimer) return;
    setTimeout(() => {
      if (!this.ensureLoggedIn()) return;
      if (this.redirectIfRoleNotWorker()) return;
      this.loadUserData();
    }, 80);
  },

  onUnload() {
    if (this.bootstrapTimer) {
      clearTimeout(this.bootstrapTimer);
      this.bootstrapTimer = null;
    }
    if (this.splashTimer) {
      clearTimeout(this.splashTimer);
      this.splashTimer = null;
    }
    this.syncTabBarSplash(false);
  },

  onPullDownRefresh() {
    this.loadUserData().finally(() => wx.stopPullDownRefresh());
  },

  ensureLoggedIn() {
    if (hasLoginSession()) return true;
    if (storageReadFailed) {
      if (!this.bootstrapTimer) {
        this.bootstrapTimer = setTimeout(() => {
          this.bootstrapTimer = null;
          this.bootstrapHome();
        }, 200);
      }
      return false;
    }
    wx.reLaunch({ url: '/pages/login/login' });
    return false;
  },

  pickActionCardBackground() {
    const index = Math.floor(Math.random() * HOME_ACTION_BACKGROUNDS.length);
    this.actionBgIndex = index;
    this.setData({ actionCardBg: HOME_ACTION_BACKGROUNDS[index] });
  },

  onActionBgError() {
    const currentIndex = typeof this.actionBgIndex === 'number' ? this.actionBgIndex : 0;
    const nextIndex = (currentIndex + 1) % HOME_ACTION_BACKGROUNDS.length;
    this.actionBgIndex = nextIndex;
    this.setData({ actionCardBg: HOME_ACTION_BACKGROUNDS[nextIndex] });
  },

  startSplashTimer() {
    if (this.splashTimer) clearTimeout(this.splashTimer);
    this.splashTimer = setTimeout(() => {
      this.setData({ showSplash: false });
      this.syncTabBarSplash(false);
      this.splashTimer = null;
    }, 1500);
  },

  hideSplash() {
    if (this.splashTimer) {
      clearTimeout(this.splashTimer);
      this.splashTimer = null;
    }
    this.setData({ showSplash: false });
    this.syncTabBarSplash(false);
  },

  syncTabBarSplash(hidden) {
    if (typeof this.getTabBar !== 'function') return;
    const tabBar = this.getTabBar();
    if (!tabBar) return;
    tabBar.setData({ hiddenForSplash: Boolean(hidden) });
  },

  redirectIfRoleNotWorker() {
    const userInfo = safeGetStorageSync('userInfo', null);
    const role = resolveRole(userInfo);
    if (role === 'boss') {
      wx.reLaunch({ url: '/pages/base/list/list' });
      return true;
    }
    if (isAdminRole(role)) {
      wx.reLaunch({ url: '/pages/admin/home/home' });
      return true;
    }
    return false;
  },

  async loadUserData() {
    sanitizeAvatarInCache();
    const cached = safeGetStorageSync('userInfo', {}) || {};
    const name = getDisplayName(cached);
    const timeCopy = getHomeTimeCopy();
    this.setData({
      'user.name': name,
      'user.avatar': pickAvatar(cached),
      'user.initial': name && name.length ? name[0] : '?',
      'user.roleText': roleLabel(resolveRole(cached)),
      greetingLabel: timeCopy.greeting,
      greetingName: name,
      greetingText: `${timeCopy.greeting}，${name}`,
      dateText: timeCopy.dateText,
      showVerifyBanner: needsRealNameAuth(),
    });

    // Fetch fresh data silently
    const token = safeGetStorageSync('token', '');
    if (!token) return;

    try {
      const profile = await app.request({ url: '/user/profile', method: 'GET' });
      if (profile) {
        const currentUser = safeGetStorageSync('userInfo', {}) || {};
        if (!isSameUser(currentUser, profile)) {
          clearInvalidSession();
          wx.showToast({ title: '登录状态异常，请重新登录', icon: 'none' });
          setTimeout(() => wx.reLaunch({ url: '/pages/login/login' }), 700);
          return;
        }
        const mergedProfile = syncUserInfoCache(profile);
        const freshName = getDisplayName(mergedProfile);
        this.setData({
          'user.name': freshName,
          'user.avatar': pickAvatar(mergedProfile),
          'user.initial': freshName && freshName.length ? freshName[0] : '?',
          'user.roleText': roleLabel(resolveRole(mergedProfile)),
          greetingName: freshName,
          greetingText: `${timeCopy.greeting}，${freshName}`,
          showVerifyBanner: needsRealNameAuth(),
        });
      }

      // Try to get check-in status
      try {
        const qrData = await app.request({ url: '/attendance/qrcode', method: 'GET' });
        const statusRaw = trimText(qrData?.checkinStatus || qrData?.status || '').toLowerCase();
        this.setData({
          checkedIn: qrData?.checkedIn === true || statusRaw === 'checked_in' || statusRaw === 'signed',
        });
      } catch (_) { /* ignore */ }

      // Try salary hint
      try {
        const salaryStats = await app.request({ url: '/salary/worker/stats', method: 'GET' });
        if (salaryStats && salaryStats.pendingCount > 0) {
          this.setData({ salaryHint: `${salaryStats.pendingCount} 笔待确认` });
        } else if (salaryStats && salaryStats.totalEarned > 0) {
          this.setData({ salaryHint: `累计收入 ¥${Number(salaryStats.totalEarned).toFixed(2)}` });
        }
      } catch (_) { /* ignore */ }

      // Try signup hint
      try {
        const records = await app.request({ url: '/attendance/worker/records?limit=5', method: 'GET' });
        const count = Array.isArray(records) ? records.length : 0;
        this.setData({ signupHint: count > 0 ? `${count} 个进行中` : '暂无报名' });
      } catch (_) { /* ignore */ }
    } catch (_) { /* offline mode is fine */ }
  },

  onAvatarError() {
    sanitizeAvatarInCache();
    this.setData({ 'user.avatar': DEFAULT_AVATAR });
  },

  goToJobList() {
    wx.navigateTo({ url: '/pages/job/list/list' });
  },

  goToSalary() {
    wx.navigateTo({ url: '/pages/salary/salary' });
  },

  goToMySignups() {
    wx.navigateTo({ url: '/pages/profile/signups/signups' });
  },

  goToPolicyConsult() {
    wx.navigateTo({ url: '/pages/policy/list/list' });
  },

  goToTraining() {
    wx.navigateTo({ url: '/pages/training/list/list' });
  },

  goToMoreServices() {
    wx.navigateTo({ url: '/pages/index/services/services' });
  },

  goToProfile() {
    wx.switchTab({ url: '/pages/profile/profile' });
  },

  goToVerify() {
    wx.navigateTo({ url: '/pages/verify/verify' });
  },
});
