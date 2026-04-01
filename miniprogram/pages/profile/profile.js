/**
 * Layer: Mini Program Page
 * Responsibility: Implements the Profile page lifecycle and navigation for worker users.
 */
const app = getApp();
const { resolveRole, isAdminRole, roleLabel } = require('../../utils/role');

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
    workerStats: {
      workDays: 0,
      pendingAmount: 0,
      totalEarned: 0,
    },
    workDaysText: '0',
    totalIncomeText: '0.00',
    signupCountText: '0',
    badgeNewbieActive: false,
    badgeAttendanceActive: false,
    badgeSalaryActive: false,
    growthHint: '完成 3 天工作可升级',
    loading: true,
  },

  onLoad() {
    if (this.redirectIfRoleNotWorker()) return;
    this.checkLogin();
    this.readyTimer = setTimeout(() => {
      this.setData({ pageReady: true });
    }, 30);
  },

  onShow() {
    if (this.redirectIfRoleNotWorker()) return;
    const tabBar = this.getTabBar && this.getTabBar();
    if (tabBar) {
      tabBar.setData({ selected: 4 });
    }
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
      wx.reLaunch({ url: '/pages/boss/dashboard/dashboard' });
      return true;
    }
    if (isAdminRole(role)) {
      wx.reLaunch({ url: '/pages/admin/home/home' });
      return true;
    }
    return false;
  },

  updateGrowthState(workDays, totalIncome) {
    const badgeNewbieActive = workDays >= 1;
    const badgeAttendanceActive = workDays >= 10;
    const badgeSalaryActive = totalIncome >= 2000;

    let growthHint = '完成 3 天工作可升级';
    if (workDays < 3) {
      growthHint = '完成 3 天工作可升级';
    } else if (workDays < 10) {
      growthHint = `再完成 ${10 - workDays} 天可解锁「出勤达人」`;
    } else if (!badgeSalaryActive) {
      growthHint = '累计收入满 2000 可点亮「结算先锋」';
    } else {
      growthHint = '已解锁全部成长徽章，继续保持';
    }

    this.setData({
      badgeNewbieActive,
      badgeAttendanceActive,
      badgeSalaryActive,
      growthHint,
    });
  },

  async loadProfile() {
    const token = wx.getStorageSync('token');
    if (!token) {
      this.setData({ loading: false });
      return;
    }

    this.setData({ loading: true });

    try {
      const [profile, stats, records] = await Promise.all([
        app.request({ url: '/user/profile', method: 'GET' }).catch(() => null),
        app.request({ url: '/salary/worker/stats', method: 'GET' }).catch(() => null),
        app.request({ url: '/attendance/worker/records?limit=200', method: 'GET' }).catch(() => []),
      ]);

      sanitizeAvatarInCache();
      const userInfo = wx.getStorageSync('userInfo') || {};
      const mergedUser = Object.assign({}, userInfo, profile || {});
      const role = resolveRole(mergedUser);

      const name = mergedUser.name || '未登录用户';
      const workDays = Number((stats && (stats.workDays ?? stats.totalDays)) || 0);
      const totalIncome = Number((stats && (stats.totalEarned ?? stats.totalPaid ?? stats.pendingAmount)) || 0);
      const signupCount = Array.isArray(records) ? records.length : 0;

      this.setData({
        userInfo: mergedUser,
        role,
        roleText: roleLabel(role),
        avatarUrl: resolveAvatar(mergedUser),
        displayName: name,
        displayUid: mergedUser.uid || '--',
        displayInitial: name && name.length ? name[0] : '?',
        workerStats: Object.assign(
          {
            workDays: 0,
            pendingAmount: 0,
            totalEarned: 0,
          },
          stats || {},
        ),
        workDaysText: String(workDays),
        totalIncomeText: toAmountText(totalIncome),
        signupCountText: String(signupCount),
        loading: false,
      });

      this.updateGrowthState(workDays, totalIncome);
    } catch (err) {
      console.error('加载资料失败:', err);
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败，请稍后重试', icon: 'none' });
    }
  },


  onAvatarError() {
    sanitizeAvatarInCache();
    this.setData({ avatarUrl: '' });
  },

  goBasicInfo() {
    wx.navigateTo({ url: '/pages/profile/userInfo/userInfo' });
  },

  goSalaryCard() {
    wx.navigateTo({ url: '/pages/profile/salaryCard/salaryCard' });
  },

  goMySignups() {
    wx.navigateTo({ url: '/pages/profile/signups/signups' });
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