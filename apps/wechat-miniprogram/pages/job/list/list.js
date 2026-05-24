const app = getApp();
const { resolveRole } = require('../../../utils/role');

const BASE_AUDIT_APPROVED = 1;
const PAY_MODE_OPTIONS = ['daily', 'piece', 'monthly'];
const DEFAULT_WORK_HOURS = '08:00-17:00';

function toText(value, fallback = '') {
  const text = String(value == null ? '' : value).trim();
  return text || fallback;
}

function toArray(value) {
  if (Array.isArray(value)) return value;
  if (value && Array.isArray(value.list)) return value.list;
  return [];
}

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function normalizeInt(value, fallback = 0) {
  const num = Math.floor(Number(value));
  if (!Number.isFinite(num) || num <= 0) return fallback;
  return num;
}

function normalizeAmount(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return null;
  return Number(num.toFixed(2));
}

function moneyText(value) {
  return toNumber(value, 0).toFixed(2);
}

function todayString() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDateText(value) {
  const text = toText(value);
  if (!text) return '-';
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text.slice(0, 10);
  return date.toISOString().slice(0, 10);
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

function isOpenStatus(status) {
  const text = String(status || '').toLowerCase();
  return status === 1 || text === '1' || text === 'open' || text === 'recruiting';
}

function auditText(status) {
  const code = Number(status);
  if (code === 1) return '已通过';
  if (code === 2) return '已驳回';
  return '待审核';
}

function statusText(status) {
  return isOpenStatus(status) ? '招聘中' : '已关闭';
}

function statusClass(status) {
  return isOpenStatus(status) ? 'status-open' : 'status-closed';
}

function payModeText(payType, workCycle) {
  if (Number(payType) === 3) return '计件';
  if (Number(workCycle) === 3) return '按月';
  return '日结';
}

function salaryText(job) {
  const payType = Number(job?.payType ?? job?.pay_type);
  const workCycle = Number(job?.workCycle ?? job?.work_cycle);
  const salaryAmount = job?.salaryAmount ?? job?.salary_amount;
  const hourlyRate = job?.hourlyRate ?? job?.hourly_rate;
  const unitPrice = job?.unitPrice ?? job?.unit_price;

  if (payType === 3) return `${moneyText(unitPrice)} 元/件`;
  if (payType === 2) return `${moneyText(hourlyRate)} 元/小时`;
  if (workCycle === 3) return `${moneyText(salaryAmount)} 元/月`;
  if (payType === 1) return `${moneyText(salaryAmount)} 元/天`;
  return '面议';
}

function amountLabel(mode) {
  if (mode === 'piece') return '计件单价（元/件）';
  if (mode === 'monthly') return '按月工资（元/月）';
  return '日结工资（元/天）';
}

function defaultForm(address) {
  const today = todayString();
  return {
    jobTitle: '',
    workAddress: toText(address),
    recruitCount: 10,
    salaryMode: 'daily',
    amount: '',
    workHours: DEFAULT_WORK_HOURS,
    workStartDate: today,
    workEndDate: today,
    requirements: '',
    workContent: '',
    workEnvImages: [],
  };
}

function normalizeBase(raw) {
  const item = raw || {};
  const currentAudit = Number(item.auditStatus || item.audit_status || 0);
  return {
    ...item,
    id: Number(item.id || 0),
    baseName: toText(item.baseName || item.base_name, '未命名基地'),
    address: toText(item.address, '地址待补充'),
    auditStatus: currentAudit,
    auditText: auditText(currentAudit),
    totalJobs: 0,
    openJobs: 0,
    closedJobs: 0,
  };
}

function normalizeJob(raw, fallbackBase) {
  const item = raw || {};
  const base = fallbackBase || {};
  const startDate = formatDateText(item.workStartDate || item.work_start_date);
  const endDate = formatDateText(item.workEndDate || item.work_end_date);
  return {
    ...item,
    id: Number(item.id || 0),
    baseId: Number(item.baseId || item.base_id || base.id || 0),
    baseName: toText(item.baseName || item.base_name || base.baseName, '未命名基地'),
    workAddress: toText(item.workAddress || item.work_address || base.address),
    jobTitle: toText(item.jobTitle || item.job_title, '未命名岗位'),
    recruitCount: normalizeInt(item.recruitCount || item.recruit_count, 0),
    applicantCount: normalizeInt(item.applicantCount || item.applicant_count, 0),
    workDateRange: `${startDate} ~ ${endDate}`,
    payModeText: payModeText(item.payType || item.pay_type, item.workCycle || item.work_cycle),
    salaryText: salaryText(item),
    statusText: statusText(item.status),
    statusClass: statusClass(item.status),
  };
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

function dedupeBases(baseRows) {
  const map = new Map();
  toArray(baseRows).forEach((row) => {
    const base = normalizeBase(row);
    if (base.id && !map.has(base.id)) map.set(base.id, base);
  });
  return Array.from(map.values());
}

Page({
  data: {
    role: 'worker',
    isBossView: false,

    loading: true,
    loadError: '',
    keyword: '',
    statusFilter: 'all',

    baseId: 0,
    baseName: '',
    currentBase: null,
    lockUI: false,
    lockReason: '',
    hasShownLockTip: false,

    jobs: [],
    viewJobs: [],
    openCount: 0,
    closedCount: 0,

    bossBases: [],
    viewBossBases: [],
    approvedBaseCount: 0,
    pendingBaseCount: 0,

    amountLabel: amountLabel('daily'),
    form: defaultForm(''),
    submitting: false,
    uploadingImages: false,
  },

  onLoad(options) {
    this.syncRole();
    const baseId = Number(options?.baseId || options?.id || 0);
    const baseName = toText(options?.baseName ? decodeURIComponent(options.baseName) : '');
    if (baseId > 0) this.setData({ baseId, baseName });
    this.updateTitle();
    this.loadPageData();
  },

  onShow() {
    this.syncRole();
    this.updateTitle();
    if (this.data.isBossView) {
      const tabBar = this.getTabBar && this.getTabBar();
      if (tabBar) tabBar.setData({ selected: 1 });
    }
  },

  onPullDownRefresh() {
    this.loadPageData().finally(() => wx.stopPullDownRefresh());
  },

  syncRole() {
    const userInfo = wx.getStorageSync('userInfo') || {};
    const role = resolveRole(userInfo);
    this.setData({ role, isBossView: role === 'boss' });
  },

  updateTitle() {
    if (!this.data.isBossView) {
      wx.setNavigationBarTitle({ title: '岗位广场' });
      return;
    }
    if (this.data.baseId > 0) {
      const name = toText(this.data.baseName || this.data.currentBase?.baseName, '当前基地');
      wx.setNavigationBarTitle({ title: `${name} 岗位发布` });
      return;
    }
    wx.setNavigationBarTitle({ title: '我的发布岗位' });
  },

  async loadPageData() {
    this.setData({ loading: true, loadError: '' });
    try {
      if (this.data.isBossView) {
        if (this.data.baseId > 0) await this.loadBossBaseJobs();
        else await this.loadBossBaseList();
      } else {
        await this.loadWorkerJobs();
      }
    } catch (error) {
      this.setData({ loadError: error?.message || '页面加载失败，请稍后重试' });
    } finally {
      this.setData({ loading: false });
    }
  },

  async loadBossBasesRaw() {
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
    return toArray(allBases).filter((row) => isBossRelatedBase(row, bossIdentity));
  },

  async loadBossBaseList() {
    const baseRows = dedupeBases(await this.loadBossBasesRaw());
    const enriched = await Promise.all(
      baseRows.map(async (base) => {
        const jobsRes = await app.request({ url: `/base/${base.id}/jobs?showAll=1`, method: 'GET' }).catch(() => []);
        const jobs = toArray(jobsRes);
        const openJobs = jobs.filter((row) => isOpenStatus(row.status)).length;
        return {
          ...base,
          totalJobs: jobs.length,
          openJobs,
          closedJobs: Math.max(0, jobs.length - openJobs),
        };
      }),
    );

    const approvedBaseCount = enriched.filter((base) => Number(base.auditStatus) === BASE_AUDIT_APPROVED).length;
    this.setData({
      currentBase: null,
      lockUI: false,
      lockReason: '',
      hasShownLockTip: false,
      bossBases: enriched,
      approvedBaseCount,
      pendingBaseCount: Math.max(0, enriched.length - approvedBaseCount),
      jobs: [],
      viewJobs: [],
      openCount: 0,
      closedCount: 0,
      amountLabel: amountLabel('daily'),
      form: defaultForm(''),
    });
    this.applyBossBaseFilters();
  },

  async loadBossBaseJobs() {
    const baseId = Number(this.data.baseId || 0);
    if (!baseId) return;

    const baseRes = await app.request({ url: `/base/${baseId}`, method: 'GET' });
    const base = normalizeBase(baseRes);
    const jobsRes = await app.request({ url: `/base/${baseId}/jobs?showAll=1`, method: 'GET' }).catch(() => []);
    const jobs = toArray(jobsRes).map((row) => normalizeJob(row, base));

    const lockUI = Number(base.auditStatus) !== BASE_AUDIT_APPROVED;
    const lockReason = lockUI ? '当前基地入驻审核未通过，岗位发布已锁定。' : '';

    this.setData({
      currentBase: base,
      baseName: base.baseName,
      jobs,
      lockUI,
      lockReason,
      hasShownLockTip: false,
      amountLabel: amountLabel('daily'),
      form: defaultForm(base.address),
    });
    this.applyJobFilters();
    this.updateTitle();
    this.showLockTipOnce();
  },

  async loadWorkerJobs() {
    const selectedBaseId = Number(this.data.baseId || 0);
    let jobs = [];

    if (selectedBaseId > 0) {
      const jobsRes = await app.request({ url: `/base/${selectedBaseId}/jobs?status=1`, method: 'GET' }).catch(() => []);
      jobs = toArray(jobsRes).map((row) => normalizeJob(row, { id: selectedBaseId, baseName: this.data.baseName }));
    } else {
      const basesRes = await app.request({ url: '/base?withOpenJobs=1', method: 'GET' }).catch(() => []);
      const bases = dedupeBases(basesRes);
      const merged = await Promise.all(
        bases.map(async (base) => {
          const jobsRes = await app.request({ url: `/base/${base.id}/jobs?status=1`, method: 'GET' }).catch(() => []);
          return toArray(jobsRes).map((row) => normalizeJob(row, base));
        }),
      );
      jobs = merged.flat();
    }

    this.setData({ jobs });
    this.applyJobFilters();
  },

  showLockTipOnce() {
    if (!this.data.lockUI || this.data.hasShownLockTip) return;
    this.setData({ hasShownLockTip: true });
    wx.showModal({
      title: '基地未审核通过',
      content: this.data.lockReason || '请先完成企业入驻审核，审核通过后才能发布岗位。',
      showCancel: false,
    });
  },

  applyBossBaseFilters() {
    const keyword = toText(this.data.keyword).toLowerCase();
    const list = toArray(this.data.bossBases);
    const viewBossBases = list.filter((base) => {
      if (!keyword) return true;
      return toText(base.baseName).toLowerCase().includes(keyword) || toText(base.address).toLowerCase().includes(keyword);
    });
    this.setData({ viewBossBases });
  },

  applyJobFilters() {
    const keyword = toText(this.data.keyword).toLowerCase();
    const filter = this.data.statusFilter;
    const jobs = toArray(this.data.jobs);

    const viewJobs = jobs.filter((job) => {
      const text = [job.jobTitle, job.baseName, job.workAddress].join(' ').toLowerCase();
      const keywordHit = !keyword || text.includes(keyword);
      const open = isOpenStatus(job.status);
      const statusHit = filter === 'all' || (filter === 'open' && open) || (filter === 'closed' && !open);
      return keywordHit && statusHit;
    });

    const openCount = jobs.filter((row) => isOpenStatus(row.status)).length;
    this.setData({
      viewJobs,
      openCount,
      closedCount: Math.max(0, jobs.length - openCount),
    });
  },

  onKeywordInput(e) {
    const keyword = e.detail?.value || '';
    this.setData({ keyword }, () => {
      if (this.data.isBossView && !this.data.baseId) this.applyBossBaseFilters();
      else this.applyJobFilters();
    });
  },

  onStatusChange(e) {
    const statusFilter = e.currentTarget.dataset.status || 'all';
    if (statusFilter === this.data.statusFilter) return;
    this.setData({ statusFilter }, () => this.applyJobFilters());
  },

  goToBasePublish(e) {
    const baseId = Number(e.currentTarget.dataset.id || 0);
    if (!baseId) return;
    const selected = toArray(this.data.bossBases).find((base) => Number(base.id) === baseId);
    this.setData({
      baseId,
      baseName: toText(selected?.baseName),
      keyword: '',
      statusFilter: 'all',
      loadError: '',
    }, () => {
      this.updateTitle();
      this.loadPageData();
    });
  },

  backToBaseSelector() {
    this.setData({
      baseId: 0,
      baseName: '',
      currentBase: null,
      keyword: '',
      statusFilter: 'all',
      loadError: '',
    }, () => {
      this.updateTitle();
      this.loadPageData();
    });
  },

  goToAuditPage() {
    wx.switchTab({ url: '/pages/boss/dashboard/dashboard' });
  },

  onFormInput(e) {
    const field = e.currentTarget.dataset.field;
    if (!field) return;
    this.setData({ [`form.${field}`]: e.detail?.value || '' });
  },

  onFormDateChange(e) {
    const field = e.currentTarget.dataset.field;
    if (!field) return;
    this.setData({ [`form.${field}`]: e.detail?.value || todayString() });
  },

  onRecruitCountStep(e) {
    const delta = Number(e.currentTarget.dataset.delta || 0);
    if (!delta) return;
    const current = normalizeInt(this.data.form.recruitCount, 1);
    const next = Math.min(999, Math.max(1, current + delta));
    this.setData({ 'form.recruitCount': next });
  },

  onSalaryModeChange(e) {
    const mode = e.currentTarget.dataset.mode || 'daily';
    if (!PAY_MODE_OPTIONS.includes(mode)) return;
    this.setData({
      'form.salaryMode': mode,
      amountLabel: amountLabel(mode),
    });
  },

  chooseEnvImages() {
    if (this.data.lockUI || this.data.submitting || this.data.uploadingImages) return;
    const current = toArray(this.data.form.workEnvImages);
    const remain = Math.max(0, 3 - current.length);
    if (!remain) return;

    wx.chooseMedia({
      count: remain,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const selected = toArray(res?.tempFiles).map((item) => toText(item?.tempFilePath)).filter(Boolean);
        this.setData({
          'form.workEnvImages': current.concat(selected).slice(0, 3),
        });
      },
    });
  },

  removeEnvImage(e) {
    const index = Number(e.currentTarget.dataset.index);
    if (!Number.isFinite(index)) return;
    const next = toArray(this.data.form.workEnvImages).filter((_, i) => i !== index);
    this.setData({ 'form.workEnvImages': next });
  },

  validatePublishForm() {
    if (!this.data.baseId) return '请先选择基地';
    if (this.data.lockUI) return '基地未审核通过，暂不可发布岗位';

    const form = this.data.form || {};
    const jobTitle = toText(form.jobTitle);
    const workAddress = toText(form.workAddress);
    const recruitCount = normalizeInt(form.recruitCount, 0);
    const amount = normalizeAmount(form.amount);
    const workHours = toText(form.workHours);
    const workStartDate = toText(form.workStartDate);
    const workEndDate = toText(form.workEndDate);
    const requirements = toText(form.requirements);
    const workContent = toText(form.workContent);

    if (!jobTitle) return '请填写岗位名称';
    if (!workAddress) return '请填写工作地址';
    if (recruitCount <= 0) return '请填写需要人数';
    if (amount == null) return '请填写有效工资金额';
    if (!workStartDate || !workEndDate) return '请选择开始和结束日期';
    if (workStartDate > workEndDate) return '开始日期不能晚于结束日期';
    if (!/^\d{1,2}:\d{2}\s*[-~]\s*\d{1,2}:\d{2}$/.test(workHours)) return '工作时间格式示例：08:00-17:00';
    if (!requirements) return '请填写岗位要求';
    if (!workContent) return '请填写岗位描述';
    return '';
  },

  async uploadLocalImagesIfNeeded(images) {
    const source = toArray(images).map((item) => toText(item)).filter(Boolean);
    if (!source.length) return [];

    const remote = [];
    const local = [];
    source.forEach((item) => {
      if (/^https?:\/\//i.test(item) || /^cloud:\/\//i.test(item)) remote.push(item);
      else local.push(item);
    });
    if (!local.length) return remote.slice(0, 3);

    if (!wx.cloud || typeof wx.cloud.uploadFile !== 'function') {
      throw new Error('请先在开发者工具中开启云开发能力');
    }

    this.setData({ uploadingImages: true });
    try {
      const uploaded = [];
      for (let i = 0; i < local.length; i += 1) {
        const filePath = local[i];
        const extMatch = filePath.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
        const ext = extMatch ? extMatch[1].toLowerCase() : 'jpg';
        const cloudPath = `job-env/${Date.now()}_${Math.random().toString(16).slice(2)}.${ext}`;
        const res = await wx.cloud.uploadFile({ cloudPath, filePath });
        if (res?.fileID) uploaded.push(res.fileID);
      }
      return remote.concat(uploaded).slice(0, 3);
    } finally {
      this.setData({ uploadingImages: false });
    }
  },

  buildPublishPayload(imageList) {
    const form = this.data.form || {};
    const mode = form.salaryMode || 'daily';
    const amount = normalizeAmount(form.amount);

    const payload = {
      jobTitle: toText(form.jobTitle),
      workAddress: toText(form.workAddress),
      recruitCount: normalizeInt(form.recruitCount, 1),
      workHours: toText(form.workHours),
      workStartDate: toText(form.workStartDate),
      workEndDate: toText(form.workEndDate),
      validUntil: `${toText(form.workEndDate)} 23:59:59`,
      requirements: toText(form.requirements),
      workContent: toText(form.workContent),
      workplaceImages: toArray(imageList).slice(0, 3),
      benefits: '',
    };

    if (mode === 'piece') {
      payload.payType = 3;
      payload.workCycle = 1;
      payload.unitPrice = amount;
      payload.targetCount = payload.recruitCount;
      return payload;
    }

    payload.payType = 1;
    payload.workCycle = mode === 'monthly' ? 3 : 1;
    payload.salaryAmount = amount;
    return payload;
  },

  async submitPublishJob() {
    if (this.data.submitting) return;
    const checkMessage = this.validatePublishForm();
    if (checkMessage) {
      wx.showToast({ title: checkMessage, icon: 'none' });
      return;
    }

    this.setData({ submitting: true });
    wx.showLoading({ title: '提交中...', mask: true });
    try {
      const images = await this.uploadLocalImagesIfNeeded(this.data.form.workEnvImages);
      const payload = this.buildPublishPayload(images);
      await app.request({
        url: `/base/${Number(this.data.baseId)}/jobs`,
        method: 'POST',
        data: payload,
      });

      const keepAddress = toText(this.data.form.workAddress);
      this.setData({
        form: defaultForm(keepAddress),
        amountLabel: amountLabel('daily'),
      });

      wx.showToast({ title: '岗位已提交审核', icon: 'success' });
      await this.loadBossBaseJobs();
    } catch (error) {
      wx.showToast({ title: error?.message || '提交失败，请稍后重试', icon: 'none' });
    } finally {
      wx.hideLoading();
      this.setData({ submitting: false });
    }
  },

  goToDetail(e) {
    const jobId = Number(e.currentTarget.dataset.id || 0);
    const baseId = Number(e.currentTarget.dataset.baseid || this.data.baseId || 0);
    if (!jobId || !baseId) return;
    wx.navigateTo({ url: `/pages/job/detail/detail?id=${jobId}&baseId=${baseId}` });
  },

  goToBossDashboard() {
    wx.navigateTo({ url: '/pages/boss/dashboard/dashboard' });
  },

  goToBossBaseList() {
    wx.navigateTo({ url: '/pages/base/list/list' });
  },

  goToBossProfile() {
    wx.navigateTo({ url: '/pages/boss/profile/profile' });
  },

  applyJob(e) {
    if (this.data.isBossView) return;
    const jobId = Number(e.currentTarget.dataset.id || 0);
    const baseId = Number(e.currentTarget.dataset.baseid || 0);
    if (!jobId || !baseId) {
      wx.showToast({ title: '岗位信息无效', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: `/pages/signup/signup?jobId=${jobId}&baseId=${baseId}` });
  },
});
