/**
 * Layer: Mini Program Page
 * Responsibility: Job list for worker exploration and boss recruitment overview.
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

function normalizeJobItem(job, baseName) {
  const recruitTarget = Number(job && (job.recruitCount || job.headcount || job.count || 0)) || 0;
  const applicantCount = Number(job && job.applicantCount) || 0;
  const cappedApplicant = recruitTarget > 0 ? Math.min(applicantCount, recruitTarget) : applicantCount;
  const signupProgressText = recruitTarget > 0 ? `${cappedApplicant}/${recruitTarget}` : `${applicantCount}/-`;
  const signupProgressPercent = recruitTarget > 0
    ? Math.min(100, Math.round((cappedApplicant / recruitTarget) * 100))
    : 0;

  return Object.assign({}, job, {
    baseName: trimText(baseName || (job && job.baseName) || '-'),
    recruitTarget,
    applicantCount,
    signupProgressText,
    signupProgressPercent,
  });
}

Page({
  data: {
    jobs: [],
    viewJobs: [],
    loading: true,
    baseId: null,
    baseName: '',
    keyword: '',
    statusFilter: 'all',
    openCount: 0,
    closedCount: 0,
    role: 'worker',
    isBossView: false,
  },

  onLoad(options) {
    this.initRoleView();

    if (options.baseId) {
      this.setData({ baseId: parseInt(options.baseId, 10) });
    }

    if (options.baseName) {
      const decodedBaseName = decodeURIComponent(options.baseName);
      this.setData({ baseName: decodedBaseName });
      wx.setNavigationBarTitle({ title: `${decodedBaseName} - 招聘情况` });
    }

    this.loadJobs();
  },

  onShow() {
    this.initRoleView();
    if (this.data.isBossView) {
      const tabBar = this.getTabBar && this.getTabBar();
      if (tabBar) {
        tabBar.setData({ selected: 1 });
      }
    }
  },

  onPullDownRefresh() {
    this.loadJobs();
    setTimeout(() => wx.stopPullDownRefresh(), 1000);
  },

  initRoleView() {
    const userInfo = wx.getStorageSync('userInfo') || {};
    const role = resolveRole(userInfo);
    this.setData({
      role,
      isBossView: role === 'boss',
    });
  },

  isOpenStatus(status) {
    return status === 1 || status === 'recruiting' || status === 'open';
  },

  applyFilters() {
    const allJobs = Array.isArray(this.data.jobs) ? this.data.jobs : [];
    const keyword = (this.data.keyword || '').trim().toLowerCase();
    const statusFilter = this.data.statusFilter;

    const viewJobs = allJobs.filter((item) => {
      const title = (item.jobTitle || item.title || '').toLowerCase();
      const base = (item.baseName || '').toLowerCase();
      const matchKeyword = !keyword || title.includes(keyword) || base.includes(keyword);
      const open = this.isOpenStatus(item.status);
      const matchStatus =
        statusFilter === 'all' ||
        (statusFilter === 'open' && open) ||
        (statusFilter === 'closed' && !open);
      return matchKeyword && matchStatus;
    });

    const openCount = allJobs.filter((item) => this.isOpenStatus(item.status)).length;
    const closedCount = Math.max(0, allJobs.length - openCount);

    this.setData({
      viewJobs,
      openCount,
      closedCount,
    });
  },

  onKeywordInput(e) {
    this.setData({ keyword: e.detail.value || '' }, () => {
      this.applyFilters();
    });
  },

  onStatusChange(e) {
    const status = e.currentTarget.dataset.status || 'all';
    if (status === this.data.statusFilter) return;
    this.setData({ statusFilter: status }, () => {
      this.applyFilters();
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

  async loadJobsForBases(baseList) {
    const list = Array.isArray(baseList) ? baseList : [];
    const jobsByBase = await Promise.all(
      list.map(async (base) => {
        try {
          const jobs = await app.request({
            url: '/base/' + base.id + '/jobs',
            method: 'GET',
          });
          if (!Array.isArray(jobs)) return [];
          const baseName = base.baseName || base.name || '-';
          return jobs.map((job) => normalizeJobItem(job, baseName));
        } catch (_) {
          return [];
        }
      }),
    );

    let merged = [];
    jobsByBase.forEach((jobs) => {
      if (Array.isArray(jobs) && jobs.length) {
        merged = merged.concat(jobs);
      }
    });
    return merged;
  },

  async loadJobs() {
    this.setData({ loading: true });

    try {
      if (!this.data.baseId) {
        const baseList = this.data.isBossView
          ? await this.loadBossBases()
          : await app.request({ url: '/base', method: 'GET' });
        const allJobs = await this.loadJobsForBases(baseList);

        this.setData({ jobs: allJobs, loading: false }, () => {
          this.applyFilters();
        });
      } else {
        const res = await app.request({
          url: '/base/' + this.data.baseId + '/jobs',
          method: 'GET',
        });
        const list = (Array.isArray(res) ? res : []).map((job) => normalizeJobItem(job, this.data.baseName || job.baseName || '-'));
        this.setData(
          {
            jobs: list,
            loading: false,
          },
          () => {
            this.applyFilters();
          },
        );
      }
    } catch (err) {
      console.error('加载岗位列表失败:', err);
      wx.showToast({ title: '加载失败', icon: 'none' });
      this.setData({ loading: false });
    }
  },

  goToDetail(e) {
    const jobId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: '/pages/job/detail/detail?id=' + jobId,
    });
  },

  applyJob(e) {
    const jobId = e.currentTarget.dataset.id;
    const baseId = e.currentTarget.dataset.baseid;

    if (this.data.isBossView) {
      wx.navigateTo({
        url: '/pages/job/detail/detail?id=' + jobId,
      });
      return;
    }

    wx.navigateTo({
      url: '/pages/signup/signup?jobId=' + jobId + '&baseId=' + (baseId || this.data.baseId || ''),
    });
  },
});
