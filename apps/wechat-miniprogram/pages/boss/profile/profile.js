const app = getApp();
const { resolveRole, roleLabel, isAdminRole } = require('../../../utils/role');

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

function maskPhone(phone) {
  const text = trimText(phone);
  if (text.length < 7) return text || '-';
  return `${text.slice(0, 3)}****${text.slice(-4)}`;
}

function maskIdCard(idCard) {
  const text = trimText(idCard).toUpperCase();
  if (!text) return '-';
  if (text.length <= 8) return text;
  return `${text.slice(0, 4)}********${text.slice(-4)}`;
}

function formatAuditStatus(status) {
  const code = Number(status);
  if (code === 1) return '已通过';
  if (code === 2) return '已拒绝';
  return '待审核';
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value && value.list)) return value.list;
  return [];
}

function extractErrorMessage(err, fallback = '保存失败，请稍后重试') {
  const candidates = [
    err && err.message,
    err && err.errMsg,
    err && err.response && err.response.message,
    err && err.response && err.response.msg,
  ];

  for (let i = 0; i < candidates.length; i += 1) {
    const text = trimText(candidates[i]);
    if (text) return text;
  }
  return fallback;
}

function workerKey(item) {
  const id = Number(item && (item.userId || (item.user && item.user.id)) || 0);
  if (id) return `id:${id}`;

  const phone = normalizePhone(item && ((item.user && item.user.phone) || item.workerPhone));
  if (phone) return `phone:${phone}`;

  const name = trimText(item && ((item.user && item.user.name) || item.workerName));
  if (name) return `name:${name}`;

  return '';
}

function countDistinctWorkers(items) {
  const list = normalizeArray(items);
  const uniqueKeys = {};
  let fallbackCount = 0;

  list.forEach((item) => {
    const key = workerKey(item || {});
    if (!key) {
      fallbackCount += 1;
      return;
    }
    uniqueKeys[key] = true;
  });

  return Object.keys(uniqueKeys).length + fallbackCount;
}

function isSignupAndCheckinStatus(value) {
  const num = Number(value);
  if (num === 0 || num === 1) return true;
  const text = trimText(value).toLowerCase();
  if (!text) return false;
  return ['signed_up', 'checked_in', 'pending', 'approved'].includes(text);
}

Page({
  data: {
    loading: true,
    roleText: '企业老板',
    userInfo: null,
    profile: null,
    accountForm: {
      name: '',
      phone: '',
    },
    profileRawPhone: '',
    accountSaving: false,
    latestBase: null,
  },

  onLoad() {
    if (!this.ensureBoss()) return;
    this.loadProfile();
  },

  onShow() {
    if (!this.ensureBoss()) return;

    const tabBar = this.getTabBar && this.getTabBar();
    if (tabBar) {
      tabBar.setData({ selected: 3 });
    }

    this.loadProfile();
  },

  onPullDownRefresh() {
    this.loadProfile().finally(() => wx.stopPullDownRefresh());
  },

  ensureBoss() {
    const token = wx.getStorageSync('token');
    const userInfo = app.getCurrentUser() || wx.getStorageSync('userInfo');
    const role = resolveRole(userInfo);

    if (!token || !userInfo) {
      wx.reLaunch({ url: '/pages/login/login' });
      return false;
    }

    if (role !== 'boss') {
      if (isAdminRole(role)) {
        wx.reLaunch({ url: '/pages/admin/home/home' });
      } else {
        wx.switchTab({
          url: '/pages/index/index',
          fail: () => wx.reLaunch({ url: '/pages/index/index' }),
        });
      }
      return false;
    }

    this.setData({
      userInfo,
      roleText: roleLabel(role),
    });
    return true;
  },

  async loadProfile() {
    this.setData({ loading: true });

    try {
      const cachedUser = app.getCurrentUser() || wx.getStorageSync('userInfo') || {};
      const ownerId = Number(cachedUser.id || cachedUser.userId || 0);
      const profile = await app.request({ url: '/user/profile', method: 'GET' }).catch(() => null);
      const ownedBases = ownerId
        ? await app.request({ url: `/base?ownerId=${ownerId}&showAll=1`, method: 'GET' }).catch(() => [])
        : [];
      let baseList = Array.isArray(ownedBases) ? ownedBases : [];
      if (baseList.length === 0) {
        const bossIdentity = buildBossIdentity(profile, cachedUser);
        const allBases = await app.request({ url: '/base?showAll=1', method: 'GET' }).catch(() => []);
        baseList = (Array.isArray(allBases) ? allBases : []).filter((base) => isBossRelatedBase(base, bossIdentity));
      }

      const mergedUser = Object.assign({}, cachedUser, profile || {});
      wx.setStorageSync('userInfo', mergedUser);
      app.globalData.userInfo = mergedUser;

      const latestBase = (Array.isArray(baseList) ? baseList.slice() : [])
        .sort((a, b) => {
          const at = new Date((a && (a.updatedAt || a.createdAt)) || 0).getTime();
          const bt = new Date((b && (b.updatedAt || b.createdAt)) || 0).getTime();
          return bt - at;
        })[0] || null;

      this.setData({
        userInfo: mergedUser,
        roleText: roleLabel(resolveRole(mergedUser)),
        profile: {
          uid: trimText(mergedUser.uid) || '-',
          name: trimText(mergedUser.name) || '-',
          phoneMasked: maskPhone(mergedUser.phone || mergedUser.mobile),
          idCardMasked: maskIdCard(mergedUser.idCard),
          emergencyContact: trimText(mergedUser.emergencyContact) || '-',
          emergencyPhone: maskPhone(mergedUser.emergencyPhone),
        },
        accountForm: {
          name: trimText(mergedUser.name),
          phone: normalizePhone(mergedUser.phone || mergedUser.mobile),
        },
        profileRawPhone: normalizePhone(mergedUser.phone || mergedUser.mobile),
      });

      if (!latestBase) {
        this.setData({ latestBase: null, loading: false });
        return;
      }

      const myApplications = await app.request({
        url: '/base/applications/me',
        method: 'GET',
      }).catch(() => []);
      const workingRows = normalizeArray(myApplications).filter((item) =>
        Number(item && item.baseId) === Number(latestBase.id) && isSignupAndCheckinStatus(item && item.status));

      this.setData({
        latestBase: {
          baseName: trimText(latestBase.baseName) || '-',
          address: trimText(latestBase.address) || '-',
          auditStatusText: formatAuditStatus(latestBase.auditStatus),
          workerCount: String(countDistinctWorkers(workingRows)),
        },
        loading: false,
      });
    } catch (error) {
      this.setData({ loading: false });
      wx.showToast({
        title: error?.message || '加载失败，请稍后重试',
        icon: 'none',
      });
    }
  },

  onAccountFieldInput(e) {
    const field = e.currentTarget.dataset.field;
    if (!field) return;

    const raw = e.detail.value || '';
    const value = field === 'phone' ? normalizePhone(raw) : raw;
    this.setData({
      accountForm: Object.assign({}, this.data.accountForm, {
        [field]: value,
      }),
    });
  },

  async saveAccountInfo() {
    if (this.data.accountSaving) return;

    const nextName = trimText(this.data.accountForm && this.data.accountForm.name);
    const nextPhone = normalizePhone(this.data.accountForm && this.data.accountForm.phone);
    const currentName = trimText(this.data.profile && this.data.profile.name);
    const currentPhone = normalizePhone(this.data.profileRawPhone);

    if (!nextName) {
      wx.showToast({ title: '姓名不能为空', icon: 'none' });
      return;
    }
    if (nextPhone.length !== 11) {
      wx.showToast({ title: '请输入11位手机号', icon: 'none' });
      return;
    }

    const payload = {};
    if (nextName !== currentName) payload.name = nextName;
    if (nextPhone && nextPhone !== currentPhone) payload.phone = nextPhone;

    if (!Object.keys(payload).length) {
      wx.showToast({ title: '信息未修改', icon: 'none' });
      return;
    }

    this.setData({ accountSaving: true });
    try {
      const updated = await app.request({
        url: '/user/profile',
        method: 'PATCH',
        data: payload,
      });

      const mergedCurrent = Object.assign({}, this.data.userInfo || {}, updated || {}, payload);
      wx.setStorageSync('userInfo', mergedCurrent);
      app.globalData.userInfo = mergedCurrent;

      this.setData({
        userInfo: mergedCurrent,
        profile: Object.assign({}, this.data.profile || {}, {
          name: trimText(mergedCurrent.name) || nextName,
          phoneMasked: maskPhone(mergedCurrent.phone || nextPhone),
        }),
        accountForm: {
          name: trimText(mergedCurrent.name) || nextName,
          phone: normalizePhone(mergedCurrent.phone || nextPhone),
        },
        profileRawPhone: normalizePhone(mergedCurrent.phone || nextPhone),
        accountSaving: false,
      });

      wx.showToast({
        title: Number(updated && updated.infoAuditStatus) === 0 ? '已保存，待审核' : '保存成功',
        icon: 'success',
      });
    } catch (err) {
      this.setData({ accountSaving: false });
      wx.showToast({ title: extractErrorMessage(err), icon: 'none' });
    }
  },

  logout() {
    wx.showModal({
      title: '退出登录',
      content: '确定退出当前账号吗？',
      success: (res) => {
        if (!res.confirm) return;
        wx.removeStorageSync('token');
        wx.removeStorageSync('userInfo');
        app.globalData.token = null;
        app.globalData.userInfo = null;
        wx.reLaunch({ url: '/pages/login/login' });
      },
    });
  },
});
