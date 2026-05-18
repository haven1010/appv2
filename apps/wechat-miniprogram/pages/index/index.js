// pages/index/index.js
const app = getApp();
const { resolveRole, isAdminRole } = require('../../utils/role');

const DEFAULT_AVATAR = '/images/zhihui-logo.jpg';

function toText(value) {
  return String(value || '').trim();
}

function isTemporaryImageUrl(value) {
  const text = toText(value);
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
    const url = toText(candidates[i]);
    if (url && !isTemporaryImageUrl(url)) return url;
  }

  return DEFAULT_AVATAR;
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

function normalizeList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.list)) return payload.list;
  if (Array.isArray(payload?.records)) return payload.records;
  return [];
}

function isRecruitingJob(job = {}) {
  const status = Number(job.status);
  if (status === 1) return true;
  return job.status === 'recruiting' || job.status === 'open';
}

function isJobOpenForSignup(job = {}) {
  if (!job || job.isActive === false) return false;
  if (!isRecruitingJob(job)) return false;

  const auditStatus = Number(job.auditStatus);
  if (Number.isFinite(auditStatus) && auditStatus !== 1) return false;

  if (job.validUntil) {
    const expiresAt = new Date(job.validUntil).getTime();
    if (Number.isFinite(expiresAt) && expiresAt <= Date.now()) return false;
  }

  return true;
}

function pickAvailableJob(jobList = []) {
  if (!Array.isArray(jobList) || jobList.length === 0) return null;
  return jobList.find((job) => isJobOpenForSignup(job)) || null;
}

function isDuplicateSignupError(error) {
  if (!error) return false;
  const message = String(error.message || '');
  return (
    error.statusCode === 400 || error.statusCode === 409
  ) && /\u5df2\u62a5\u540d|\u91cd\u590d|\u8bf7\u52ff\u91cd\u590d|already|duplicate/i.test(message);
}

function isUnavailableJobError(error) {
  if (!error) return false;
  const message = String(error.message || '');
  return (
    error.statusCode === 400 || error.statusCode === 404 || error.statusCode === 409
  ) && /停招|不在招聘中|尚未审核|过期|不存在|下架|offline|expired|not found/i.test(message);
}

function getConflictMessage(error) {
  if (!error || Number(error.statusCode) !== 409) return '';

  const message = String(error.message || '').trim();
  if (message) return message;

  const detail = error.data || error.response?.data || {};
  const baseName = detail.conflictBaseName || '未知基地';
  const jobTitle = detail.conflictJobTitle || '未知岗位';
  return `您已报名【${baseName} / ${jobTitle}】，时间冲突。如需报名此工作，请先取消原报名。`;
}

function encodeText(value) {
  return encodeURIComponent(String(value || ''));
}

function syncUserInfoCache(profile = {}) {
  const cached = wx.getStorageSync('userInfo') || {};
  const merged = Object.assign({}, cached, profile);
  const avatar = pickAvatar(profile);

  if (avatar && avatar !== DEFAULT_AVATAR) {
    merged.avatarUrl = avatar;
    merged.faceImgUrl = avatar;
  } else {
    ['avatarUrl', 'faceImgUrl', 'headImgUrl', 'photoUrl'].forEach((key) => {
      if (isTemporaryImageUrl(merged[key])) merged[key] = '';
    });
  }

  wx.setStorageSync('userInfo', merged);
  app.globalData.userInfo = merged;
  return merged;
}

function hasLoginSession() {
  const token = wx.getStorageSync('token');
  const userInfo = wx.getStorageSync('userInfo');
  return Boolean(token && userInfo);
}

function formatCategory(category) {
  const value = Number(category);
  if (value === 1) return '水果基地';
  if (value === 2) return '蔬菜基地';
  return '综合基地';
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function safeParseDescription(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(String(value));
  } catch (_) {
    return {};
  }
}

function pickFieldManagerContact(base) {
  const meta = safeParseDescription(base && base.description);
  const fieldManagerContactText = typeof meta.fieldManagerContact === 'string'
    ? meta.fieldManagerContact
    : '';
  const siteManagerContactText = typeof meta.siteManagerContact === 'string'
    ? meta.siteManagerContact
    : '';
  const companyAdminContactText = typeof meta.companyAdminContact === 'string'
    ? meta.companyAdminContact
    : '';
  const candidates = [
    meta.fieldManagerPhone,
    meta.fieldManagerContactPhone,
    fieldManagerContactText,
    meta.fieldManagerContact && meta.fieldManagerContact.phone,
    meta.siteManagerPhone,
    siteManagerContactText,
    meta.siteManagerContact && meta.siteManagerContact.phone,
    companyAdminContactText,
    meta.companyAdminContact && meta.companyAdminContact.phone,
    base && base.fieldManagerPhone,
    base && base.contactPhone,
  ];

  for (let i = 0; i < candidates.length; i += 1) {
    const value = toText(candidates[i]);
    if (value) return value;
  }
  return '待补充';
}

function mapBaseCard(base, index) {
  const createdAt = base.openJobCreatedAt || base.createdAt || base.updatedAt;
  const audited = Number(base.auditStatus) === 1;

  return {
    id: Number(base.id),
    jobId: Number(base.openJobId || 0),
    name: base.openJobTitle || base.baseName || '未命名基地',
    baseName: base.baseName || '未命名基地',
    categoryText: formatCategory(base.category),
    address: base.address || '地址待补充',
    createdAtText: formatDate(createdAt),
    auditText: audited ? '已审核' : '待审核',
    statusText: Number(base.status) === 0 ? '暂停' : '正常',
    fieldManagerContact: pickFieldManagerContact(base),
    salaryRange: base.salaryRange || '500-600元/天',
    animDelay: `${index * 70}ms`,
  };
}

Page({
  data: {
    user: {
      avatar: DEFAULT_AVATAR,
      name: '未登录用户',
      uid: '--',
      verified: true,
    },
    bases: [],
    featuredBase: null,
    loadingBases: false,
    loadError: '',
    applyingBaseId: 0,
  },

  onLoad() {
    if (!this.ensureLoggedIn()) return;
    if (this.redirectIfRoleNotWorker()) return;
    this.initUserInfo();
    this.refreshUserProfile();
    this.loadBaseData();
  },

  onShow() {
    if (!this.ensureLoggedIn()) return;
    if (this.redirectIfRoleNotWorker()) return;

    const tabBar = this.getTabBar && this.getTabBar();
    if (tabBar) tabBar.setData({ selected: 0 });

    this.initUserInfo();
    this.refreshUserProfile();
    this.loadBaseData();
  },

  ensureLoggedIn() {
    if (hasLoginSession()) return true;
    wx.reLaunch({ url: '/pages/login/login' });
    return false;
  },

  initUserInfo() {
    sanitizeAvatarInCache();
    const userInfo = wx.getStorageSync('userInfo') || {};
    this.setData({
      user: {
        avatar: pickAvatar(userInfo),
        name: userInfo.name || '未登录用户',
        uid: userInfo.uid || '--',
        verified: true,
      },
    });
  },


  onAvatarError() {
    sanitizeAvatarInCache();
    this.setData({
      'user.avatar': DEFAULT_AVATAR,
    });
  },

  async refreshUserProfile() {
    const token = wx.getStorageSync('token');
    if (!token) return;

    try {
      const profile = await app.request({
        url: '/user/profile',
        method: 'GET',
      });

      if (!profile) return;
      syncUserInfoCache(profile);
      this.initUserInfo();
    } catch (error) {
      if (error?.statusCode === 401 || /Login expired/i.test(String(error?.message || ''))) {
        return;
      }
      console.error('[index] refresh user profile failed:', error);
    }
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

  async _legacyLoadBaseData() {
    this.setData({
      loadingBases: true,
      loadError: '',
    });

    try {
      const bases = await app.request({
        url: '/base?withOpenJobs=1',
        method: 'GET',
      });

      const baseList = (Array.isArray(bases) ? bases : []).sort((a, b) => {
        const at = new Date(a.createdAt || a.updatedAt || 0).getTime();
        const bt = new Date(b.createdAt || b.updatedAt || 0).getTime();
        return bt - at;
      });

      const baseCards = baseList.slice(0, 10).map((item, index) => mapBaseCard(item, index));

      this.setData({
        bases: baseCards,
        featuredBase: baseCards[0] || null,
        loadingBases: false,
        loadError: baseCards.length ? '' : '暂无可报名岗位',
      });
    } catch (error) {
      console.error('[index] load base data failed:', error);
      const detail = String(error?.message || '').trim();
      this.setData({
        bases: [],
        featuredBase: null,
        loadingBases: false,
        loadError: detail ? `基地信息加载失败：${detail}` : '基地信息加载失败，请稍后再试',
      });
    }
  },

  retryLoadBases() {
    this.loadBaseData();
  },

  async loadBaseData() {
    this.setData({
      loadingBases: true,
      loadError: '',
    });

    try {
      const bases = await app.request({
        url: '/base?withOpenJobs=1',
        method: 'GET',
      });

      const baseList = (Array.isArray(bases) ? bases : []).sort((a, b) => {
        const at = new Date(a.openJobCreatedAt || a.createdAt || a.updatedAt || 0).getTime();
        const bt = new Date(b.openJobCreatedAt || b.createdAt || b.updatedAt || 0).getTime();
        return bt - at;
      });

      const baseCards = baseList.slice(0, 10).map((item, index) => mapBaseCard(item, index));

      this.setData({
        bases: baseCards,
        featuredBase: baseCards[0] || null,
        loadingBases: false,
        loadError: baseCards.length ? '' : '暂无可报名岗位',
      });
    } catch (error) {
      console.error('[index] load base data failed:', error);
      const detail = String(error?.message || '').trim();
      this.setData({
        bases: [],
        featuredBase: null,
        loadingBases: false,
        loadError: detail ? `基地信息加载失败：${detail}` : '基地信息加载失败，请稍后再试',
      });
    }
  },

  goToQrcode() {
    wx.switchTab({ url: '/pages/qrcode/qrcode' });
  },

  goToBaseDetail(e) {
    const baseId = Number(e.currentTarget.dataset.id);
    this.goToBaseDetailById(baseId);
  },

  goToBaseDetailById(baseId) {
    if (!baseId) {
      wx.showToast({
        title: '基地信息无效',
        icon: 'none',
      });
      return;
    }

    wx.navigateTo({
      url: `/pages/base/detail/detail?id=${baseId}`,
    });
  },

  async fetchBaseRecruitingJob(baseId) {
    const targetBaseId = Number(baseId);
    if (!targetBaseId) return null;

    const requests = [
      `/base/${targetBaseId}/jobs?status=1`,
      `/base/${targetBaseId}/jobs`,
    ];

    for (let i = 0; i < requests.length; i += 1) {
      const url = requests[i];
      try {
        const payload = await app.request({ url, method: 'GET' });
        const picked = pickAvailableJob(normalizeList(payload));
        if (picked) return picked;
      } catch (error) {
        console.warn('[index] fetch base jobs failed:', url, error);
      }
    }

    return null;
  },

  buildSignupSuccessUrl(payload = {}) {
    const query = [
      `signupId=${Number(payload.signupId) || 0}`,
      `baseId=${Number(payload.baseId) || 0}`,
      `jobId=${Number(payload.jobId) || 0}`,
      `baseName=${encodeText(payload.baseName)}`,
      `jobTitle=${encodeText(payload.jobTitle)}`,
      `workDate=${encodeText(payload.workDate)}`,
      `duplicate=${payload.duplicate ? '1' : '0'}`,
    ].join('&');

    return `/pages/signup/success/success?${query}`;
  },

  async _legacyApplyForBase(e) {
    const baseId = Number(e.currentTarget.dataset.id);
    if (!baseId) return;

    const token = wx.getStorageSync('token');
    if (!token) {
      wx.showModal({
        title: '提示',
        content: '请先登录后再报名',
        showCancel: false,
        success: () => {
          wx.reLaunch({ url: '/pages/login/login' });
        },
      });
      return;
    }

    if (Number(this.data.applyingBaseId) === baseId) {
      return;
    }

    if (typeof wx.vibrateShort === 'function') {
      wx.vibrateShort({ type: 'light' });
    }

    this.setData({ applyingBaseId: baseId });
    wx.showLoading({
      title: '报名中',
      mask: true,
    });

    try {
      const matchedJob = await this.fetchBaseRecruitingJob(baseId);
      if (!matchedJob) {
        wx.showModal({
          title: '暂不可报名',
          content: '该基地暂未开放可报名岗位，可先查看基地详情。',
          confirmText: '查看详情',
          cancelText: '我知道了',
          success: (res) => {
            if (res.confirm) this.goToBaseDetailById(baseId);
          },
        });
        return;
      }

      const jobId = Number(matchedJob.id);
      const baseCard = (this.data.bases || []).find((item) => Number(item.id) === baseId);
      const baseName = baseCard?.name || matchedJob.baseName || '基地';
      const jobTitle = matchedJob.jobTitle || matchedJob.title || '岗位';

      let duplicate = false;
      let signupRecord = null;
      try {
        signupRecord = await app.request({
          url: '/attendance/signup',
          method: 'POST',
          data: { baseId, jobId },
        });
      } catch (error) {
        if (isDuplicateSignupError(error)) {
          duplicate = true;
        } else {
          throw error;
        }
      }

      wx.navigateTo({
        url: this.buildSignupSuccessUrl({
          signupId: signupRecord?.id || 0,
          baseId,
          jobId,
          baseName,
          jobTitle,
          workDate: signupRecord?.workDate || formatDate(new Date()),
          duplicate,
        }),
      });
    } catch (error) {
      wx.showToast({
        title: error?.message || '报名失败，请稍后重试',
        icon: 'none',
      });
    } finally {
      wx.hideLoading();
      this.setData({ applyingBaseId: 0 });
    }
  },

  goToFeaturedBaseDetail() {
    const baseId = Number(this.data.featuredBase && this.data.featuredBase.id);
    if (!baseId) return;
    wx.navigateTo({
      url: `/pages/base/detail/detail?id=${baseId}`,
    });
  },

  goToJobList() {
    wx.switchTab({ url: '/pages/job/list/list' });
  },

  goToWorkerList() {
    wx.switchTab({ url: '/pages/applications/applications' });
  },

  goToMarket() {
    wx.navigateTo({ url: '/pages/job/list/list?filter=gig' });
  },

  goToPolicyConsult() {
    wx.navigateTo({ url: '/pages/policy/list/list' });
  },

  goToTraining() {
    wx.navigateTo({ url: '/pages/training/list/list' });
  },

  goToRightsProtection() {
    wx.navigateTo({ url: '/pages/rights/consult/consult' });
  },

  goToLaborService() {
    wx.showToast({ title: '功能开发中', icon: 'none' });
  },

  goToMoreServices() {
    wx.showToast({ title: '功能开发中', icon: 'none' });
  },

  goToLaborService() {
    wx.navigateTo({ url: '/pages/profile/signups/signups' });
  },

  goToMoreServices() {
    wx.switchTab({ url: '/pages/applications/applications' });
  },

  async applyForBase(e) {
    const baseId = Number(e.currentTarget.dataset.id);
    if (!baseId) return;

    const token = wx.getStorageSync('token');
    if (!token) {
      wx.showModal({
        title: '提示',
        content: '请先登录后再报名',
        showCancel: false,
        success: () => {
          wx.reLaunch({ url: '/pages/login/login' });
        },
      });
      return;
    }

    if (Number(this.data.applyingBaseId) === baseId) {
      return;
    }

    if (typeof wx.vibrateShort === 'function') {
      wx.vibrateShort({ type: 'light' });
    }

    this.setData({ applyingBaseId: baseId });
    wx.showLoading({
      title: '报名中',
      mask: true,
    });

    try {
      const matchedJob = await this.fetchBaseRecruitingJob(baseId);
      if (!matchedJob) {
        wx.showModal({
          title: '暂不可报名',
          content: '该基地暂未开放可报名岗位，可先查看基地详情。',
          confirmText: '查看详情',
          cancelText: '我知道了',
          success: (res) => {
            if (res.confirm) this.goToBaseDetailById(baseId);
          },
        });
        return;
      }

      const jobId = Number(matchedJob.id);
      const baseCard = (this.data.bases || []).find((item) => Number(item.id) === baseId);
      const baseName = baseCard?.baseName || matchedJob.baseName || '基地';
      const jobTitle = matchedJob.jobTitle || matchedJob.title || '岗位';

      let signupRecord;
      try {
        signupRecord = await app.request({
          url: '/attendance/signup',
          method: 'POST',
          data: {
            baseId,
            jobId,
            note: '广场基地卡片报名',
          },
        });
      } catch (error) {
        const conflictMessage = getConflictMessage(error);
        if (conflictMessage) {
          wx.showModal({
            title: '报名时间冲突',
            content: conflictMessage,
            showCancel: false,
          });
          return;
        }

        if (isDuplicateSignupError(error)) {
          signupRecord = {
            id: 0,
            workDate: formatDate(new Date()),
            duplicate: true,
          };
        } else {
          throw error;
        }
      }

      wx.navigateTo({
        url: this.buildSignupSuccessUrl({
          signupId: signupRecord?.id || 0,
          baseId,
          jobId,
          baseName,
          jobTitle,
          workDate: signupRecord?.workDate || formatDate(new Date()),
          duplicate: Boolean(signupRecord?.duplicate),
        }),
      });
    } catch (error) {
      wx.showToast({
        title: error?.message || '报名失败，请稍后重试',
        icon: 'none',
      });
    } finally {
      wx.hideLoading();
      this.setData({ applyingBaseId: 0 });
    }
  },
});
