/**
 * Layer: Mini Program Page
 * Responsibility: QR code check-in page for workers.
 */
const app = getApp();
const { requireAuth } = require('../../utils/auth-guard');
const { resolveRole, isAdminRole, roleLabel } = require('../../utils/role');
const { ensureRealNameReady } = require('../../utils/realname');

const QR_REFRESH_DELAY_MS = 220;
const STAMP_HIT_MS = 450;
const STAMP_HIDE_MS = 1450;

function trimText(value) {
  return String(value || '').trim();
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
  if (!userInfo) return '/images/zhihui-logo.webp';
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
  return '/images/zhihui-logo.webp';
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
  const keys = [
    'qrImageUrl', 'qrCodeUrl', 'imageUrl', 'image',
    'qrImage', 'qrcodeUrl', 'qrImageBase64', 'qrCodeBase64',
    'qrBase64', 'imageBase64', 'base64',
  ];
  for (let i = 0; i < keys.length; i += 1) {
    const raw = payload[keys[i]];
    const imageUrl = /base64/i.test(keys[i]) ? normalizeBase64(raw) : normalizeImageUrl(raw);
    if (imageUrl) return imageUrl;
  }
  return normalizeImageUrl(payload.content);
}

function formatTimeLabel(date) {
  const d = date || new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

Page({
  data: {
    qrCodeUrl: '',
    name: '用户',
    job: '采摘工',
    avatar: '/images/zhihui-logo.webp',
    checkedIn: false,
    checkinStatusText: '未签到',
    showStamp: false,
    stampAnim: '',
    refreshing: false,
    lastRefreshTime: '--:--',
  },

  onLoad() {
    if (!requireAuth()) return;
    if (!this.ensureLoggedIn()) return;
    if (this.redirectIfRoleNotWorker()) return;
    this.initUserInfo();
    this.loadQRCodeIfAllowed();
  },

  onShow() {
    if (!this.ensureLoggedIn()) return;
    if (this.redirectIfRoleNotWorker()) return;
    this.initUserInfo();
    if (!this.data.qrCodeUrl) this.loadQRCodeIfAllowed();
  },

  onPullDownRefresh() {
    if (!this.ensureLoggedIn()) {
      wx.stopPullDownRefresh();
      return;
    }
    this.loadQRCodeIfAllowed().finally(() => wx.stopPullDownRefresh());
  },

  async loadQRCodeIfAllowed() {
    const ready = await ensureRealNameReady({
      title: '完成实名后使用上工码',
      content: '上工码用于现场签到，请先完善实名信息。',
    });
    if (!ready) return;
    await this.loadQRCode();
  },

  ensureLoggedIn() {
    if (hasLoginSession()) return true;
    wx.reLaunch({ url: '/pages/login/login' });
    return false;
  },

  redirectIfRoleNotWorker() {
    const userInfo = wx.getStorageSync('userInfo');
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

  initUserInfo() {
    sanitizeAvatarInCache();
    const userInfo = wx.getStorageSync('userInfo');
    if (!userInfo) return;
    this.setData({
      avatar: pickAvatarUrl(userInfo),
      name: trimText(userInfo.name) || '用户',
      job: pickJobType(userInfo),
    });
  },

  onAvatarError() {
    sanitizeAvatarInCache();
    this.setData({ avatar: '/images/zhihui-logo.webp' });
  },

  async loadQRCode() {
    try {
      const res = await app.request({ url: '/attendance/qrcode', method: 'GET' });
      const qrCodeUrl = pickQrCodeUrl(res);
      const statusRaw = trimText(res?.checkinStatus || res?.status || '').toLowerCase();
      const checkedIn = res?.checkedIn === true || statusRaw === 'checked_in' || statusRaw === 'signed';
      this.setData({
        qrCodeUrl: qrCodeUrl || '',
        lastRefreshTime: formatTimeLabel(new Date()),
        checkedIn,
        checkinStatusText: checkedIn ? '已签到' : '未签到',
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
    this.setData({ refreshing: true, showStamp: true, stampAnim: 'stamp-anim' });

    setTimeout(() => { this.loadQRCodeIfAllowed(); }, QR_REFRESH_DELAY_MS);
    setTimeout(() => {
      try { wx.vibrateShort({ type: 'medium' }); } catch (_) { wx.vibrateShort(); }
    }, STAMP_HIT_MS);
    setTimeout(() => {
      this.setData({ showStamp: false, stampAnim: '', refreshing: false });
    }, STAMP_HIDE_MS);
  },

  onQrError() {
    this.setData({ qrCodeUrl: '' });
  },
});
