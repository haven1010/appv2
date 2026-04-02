// pages/job/list/list.js
const app = getApp();
const { resolveRole } = require('../../../utils/role');
const APPROVED_AUDIT_STATUS = 1;

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

function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value && value.list)) return value.list;
  return [];
}

function normalizeAuditStatusValue(value) {
  if (value === undefined || value === null || value === '') return null;

  const numeric = Number(value);
  if (Number.isFinite(numeric)) return numeric;

  const text = String(value).trim().toLowerCase();
  if (!text) return null;

  if (text.includes('approved') || text.includes('已审核') || text.includes('已通过') || text.includes('通过')) {
    return APPROVED_AUDIT_STATUS;
  }
  if (text.includes('rejected') || text.includes('驳回') || text.includes('拒绝')) {
    return 2;
  }
  if (text.includes('pending') || text.includes('待审核')) {
    return 0;
  }

  return null;
}

function getBaseAuditStatusCode(base) {
  if (!base || typeof base !== 'object') return null;

  const candidates = [
    base.auditStatus,
    base.audit_status,
    base.auditStatusCode,
    base.status,
    base.auditStatusText,
    base.auditText,
    base.auditResult,
    base.audit && base.audit.status,
  ];

  for (let i = 0; i < candidates.length; i += 1) {
    const normalized = normalizeAuditStatusValue(candidates[i]);
    if (normalized !== null) return normalized;
  }

  return null;
}

function isBaseApproved(base) {
  return getBaseAuditStatusCode(base) === APPROVED_AUDIT_STATUS;
}

function mapBaseAuditText(base) {
  const status = getBaseAuditStatusCode(base);
  if (status === 1) return '已审核';
  if (status === 2) return '已驳回';
  return '待审核';
}

function toJobId(value) {
  const normalized = Number(value);
  if (!normalized) return '';
  return String(normalized);
}

function pickApplicantName(row) {
  const user = row && typeof row.user === 'object' ? row.user : {};
  const applicant = row && typeof row.applicant === 'object' ? row.applicant : {};
  return trimText(user.name || row.workerName || applicant.name || '');
}

function buildApplicantNamesByJob(applications) {
  const mapping = {};
  const list = normalizeArray(applications);

  list.forEach((item) => {
    const jobId = toJobId((item && item.jobId) || (item && item.job && item.job.id));
    const applicantName = pickApplicantName(item || {});
    if (!jobId || !applicantName) return;

    if (!Array.isArray(mapping[jobId])) {
      mapping[jobId] = [];
    }

    if (!mapping[jobId].includes(applicantName)) {
      mapping[jobId].push(applicantName);
    }
  });

  return mapping;
}

function isOpenStatusValue(status) {
  return status === 1 || status === 'recruiting' || status === 'open';
}

function normalizeJobItem(job, base, applicantNames) {
  const normalizedApplicantNames = Array.isArray(applicantNames)
    ? applicantNames.filter((item) => trimText(item))
    : [];
  const fallbackApplicantCount = Number(job && job.applicantCount) || 0;
  const applicantCount = Math.max(fallbackApplicantCount, normalizedApplicantNames.length);
  const recruitTarget = Number(job && (job.recruitCount || job.headcount || job.count || 0)) || 0;
  const cappedApplicant = recruitTarget > 0 ? Math.min(applicantCount, recruitTarget) : applicantCount;
  const signupProgressText = recruitTarget > 0 ? `${cappedApplicant}/${recruitTarget}` : `${applicantCount}/-`;
  const signupProgressPercent = recruitTarget > 0
    ? Math.min(100, Math.round((cappedApplicant / recruitTarget) * 100))
    : 0;

  return Object.assign({}, job, {
    baseId: Number((job && job.baseId) || (base && base.id) || 0),
    baseName: trimText((base && (base.baseName || base.name)) || (job && job.baseName) || '-'),
    recruitTarget,
    applicantCount,
    applicantNames: normalizedApplicantNames,
    signupProgressText,
    signupProgressPercent,
  });
}

function buildBossBaseCard(base, jobs) {
  const list = Array.isArray(jobs) ? jobs : [];
  const totalJobs = list.length;
  const openJobs = list.filter((item) => isOpenStatusValue(item && item.status)).length;
  const closedJobs = Math.max(0, totalJobs - openJobs);
  const totalSignupCount = list.reduce((sum, item) => sum + (Number(item && item.applicantCount) || 0), 0);

  const nameMap = {};
  list.forEach((item) => {
    const names = Array.isArray(item && item.applicantNames) ? item.applicantNames : [];
    names.forEach((name) => {
      const normalized = trimText(name);
      if (!normalized) return;
      nameMap[normalized] = true;
    });
  });

  const applicantNames = Object.keys(nameMap);

  return {
    baseId: Number(base && base.id),
    baseName: trimText(base && (base.baseName || base.name) || '未命名基地'),
    address: trimText(base && base.address || '地址待补充'),
    auditText: mapBaseAuditText(base),
    totalJobs,
    openJobs,
    closedJobs,
    totalSignupCount,
    applicantNameCount: applicantNames.length,
    applicantNamesPreview: applicantNames.slice(0, 6),
  };
}

Page({
  data: {
    jobs: [],
    viewJobs: [],
    bossBaseCards: [],
    viewBossBaseCards: [],
    loading: true,
    baseId: null,
    baseName: '',
    keyword: '',
    statusFilter: 'all',
    openCount: 0,
    closedCount: 0,
    totalSignupCount: 0,
    approvedBaseCount: 0,
    pendingApprovalCount: 0,
    canViewSignupProgress: true,
    role: 'worker',
    isBossView: false,
    totalBaseJobCount: 0,
    totalBaseSignupCount: 0,
  },

  onLoad(options) {
    this.initRoleView();

    if (options.baseId) {
      this.setData({ baseId: parseInt(options.baseId, 10) });
    }

    if (options.baseName) {
      this.setData({ baseName: decodeURIComponent(options.baseName) });
    }

    this.updateNavigationTitle();
    this.loadJobs();
  },

  onShow() {
    const userInfo = wx.getStorageSync('userInfo') || {};
    const role = resolveRole(userInfo);
    const isBossView = role === 'boss';
    this.setData({ role, isBossView }, () => {
      this.updateNavigationTitle();

      if (!isBossView) return;

      const tabBar = this.getTabBar && this.getTabBar();
      if (tabBar) {
        tabBar.setData({ selected: 1 });
      }

      this.loadJobs();
    });
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

  isBossRootMode() {
    return this.data.isBossView && !this.data.baseId;
  },

  updateNavigationTitle() {
    if (this.data.isBossView) {
      if (this.data.baseId) {
        const name = trimText(this.data.baseName);
        wx.setNavigationBarTitle({ title: name ? `${name}报名进度` : '报名进度详情' });
      } else {
        wx.setNavigationBarTitle({ title: '报名进度' });
      }
      return;
    }

    if (this.data.baseId) {
      const name = trimText(this.data.baseName);
      wx.setNavigationBarTitle({ title: name ? `${name}招聘情况` : '招聘情况' });
      return;
    }

    wx.setNavigationBarTitle({ title: '招聘管理' });
  },

  isOpenStatus(status) {
    return isOpenStatusValue(status);
  },

  applyBaseFilters() {
    const all = Array.isArray(this.data.bossBaseCards) ? this.data.bossBaseCards : [];
    const keyword = trimText(this.data.keyword).toLowerCase();

    const viewBossBaseCards = all.filter((item) => {
      if (!keyword) return true;
      const name = trimText(item.baseName).toLowerCase();
      const address = trimText(item.address).toLowerCase();
      const applicants = (Array.isArray(item.applicantNamesPreview) ? item.applicantNamesPreview.join(' ') : '').toLowerCase();
      return name.includes(keyword) || address.includes(keyword) || applicants.includes(keyword);
    });

    this.setData({ viewBossBaseCards });
  },

  applyFilters() {
    if (this.isBossRootMode()) {
      this.applyBaseFilters();
      return;
    }

    const allJobs = Array.isArray(this.data.jobs) ? this.data.jobs : [];
    const keyword = trimText(this.data.keyword).toLowerCase();
    const statusFilter = this.data.statusFilter;
    const isBossView = this.data.isBossView;

    const viewJobs = allJobs.filter((item) => {
      const title = trimText(item.jobTitle || item.title).toLowerCase();
      const base = trimText(item.baseName).toLowerCase();
      const applicants = Array.isArray(item.applicantNames)
        ? item.applicantNames.join(' ').toLowerCase()
        : '';
      const matchKeyword = !keyword || title.includes(keyword) || base.includes(keyword) || (isBossView && applicants.includes(keyword));
      const open = this.isOpenStatus(item.status);
      const matchStatus =
        statusFilter === 'all' ||
        (statusFilter === 'open' && open) ||
        (statusFilter === 'closed' && !open);
      return matchKeyword && matchStatus;
    });

    const openCount = allJobs.filter((item) => this.isOpenStatus(item.status)).length;
    const closedCount = Math.max(0, allJobs.length - openCount);
    const totalSignupCount = allJobs.reduce((sum, item) => sum + (Number(item.applicantCount) || 0), 0);

    this.setData({
      viewJobs,
      openCount,
      closedCount,
      totalSignupCount,
    });
  },

  onKeywordInput(e) {
    this.setData({ keyword: e.detail.value || '' }, () => {
      this.applyFilters();
    });
  },

  onStatusChange(e) {
    if (this.isBossRootMode()) return;

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

  async loadJobsForBases(baseList, withApplicants = false) {
    const list = Array.isArray(baseList) ? baseList : [];
    const jobsByBase = await Promise.all(
      list.map(async (base) => {
        try {
          const [jobsRes, appsRes] = await Promise.all([
            app.request({
              url: `/base/${base.id}/jobs`,
              method: 'GET',
            }).catch(() => []),
            withApplicants
              ? app.request({
                  url: `/base/${base.id}/applications`,
                  method: 'GET',
                }).catch(() => [])
              : Promise.resolve([]),
          ]);

          const jobs = normalizeArray(jobsRes);
          if (!jobs.length) return [];

          const applicantNamesByJob = withApplicants ? buildApplicantNamesByJob(appsRes) : {};
          return jobs.map((job) => {
            const jobId = toJobId(job && job.id);
            const applicantNames = jobId ? applicantNamesByJob[jobId] || [] : [];
            return normalizeJobItem(job, base, applicantNames);
          });
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
    const loadToken = (this._loadJobsToken || 0) + 1;
    this._loadJobsToken = loadToken;

    const isLatest = () => loadToken === this._loadJobsToken;
    const safeSetData = (payload, callback) => {
      if (!isLatest()) return false;
      this.setData(payload, callback);
      return true;
    };

    safeSetData({ loading: true });

    try {
      if (!this.data.baseId) {
        if (this.data.isBossView) {
          const baseList = await this.loadBossBases();
          if (!isLatest()) return;

          const normalizedBaseList = normalizeArray(baseList);
          let approvedBases = normalizedBaseList.filter((item) => isBaseApproved(item));

          if (!approvedBases.length && normalizedBaseList.length) {
            const unknownAuditBases = normalizedBaseList.filter((item) => getBaseAuditStatusCode(item) === null);
            if (unknownAuditBases.length === normalizedBaseList.length) {
              approvedBases = unknownAuditBases;
            }
          }

          const pendingApprovalCount = Math.max(0, normalizedBaseList.length - approvedBases.length);

          if (!approvedBases.length) {
            safeSetData({
              jobs: [],
              viewJobs: [],
              bossBaseCards: [],
              viewBossBaseCards: [],
              loading: false,
              openCount: 0,
              closedCount: 0,
              totalSignupCount: 0,
              approvedBaseCount: 0,
              pendingApprovalCount,
              canViewSignupProgress: false,
              totalBaseJobCount: 0,
              totalBaseSignupCount: 0,
            });
            return;
          }

          const allJobs = await this.loadJobsForBases(approvedBases, true);
          if (!isLatest()) return;

          const jobsByBaseId = {};
          allJobs.forEach((item) => {
            const baseId = Number(item && item.baseId);
            if (!baseId) return;
            if (!Array.isArray(jobsByBaseId[baseId])) {
              jobsByBaseId[baseId] = [];
            }
            jobsByBaseId[baseId].push(item);
          });

          const bossBaseCards = approvedBases.map((base) => buildBossBaseCard(base, jobsByBaseId[Number(base.id)] || []));
          const totalBaseJobCount = bossBaseCards.reduce((sum, item) => sum + Number(item.totalJobs || 0), 0);
          const totalBaseSignupCount = bossBaseCards.reduce((sum, item) => sum + Number(item.totalSignupCount || 0), 0);

          safeSetData(
            {
              jobs: allJobs,
              viewJobs: [],
              bossBaseCards,
              loading: false,
              approvedBaseCount: approvedBases.length,
              pendingApprovalCount,
              canViewSignupProgress: true,
              totalBaseJobCount,
              totalBaseSignupCount,
              openCount: allJobs.filter((item) => this.isOpenStatus(item.status)).length,
              closedCount: Math.max(0, allJobs.length - allJobs.filter((item) => this.isOpenStatus(item.status)).length),
              totalSignupCount: allJobs.reduce((sum, item) => sum + (Number(item.applicantCount) || 0), 0),
            },
            () => {
              if (!isLatest()) return;
              this.applyBaseFilters();
            },
          );
          return;
        }

        const baseList = await app.request({ url: '/base', method: 'GET' });
        if (!isLatest()) return;
        const allJobs = await this.loadJobsForBases(baseList, false);
        if (!isLatest()) return;
        safeSetData(
          {
            jobs: allJobs,
            bossBaseCards: [],
            viewBossBaseCards: [],
            loading: false,
            approvedBaseCount: 0,
            pendingApprovalCount: 0,
            canViewSignupProgress: true,
            totalBaseJobCount: 0,
            totalBaseSignupCount: 0,
          },
          () => {
            if (!isLatest()) return;
            this.applyFilters();
          },
        );
        return;
      }

      if (this.data.isBossView) {
        const baseRes = await app.request({
          url: `/base/${this.data.baseId}`,
          method: 'GET',
        }).catch(() => null);
        if (!isLatest()) return;

        const auditStatus = getBaseAuditStatusCode(baseRes);
        if (auditStatus !== null && auditStatus !== APPROVED_AUDIT_STATUS) {
          safeSetData({
            jobs: [],
            viewJobs: [],
            bossBaseCards: [],
            viewBossBaseCards: [],
            loading: false,
            openCount: 0,
            closedCount: 0,
            totalSignupCount: 0,
            approvedBaseCount: 0,
            pendingApprovalCount: 1,
            canViewSignupProgress: false,
            totalBaseJobCount: 0,
            totalBaseSignupCount: 0,
          });
          return;
        }

        const baseName = (baseRes && (baseRes.baseName || baseRes.name)) || this.data.baseName || '-';
        if (baseName && baseName !== this.data.baseName) {
          this.setData({ baseName });
          this.updateNavigationTitle();
        }

        const list = await this.loadJobsForBases(
          [{ id: this.data.baseId, baseName }],
          true,
        );
        if (!isLatest()) return;
        safeSetData(
          {
            jobs: list,
            bossBaseCards: [],
            viewBossBaseCards: [],
            loading: false,
            approvedBaseCount: 1,
            pendingApprovalCount: 0,
            canViewSignupProgress: true,
            totalBaseJobCount: 0,
            totalBaseSignupCount: 0,
          },
          () => {
            if (!isLatest()) return;
            this.applyFilters();
          },
        );
        return;
      }

      const res = await app.request({
        url: `/base/${this.data.baseId}/jobs`,
        method: 'GET',
      });
      if (!isLatest()) return;
      const list = normalizeArray(res).map((job) => normalizeJobItem(job, { id: this.data.baseId, baseName: this.data.baseName || job.baseName || '-' }, []));
      safeSetData(
        {
          jobs: list,
          bossBaseCards: [],
          viewBossBaseCards: [],
          loading: false,
          approvedBaseCount: 0,
          pendingApprovalCount: 0,
          canViewSignupProgress: true,
          totalBaseJobCount: 0,
          totalBaseSignupCount: 0,
        },
        () => {
          if (!isLatest()) return;
          this.applyFilters();
        },
      );
    } catch (err) {
      if (!isLatest()) return;
      console.error('加载岗位列表失败:', err);
      wx.showToast({ title: '加载失败', icon: 'none' });
      safeSetData({ loading: false });
    }
  },

  goToBaseProgress(e) {
    if (!this.isBossRootMode()) return;

    const baseId = Number(e.currentTarget.dataset.id);
    const baseName = trimText(e.currentTarget.dataset.name || '');
    if (!baseId) {
      wx.showToast({ title: '基地信息无效', icon: 'none' });
      return;
    }

    this.setData({
      baseId,
      baseName,
      keyword: '',
      statusFilter: 'all',
      jobs: [],
      viewJobs: [],
      openCount: 0,
      closedCount: 0,
      totalSignupCount: 0,
    }, () => {
      this.updateNavigationTitle();
      this.loadJobs();
    });
  },

  backToBossBaseCards() {
    if (!this.data.isBossView || !this.data.baseId) return;

    this.setData({
      baseId: null,
      baseName: '',
      keyword: '',
      statusFilter: 'all',
      jobs: [],
      viewJobs: [],
      openCount: 0,
      closedCount: 0,
      totalSignupCount: 0,
      canViewSignupProgress: true,
    }, () => {
      this.updateNavigationTitle();
      this.loadJobs();
    });
  },

  goToDetail(e) {
    if (this.data.isBossView) return;
    const jobId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/job/detail/detail?id=${jobId}`,
    });
  },

  applyJob(e) {
    const jobId = e.currentTarget.dataset.id;
    const baseId = e.currentTarget.dataset.baseid;

    if (this.data.isBossView) {
      return;
    }

    wx.navigateTo({
      url: `/pages/signup/signup?jobId=${jobId}&baseId=${baseId || this.data.baseId || ''}`,
    });
  },
});
