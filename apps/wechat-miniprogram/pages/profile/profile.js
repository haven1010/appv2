/**
 * Layer: Mini Program Page
 * Responsibility: Worker profile and personal center page.
 */
const app = getApp();
const { resolveRole, isAdminRole, roleLabel } = require('../../utils/role');
const PROFILE_MOODS = [
  '认真上工，也要热爱生活。',
  '把今天过好，就是最好的收获。',
  '一步一步来，日子会发光。',
  '愿你忙有所得，也有好心情。',
  '好好生活，慢慢遇见更好的自己。',
  '认真工作，也别忘了抬头看看天。',
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

Page({
  data: {
    pageReady: false,
    userInfo: null,
    role: 'worker',
    roleText: '采摘工',
    avatarUrl: '',
    displayInitial: '?',
    displayName: '未登录用户',
    displayUid: '--',
    profileMoodText: PROFILE_MOODS[0],
    profileMoodIndex: 0,
    workDaysText: '0',
    totalIncomeText: '0.00',
    signupCountText: '0',
    loading: true,
  },

  onLoad() {
    if (this.redirectIfRoleNotWorker()) return;
    this.checkLogin();
    this.startMoodTicker();
    this.readyTimer = setTimeout(() => {
      this.setData({ pageReady: true });
    }, 30);
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
    if (this.readyTimer) {
      clearTimeout(this.readyTimer);
      this.readyTimer = null;
    }
    if (this.moodTimer) {
      clearInterval(this.moodTimer);
      this.moodTimer = null;
    }
  },

  startMoodTicker() {
    if (this.moodTimer) {
      clearInterval(this.moodTimer);
      this.moodTimer = null;
    }

    this.moodTimer = setInterval(() => {
      const nextIndex = (Number(this.data.profileMoodIndex || 0) + 1) % PROFILE_MOODS.length;
      this.setData({
        profileMoodIndex: nextIndex,
        profileMoodText: PROFILE_MOODS[nextIndex],
      });
    }, 30000);
  },

  checkLogin() {
    sanitizeAvatarInCache();
    const userInfo = wx.getStorageSync('userInfo');
    if (!userInfo) {
      wx.showModal({
        title: '提示',
        content: '请先登录',
        showCancel: false,
        success: () => wx.switchTab({ url: '/pages/index/index' }),
      });
      return;
    }

    const role = resolveRole(userInfo);
    const name = userInfo.name || '未登录用户';
    this.setData({
      userInfo,
      role,
      roleText: roleLabel(role),
      avatarUrl: resolveAvatar(userInfo),
      displayName: name,
      displayUid: userInfo.uid || '--',
      displayInitial: name && name.length ? name[0] : '?',
    });
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
    const token = wx.getStorageSync('token');
    if (!token) {
      this.setData({ loading: false });
      return;
    }

    this.setData({ loading: true });

    try {
      const [profile, records] = await Promise.all([
        app.request({ url: '/user/profile', method: 'GET' }).catch(() => null),
        app.request({ url: '/attendance/worker/records?limit=200', method: 'GET' }).catch(() => []),
      ]);

      sanitizeAvatarInCache();
      const cachedUser = wx.getStorageSync('userInfo') || {};
      const mergedUser = Object.assign({}, cachedUser, profile || {});
      const name = mergedUser.name || '未登录用户';
      const workDays = Array.isArray(records) ? records.length : 0;
      const totalIncome = 0;
      const signupCount = Array.isArray(records) ? records.length : 0;

      wx.setStorageSync('userInfo', mergedUser);
      app.globalData.userInfo = mergedUser;

      this.setData({
        userInfo: mergedUser,
        role: resolveRole(mergedUser),
        roleText: roleLabel(resolveRole(mergedUser)),
        avatarUrl: resolveAvatar(mergedUser),
        displayName: name,
        displayUid: mergedUser.uid || '--',
        displayInitial: name && name.length ? name[0] : '?',
        workDaysText: String(workDays),
        totalIncomeText: toAmountText(totalIncome),
        signupCountText: String(signupCount),
        loading: false,
      });
    } catch (err) {
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败，请稍后再试', icon: 'none' });
    }
  },

  onAvatarError() {
    sanitizeAvatarInCache();
    this.setData({ avatarUrl: '' });
  },

  goBasicInfo() {
    wx.navigateTo({ url: '/pages/profile/userInfo/userInfo' });
  },

  goMySignups() {
    wx.navigateTo({ url: '/pages/profile/signups/signups' });
  },

  goSalary() {
    wx.navigateTo({ url: '/pages/salary/salary' });
  },

  goSalaryCard() {
    wx.navigateTo({ url: '/pages/profile/salaryCard/salaryCard' });
  },

  showWorkHistory() {
    wx.navigateTo({ url: '/pages/profile/workHistory/workHistory' });
  },

  logout() {
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (!res.confirm) return;
        wx.removeStorageSync('token');
        wx.removeStorageSync('userInfo');
        app.globalData.token = null;
        app.globalData.userInfo = null;
        wx.switchTab({ url: '/pages/index/index' });
      },
    });
  },
});
