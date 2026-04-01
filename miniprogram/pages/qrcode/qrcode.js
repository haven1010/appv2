const app = getApp();
const { resolveRole, isAdminRole, roleLabel } = require('../../utils/role');

const QR_REFRESH_DELAY_MS = 220;
const STAMP_HIT_MS = 450;
const STAMP_HIDE_MS = 1450;

const QR_IMAGE_KEYS = [
  'qrImageUrl',
  'qrCodeUrl',
  'imageUrl',
  'image',
  'qrImage',
  'qrcodeUrl',
  'qrImageBase64',
  'qrCodeBase64',
  'qrBase64',
  'imageBase64',
  'base64',
];

function trimText(value) {
  return typeof value === 'string' ? value.trim() : '';
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

function hasLoginSession() {
  const token = wx.getStorageSync('token');
  const userInfo = wx.getStorageSync('userInfo');
  return Boolean(token && userInfo);
}

function pickAvatarUrl(userInfo) {
  if (!userInfo) return '/images/zhihui-logo.jpg';
  const candidates = [
    userInfo.avatarUrl,
    userInfo.faceImgUrl,
    userInfo.headImgUrl,
    userInfo.photoUrl,
  ];

  for (let i = 0; i < candidates.length; i += 1) {
    const url = trimText(candidates[i]);
    if (url && !isTemporaryImageUrl(url)) return url;
  }

  return '/images/zhihui-logo.jpg';
}

function sanitizeAvatarInCache() {
  const cached = wx.getStorageSync('userInfo') || {};
  if (!cached || typeof cached !== 'object') return;

  const next = Object.assign({}, cached);
  let changed = false;
  ['avatarUrl', 'faceImgUrl', 'headImgUrl', 'photoUrl'].forEach((key) => {
    if (isTemporaryImageUrl(next[key])) {
      next[key] = '';
      changed = true;
    }
  });

  if (!changed) return;
  wx.setStorageSync('userInfo', next);
  app.globalData.userInfo = next;
}

function pickJobType(userInfo) {
  const explicit = trimText(
    (userInfo && (userInfo.jobType || userInfo.workType || userInfo.occupation || userInfo.positionName)) || '',
  );
  return explicit || roleLabel(resolveRole(userInfo));
}

function asPositiveNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) && num >= 0 ? num : null;
}

function pickStreakDays(userInfo) {
  if (!userInfo) return '0';

  const candidates = [
    userInfo.workStreakDays,
    userInfo.streakDays,
    userInfo.continuousDays,
    userInfo.totalWorkDays,
  ];

  for (let i = 0; i < candidates.length; i += 1) {
    const num = asPositiveNumber(candidates[i]);
    if (num !== null) return String(Math.floor(num));
  }

  return '0';
}

function pickTotalEarnings(userInfo) {
  if (!userInfo) return '0.00';

  const candidates = [
    userInfo.totalEarnings,
    userInfo.totalIncome,
    userInfo.income,
    userInfo.salaryTotal,
  ];

  for (let i = 0; i < candidates.length; i += 1) {
    const num = asPositiveNumber(candidates[i]);
    if (num !== null) return num.toFixed(2);
  }

  return '0.00';
}

function normalizeImageUrl(url) {
  const value = trimText(url);
  if (!value) return '';

  if (isTemporaryImageUrl(value)) return '';
  if (/^https?:\/\//i.test(value) || /^data:image\//i.test(value)) return value;
  if (value.startsWith('//')) return `https:${value}`;

  if (value.startsWith('/')) {
    const baseUrl = trimText(app && app.globalData && app.globalData.baseUrl);
    const match = baseUrl.match(/^(https?:\/\/[^/]+)/i);
    return match ? `${match[1]}${value}` : '';
  }

  return '';
}

function normalizeBase64(value) {
  const b64 = trimText(value);
  if (!b64) return '';
  if (/^data:image\//i.test(b64)) return b64;
  return `data:image/png;base64,${b64.replace(/^base64,/i, '')}`;
}

function pickQrCodeUrl(payload) {
  if (!payload || typeof payload !== 'object') return '';

  for (let i = 0; i < QR_IMAGE_KEYS.length; i += 1) {
    const key = QR_IMAGE_KEYS[i];
    const raw = payload[key];
    const imageUrl = /base64/i.test(key) ? normalizeBase64(raw) : normalizeImageUrl(raw);
    if (imageUrl) return imageUrl;
  }

  return normalizeImageUrl(payload.content);
}

function formatTimeLabel(date = new Date()) {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function pickCheckinStatusText(payload) {
  const statusRaw = trimText(payload?.checkinStatus || payload?.status || payload?.attendanceStatus).toLowerCase();
  if (payload?.checkedIn === true || statusRaw === 'checked_in' || statusRaw === 'signed') {
    return '✅ 今日已签到';
  }
  return '🕘 今日未签到';
}

Page({
  data: {
    qrCodeUrl: '',
    name: '用户',
    job: '采摘工',
    avatar: '/images/zhihui-logo.jpg',
    showStamp: false,
    stampAnim: '',
    refreshing: false,
    checkinStatusText: '🕘 今日未签到',
    streakDays: '0',
    totalEarnings: '0.00',
    lastRefreshTime: '--:--',
  },

  onLoad() {
    if (!this.ensureLoggedIn()) return;
    if (this.redirectIfRoleNotWorker()) return;
    this.initUserInfo();
    this.getQRCode();
  },

  onShow() {
    if (!this.ensureLoggedIn()) return;
    if (this.redirectIfRoleNotWorker()) return;

    const tabBar = this.getTabBar && this.getTabBar();
    if (tabBar) tabBar.setData({ selected: 2 });

    this.initUserInfo();
  },

  onPullDownRefresh() {
    if (!this.ensureLoggedIn()) {
      wx.stopPullDownRefresh();
      return;
    }
    this.getQRCode().finally(() => wx.stopPullDownRefresh());
  },

  ensureLoggedIn() {
    if (hasLoginSession()) return true;
    wx.reLaunch({ url: '/pages/login/login' });
    return false;
  },

  initUserInfo() {
    sanitizeAvatarInCache();
    const userInfo = wx.getStorageSync('userInfo');
    if (!userInfo) return;

    this.setData({
      avatar: pickAvatarUrl(userInfo),
      name: trimText(userInfo.name) || '用户',
      job: pickJobType(userInfo),
      streakDays: pickStreakDays(userInfo),
      totalEarnings: pickTotalEarnings(userInfo),
    });
  },


  onAvatarError() {
    sanitizeAvatarInCache();
    this.setData({ avatar: '/images/zhihui-logo.jpg' });
  },

  redirectIfRoleNotWorker() {
    const userInfo = wx.getStorageSync('userInfo');
    const role = resolveRole(userInfo);
    if (role === 'boss') {
      wx.reLaunch({ url: '/pages/boss/dashboard/dashboard' });
      return true;
    }
    if (isAdminRole(role)) {
      wx.reLaunch({ url: '/pages/admin/home/home' });
      return true;
    }
    return false;
  },

  async getQRCode() {
    if (!this.ensureLoggedIn()) return;

    try {
      const res = await app.request({
        url: '/attendance/qrcode',
        method: 'GET',
      });

      const qrCodeUrl = pickQrCodeUrl(res);
      this.setData({
        qrCodeUrl: qrCodeUrl || '',
        lastRefreshTime: formatTimeLabel(new Date()),
        checkinStatusText: pickCheckinStatusText(res),
      });

      if (!qrCodeUrl) {
        wx.showToast({ title: '二维码加载失败', icon: 'none' });
      }
    } catch (error) {
      if (/Login expired/i.test(String(error?.message || ''))) return;
      wx.showToast({ title: '二维码加载失败', icon: 'none' });
    }
  },

  refreshQR() {
    if (this.data.refreshing) return;

    this.setData({
      refreshing: true,
      showStamp: true,
      stampAnim: 'stamp-anim-drop',
    });

    setTimeout(() => {
      this.getQRCode();
    }, QR_REFRESH_DELAY_MS);

    setTimeout(() => {
      try {
        wx.vibrateShort({ type: 'medium' });
      } catch (_) {
        wx.vibrateShort();
      }
    }, STAMP_HIT_MS);

    setTimeout(() => {
      this.setData({
        showStamp: false,
        stampAnim: '',
        refreshing: false,
      });
    }, STAMP_HIDE_MS);
  },

  onQrImageError() {
    this.setData({ qrCodeUrl: '' });
  },
});
