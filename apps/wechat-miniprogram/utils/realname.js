/**
 * Layer: Mini Program Utility
 * Responsibility: Local no-cost real-name completion checks.
 */

function text(value) {
  return String(value || '').trim();
}

function digits(value) {
  return String(value || '').replace(/\D/g, '');
}

function isWorkerProfileComplete(profile = {}) {
  const role = profile.roleKey || profile.role || 'worker';
  if (role !== 'worker') return true;
  return Boolean(
    text(profile.name)
    && /^\d{17}[\dX]$/i.test(text(profile.idCard))
    && /^1\d{10}$/.test(digits(profile.phone))
    && text(profile.homeAddress).length >= 5
  );
}

function isRealNameReady(profile = {}) {
  return isWorkerProfileComplete(profile) && Number(profile.infoAuditStatus || 0) !== 2;
}

function syncProfile(profile = {}) {
  const app = getApp();
  const cached = wx.getStorageSync('userInfo') || {};
  const merged = Object.assign({}, cached, profile);
  if (isWorkerProfileComplete(merged) && Number(merged.infoAuditStatus || 0) !== 2) {
    merged.infoAuditStatus = 1;
  }
  wx.setStorageSync('userInfo', merged);
  app.globalData.userInfo = merged;
  return merged;
}

async function fetchProfile() {
  const app = getApp();
  const profile = await app.request({ url: '/user/profile', method: 'GET' });
  return syncProfile(profile || {});
}

function goVerify() {
  wx.navigateTo({ url: '/pages/verify/verify' });
}

async function ensureRealNameReady(options = {}) {
  const title = options.title || '请先完成实名认证';
  const content = options.content || '完成实名信息后即可使用该功能。';
  let profile = wx.getStorageSync('userInfo') || {};

  if (!isRealNameReady(profile)) {
    try {
      profile = await fetchProfile();
    } catch (_) {
      // Keep cached profile when offline.
    }
  }

  if (isRealNameReady(profile)) return true;

  wx.showModal({
    title,
    content,
    confirmText: '去认证',
    cancelText: '稍后',
    success: (res) => {
      if (res.confirm) goVerify();
    },
  });
  return false;
}

module.exports = {
  ensureRealNameReady,
  fetchProfile,
  isRealNameReady,
  isWorkerProfileComplete,
  syncProfile,
};
