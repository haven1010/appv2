/**
 * Layer: Mini Program Page
 * Responsibility: Worker profile and personal center (senior-friendly).
 */
const app = getApp();
const { requireAuth } = require('../../utils/auth-guard');
const { resolveRole, isAdminRole, roleLabel } = require('../../utils/role');

const PROFILE_MOODS = [
  '认真上工，也要热爱生活。',
  '把今天过好，就是最好的收获。',
  '一步一步来，日子会发光。',
  '愿你忙有所得，也有好心情。',
  '好好生活，慢慢遇见更好的自己。',
];

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

function resolveAvatar(userInfo) {
  if (!userInfo) return '';
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
  return '';
}

function sanitizeAvatarInCache() {
  const cached = wx.getStorageSync('userInfo') || {};
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
  wx.setStorageSync('userInfo', next);
  app.globalData.userInfo = next;
}

function toAmountText(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num.toFixed(2) : '0.00';
}

function toIntText(value) {
  const num = Number(value);
  return Number.isFinite(num) && num >= 0 ? String(Math.floor(num)) : '0';
}

function toHourText(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return '0';
  if (Math.abs(num - Math.round(num)) < 0.01) return String(Math.round(num));
  return num.toFixed(1);
}

function pickFirstNumber(source, keys) {
  if (!source || typeof source !== 'object') return null;
  for (let i = 0; i < keys.length; i += 1) {
    const num = Number(source[keys[i]]);
    if (Number.isFinite(num) && num >= 0) return num;
  }
  return null;
}

function buildCalendarDays() {
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - 2);
  const days = [];

  for (let i = 0; i < 5; i += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    days.push({
      key: `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`,
      day: String(date.getDate()),
      week: weekdays[date.getDay()],
      active: i === 2,
    });
  }

  return days;
}

Page({
  data: {
    pageReady: false,
    avatarUrl: '',
    displayInitial: '?',
    displayName: '用户',
    roleText: '采摘工',
    profileMoodText: PROFILE_MOODS[0],
    profileMoodIndex: 0,
    totalIncomeText: '0.00',
    totalWorkDaysText: '0',
    totalWorkHoursText: '0',
    pendingAmountText: '0.00',
    loading: true,
    hasProfile: false,
    calendarDays: buildCalendarDays(),
  },

  onLoad() {
    if (!requireAuth()) return;
    if (this.redirectIfRoleNotWorker()) return;
    this.loadProfile();
    this.startMoodTicker();
    setTimeout(() => { this.setData({ pageReady: true }); }, 50);
  },

  onShow() {
    if (this.redirectIfRoleNotWorker()) return;
    this.loadProfile();
  },

  onPullDownRefresh() {
    this.loadProfile();
    setTimeout(() => wx.stopPullDownRefresh(), 1000);
  },

  onUnload() {
    if (this.moodTimer) {
      clearInterval(this.moodTimer);
      this.moodTimer = null;
    }
  },

  startMoodTicker() {
    if (this.moodTimer) clearInterval(this.moodTimer);
    this.moodTimer = setInterval(() => {
      const nextIndex = (Number(this.data.profileMoodIndex || 0) + 1) % PROFILE_MOODS.length;
      this.setData({
        profileMoodIndex: nextIndex,
        profileMoodText: PROFILE_MOODS[nextIndex],
      });
    }, 30000);
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

  async loadProfile() {
    sanitizeAvatarInCache();
    const cached = wx.getStorageSync('userInfo') || {};
    const name = trimText(cached.name) || '用户';
    this.setData({
      avatarUrl: resolveAvatar(cached),
      displayName: name,
      displayInitial: name && name.length ? name[0] : '?',
      roleText: roleLabel(resolveRole(cached)),
      hasProfile: Boolean(cached.name),
    });

    const token = wx.getStorageSync('token');
    if (!token) {
      this.setData({ loading: false });
      return;
    }

    this.setData({ loading: true });

    try {
      const [profile, salaryStats] = await Promise.all([
        app.request({ url: '/user/profile', method: 'GET' }).catch(() => null),
        app.request({ url: '/salary/worker/stats', method: 'GET' }).catch(() => null),
      ]);

      sanitizeAvatarInCache();
      const merged = Object.assign({}, cached, profile || {});
      const mergedName = trimText(merged.name) || '用户';
      const totalIncome = salaryStats && salaryStats.totalEarned ? Number(salaryStats.totalEarned) : 0;
      const workDays = pickFirstNumber(salaryStats, ['workDays', 'totalDays', 'totalWorkDays'])
        ?? pickFirstNumber(merged, ['workDays', 'totalDays', 'totalWorkDays', 'workStreakDays', 'streakDays'])
        ?? 0;
      const workHours = pickFirstNumber(salaryStats, ['totalHours', 'totalWorkHours', 'workHours', 'durationHours'])
        ?? pickFirstNumber(merged, ['totalHours', 'totalWorkHours', 'workHours', 'durationHours'])
        ?? (workDays * 8);
      const pendingAmount = pickFirstNumber(salaryStats, ['pendingAmount', 'pendingSalaryAmount', 'pendingTotal']) ?? 0;

      wx.setStorageSync('userInfo', merged);
      app.globalData.userInfo = merged;

      this.setData({
        avatarUrl: resolveAvatar(merged),
        displayName: mergedName,
        displayInitial: mergedName && mergedName.length ? mergedName[0] : '?',
        roleText: roleLabel(resolveRole(merged)),
        totalIncomeText: toAmountText(totalIncome),
        totalWorkDaysText: toIntText(workDays),
        totalWorkHoursText: toHourText(workHours),
        pendingAmountText: toAmountText(pendingAmount),
        hasProfile: Boolean(merged.name),
        loading: false,
      });
    } catch (err) {
      this.setData({ loading: false });
    }
  },

  onAvatarError() {
    sanitizeAvatarInCache();
    this.setData({ avatarUrl: '' });
  },

  goSalary() {
    wx.navigateTo({ url: '/pages/salary/salary' });
  },

  goMySignups() {
    wx.navigateTo({ url: '/pages/profile/signups/signups' });
  },

  goSalaryCard() {
    wx.navigateTo({ url: '/pages/profile/salaryCard/salaryCard' });
  },

  showWorkHistory() {
    wx.navigateTo({ url: '/pages/profile/workHistory/workHistory' });
  },

  goSettings() {
    wx.navigateTo({ url: '/pages/profile/settings/settings' });
  },
});
