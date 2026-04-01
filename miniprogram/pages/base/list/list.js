/**
 * Layer: Mini Program Page
 * Responsibility: Base list view for worker discovery and boss self-service management.
 */
const app = getApp();
const { resolveRole } = require('../../../utils/role');

function trimText(value) {
  return String(value || '').trim();
}

function normalizePhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.length > 11 ? digits.slice(-11) : digits;
}

function normalizeName(value) {
  return trimText(value).replace(/\s+/g, '');
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

  const ownerId = Number(base.ownerId || 0);
  if (bossIdentity.userId && ownerId === bossIdentity.userId) {
    return true;
  }

  const description = safeParseJson(base.description);
  const ownerProfile = description && typeof description.ownerProfile === 'object' ? description.ownerProfile : {};
  const companyAdminContact = description && typeof description.companyAdminContact === 'object'
    ? description.companyAdminContact
    : {};

  const ownerPhone = normalizePhone(ownerProfile.phone);
  const companyAdminPhone = normalizePhone(companyAdminContact.phone);
  if (bossIdentity.phone && (ownerPhone === bossIdentity.phone || companyAdminPhone === bossIdentity.phone)) {
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
    this.initRoleView();

    if (options.category && !this.data.isBossView) {
      this.setData({ category: parseInt(options.category, 10) || 0 });
    }

    this.loadBases();
  },

  onShow() {
    this.initRoleView();
    if (this.data.isBossView) {
      const tabBar = this.getTabBar && this.getTabBar();
      if (tabBar) {
        tabBar.setData({ selected: 0 });
      }
    }
  },

  onPullDownRefresh() {
    this.loadBases();
    setTimeout(() => {
      wx.stopPullDownRefresh();
    }, 1000);
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
    const normalizedOwnedBases = Array.isArray(ownedBases) ? ownedBases : [];
    if (normalizedOwnedBases.length > 0) return normalizedOwnedBases;

    const profile = await app.request({ url: '/user/profile', method: 'GET' }).catch(() => ({}));
    const bossIdentity = buildBossIdentity(profile, cachedUser);
    const allBases = await app.request({ url: '/base?showAll=1', method: 'GET' }).catch(() => []);
    return (Array.isArray(allBases) ? allBases : []).filter((base) => isBossRelatedBase(base, bossIdentity));
  },

  async loadBases() {
    this.setData({ loading: true });

    try {
      if (this.data.isBossView) {
        const bases = await this.loadBossBases();
        this.setData({
          bases: Array.isArray(bases) ? bases : [],
          loading: false,
        });
        return;
      }

      const params = {};

      if (this.data.category > 0) {
        params.category = this.data.category;
      }
      if (this.data.regionCode) {
        params.regionCode = this.data.regionCode;
      }

      const queryString = Object.keys(params)
        .map((key) => `${key}=${params[key]}`)
        .join('&');
      const url = queryString ? `/base?${queryString}` : '/base';

      const res = await app.request({
        url,
        method: 'GET',
      });

      this.setData({
        bases: Array.isArray(res) ? res : [],
        loading: false,
      });
    } catch (err) {
      console.error('加载基地列表失败:', err);
      wx.showToast({
        title: '加载失败',
        icon: 'none',
      });
      this.setData({ loading: false });
    }
  },

  goToDetail(e) {
    const baseId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/base/detail/detail?id=${baseId}`,
    });
  },

  filterByCategory(e) {
    if (this.data.isBossView) return;
    const category = Number(e.currentTarget.dataset.category || 0);
    this.setData({ category });
    this.loadBases();
  },
});
