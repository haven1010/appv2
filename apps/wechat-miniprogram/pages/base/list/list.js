const app = getApp();
const { requireAuth } = require('../../../utils/auth-guard');
const { resolveRole } = require('../../../utils/role');

function toText(value) {
  return String(value || '').trim();
}

function toArray(value) {
  if (Array.isArray(value)) return value;
  if (value && Array.isArray(value.list)) return value.list;
  return [];
}

function normalizePhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.length > 11 ? digits.slice(-11) : digits;
}

function normalizeName(value) {
  return toText(value).replace(/\s+/g, '');
}

function safeParseJson(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(String(value));
  } catch (_) {
    return {};
  }
}

function buildBossIdentity(profile, cachedUser) {
  const merged = Object.assign({}, cachedUser || {}, profile || {});
  return {
    userId: Number(merged.id || merged.userId || 0),
    name: normalizeName(merged.name),
    phone: normalizePhone(merged.phone || merged.mobile),
  };
}

function isBossRelatedBase(base, bossIdentity) {
  if (!base || !bossIdentity) return false;
  if (bossIdentity.userId && Number(base.ownerId || 0) === bossIdentity.userId) return true;

  const description = safeParseJson(base.description);
  const ownerProfile = description?.ownerProfile || {};
  const companyAdminContact = description?.companyAdminContact || {};

  const ownerPhone = normalizePhone(ownerProfile.phone);
  const adminPhone = normalizePhone(companyAdminContact.phone);
  if (bossIdentity.phone && (ownerPhone === bossIdentity.phone || adminPhone === bossIdentity.phone)) {
    return true;
  }

  const ownerName = normalizeName(ownerProfile.name);
  return Boolean(bossIdentity.name && ownerName && ownerName === bossIdentity.name);
}

Page({
  data: {
    bases: [],
    loading: true,
    category: 0,
    regionCode: '',
    role: 'worker',
    isBossView: false,
  },

  onLoad(options) {
    if (!requireAuth()) return;
    this.initRoleView();
    if (this.data.isBossView) {
      wx.setNavigationBarTitle({ title: '我的基地' });
    }
    if (options.category && !this.data.isBossView) {
      this.setData({ category: Number(options.category) || 0 });
    }
    this.loadBases();
  },

  onShow() {
    this.initRoleView();
    if (this.data.isBossView) {
      const tabBar = this.getTabBar && this.getTabBar();
      if (tabBar) tabBar.setData({ selected: 0 });
    }
  },

  onPullDownRefresh() {
    this.loadBases().finally(() => wx.stopPullDownRefresh());
  },

  initRoleView() {
    const userInfo = wx.getStorageSync('userInfo') || {};
    const role = resolveRole(userInfo);
    this.setData({
      role,
      isBossView: role === 'boss',
    });
  },

  async loadBossBases() {
    const cachedUser = wx.getStorageSync('userInfo') || {};
    const ownerId = Number(cachedUser.id || cachedUser.userId || 0);
    const ownedBases = ownerId
      ? await app.request({ url: `/base?ownerId=${ownerId}&showAll=1`, method: 'GET' }).catch(() => [])
      : [];
    const ownedList = toArray(ownedBases);
    if (ownedList.length > 0) return ownedList;

    const profile = await app.request({ url: '/user/profile', method: 'GET' }).catch(() => ({}));
    const bossIdentity = buildBossIdentity(profile, cachedUser);
    const allBases = await app.request({ url: '/base?showAll=1', method: 'GET' }).catch(() => []);
    return toArray(allBases).filter((base) => isBossRelatedBase(base, bossIdentity));
  },

  async loadBases() {
    this.setData({ loading: true });
    try {
      if (this.data.isBossView) {
        const bases = await this.loadBossBases();
        this.setData({ bases: toArray(bases), loading: false });
        return;
      }

      const params = {};
      if (this.data.category > 0) params.category = this.data.category;
      if (this.data.regionCode) params.regionCode = this.data.regionCode;
      const query = Object.keys(params).map((key) => `${key}=${params[key]}`).join('&');
      const url = query ? `/base?${query}` : '/base';

      const rows = await app.request({ url, method: 'GET' });
      this.setData({ bases: toArray(rows), loading: false });
    } catch (_) {
      wx.showToast({ title: '加载失败', icon: 'none' });
      this.setData({ loading: false });
    }
  },

  goToDetail(e) {
    const baseId = Number(e.currentTarget.dataset.id || 0);
    if (!baseId) return;
    wx.navigateTo({ url: `/pages/base/detail/detail?id=${baseId}` });
  },

  goToBossDashboard() {
    wx.redirectTo({ url: '/pages/boss/dashboard/dashboard' });
  },

  goToBossJobList() {
    wx.redirectTo({ url: '/pages/job/list/list' });
  },

  goToBossProfile() {
    wx.redirectTo({ url: '/pages/boss/profile/profile' });
  },

  filterByCategory(e) {
    if (this.data.isBossView) return;
    const category = Number(e.currentTarget.dataset.category || 0);
    this.setData({ category });
    this.loadBases();
  },
});
