const app = getApp();
const { resolveRole } = require('../../../utils/role');

function toText(value, fallback = '') {
  const text = value == null ? '' : String(value).trim();
  return text || fallback;
}

function toArray(value) {
  if (Array.isArray(value)) return value;
  if (value && Array.isArray(value.list)) return value.list;
  return [];
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

function mapCategoryLabel(category) {
  const code = Number(category);
  if (code === 1) return '水果种植';
  if (code === 2) return '蔬菜种植';
  return '其他农业';
}

function mapAuditLabel(auditStatus) {
  const code = Number(auditStatus);
  if (code === 1) return '已审核';
  if (code === 2) return '已驳回';
  return '待审核';
}

function mapJobStatusText(status) {
  const text = String(status || '').toLowerCase();
  if (status === 1 || text === '1' || text === 'recruiting' || text === 'open') return '招聘中';
  return '已关闭';
}

function mapJobStatusClass(status) {
  const text = String(status || '').toLowerCase();
  if (status === 1 || text === '1' || text === 'recruiting' || text === 'open') return 'open';
  return 'closed';
}

function toMoneyText(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '0.00';
  return num.toFixed(2);
}

function toDateText(value) {
  const raw = toText(value);
  if (!raw) return '-';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw.slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function toTimestamp(value) {
  const raw = toText(value);
  if (!raw) return 0;
  const ts = new Date(raw).getTime();
  return Number.isFinite(ts) ? ts : 0;
}

function isHttpUrl(value) {
  return /^https?:\/\//i.test(toText(value));
}

function isDevtoolsTmpUrl(value) {
  return /^https?:\/\/127\.0\.0\.1:\d+\/__tmp__\//i.test(toText(value));
}

function normalizePersistedImageUrl(value) {
  const text = toText(value);
  if (!text) return '';
  if (isDevtoolsTmpUrl(text)) return '';
  if (/^wxfile:\/\//i.test(text)) return '';
  if (/^[a-zA-Z]:\\/.test(text)) return '';
  if (/^file:\/\//i.test(text)) return '';
  if (/^cloud:\/\//i.test(text)) return text;
  if (text.startsWith('//')) return `https:${text}`;
  if (!isHttpUrl(text)) return '';
  return text;
}

function parseImageCollection(value) {
  if (Array.isArray(value)) return value.map((item) => toText(item)).filter(Boolean);
  const text = toText(value);
  if (!text) return [];
  if (text.startsWith('[') || text.startsWith('{')) {
    try {
      return parseImageCollection(JSON.parse(text));
    } catch (_) {
      return [];
    }
  }
  if (!/[,\n\r;，；]/.test(text)) return [text];
  return text.split(/[,\n\r;，；]+/).map((item) => toText(item)).filter(Boolean);
}

function mapSalaryStatus(status) {
  const code = Number(status);
  if (code === 2) return { text: '已结算', className: 'paid' };
  if (code === 1) return { text: '待老板结算', className: 'confirm' };
  return { text: '待工人确认', className: 'pending' };
}

function extractErrorMessage(err, fallback = '加载失败，请稍后重试') {
  const messageFromResponse = Array.isArray(err?.response?.message)
    ? err.response.message.join(' / ')
    : err?.response?.message || err?.response?.msg || '';
  const candidates = [err?.message, err?.errMsg, messageFromResponse];
  for (let i = 0; i < candidates.length; i += 1) {
    const text = toText(candidates[i]);
    if (text) return text;
  }
  return fallback;
}

function buildProgressRows(jobsRes, applicationsRes) {
  const jobList = toArray(jobsRes);
  const appList = toArray(applicationsRes);
  const applicantNamesByJob = {};

  appList.forEach((item) => {
    const jobId = Number(item?.jobId || item?.job?.id || 0);
    const userName = toText(item?.user?.name || item?.applicant?.name || item?.workerName);
    if (!jobId || !userName) return;
    if (!Array.isArray(applicantNamesByJob[jobId])) applicantNamesByJob[jobId] = [];
    if (!applicantNamesByJob[jobId].includes(userName)) applicantNamesByJob[jobId].push(userName);
  });

  const rows = jobList.map((job) => {
    const id = Number(job?.id || 0);
    const applicantNames = applicantNamesByJob[id] || [];
    const recruitCount = Number(job?.recruitCount || job?.headcount || job?.count || 0) || 0;
    const applicantCount = Math.max(Number(job?.applicantCount || 0) || 0, applicantNames.length);
    return {
      id,
      jobTitle: toText(job?.jobTitle || job?.title, '未命名岗位'),
      recruitCount,
      applicantCount,
      statusText: mapJobStatusText(job?.status),
      statusClass: mapJobStatusClass(job?.status),
      workDateRange: `${toDateText(job?.workStartDate || job?.work_start_date)} ~ ${toDateText(job?.workEndDate || job?.work_end_date)}`,
      applicantNames,
    };
  });

  const openJobs = rows.filter((item) => item.statusClass === 'open').length;
  const totalApplicants = rows.reduce((sum, item) => sum + Number(item.applicantCount || 0), 0);
  return {
    rows,
    summary: {
      totalJobs: rows.length,
      openJobs,
      closedJobs: Math.max(0, rows.length - openJobs),
      totalApplicants,
    },
  };
}

function buildPayrollRows(rawRows) {
  const rows = toArray(rawRows);
  const grouped = {};

  rows.forEach((item) => {
    const workerName = toText(item?.workerName, '未实名采摘工');
    const workerUid = toText(item?.workerUid);
    const workerPhone = toText(item?.workerPhone);
    const key = workerUid || workerPhone || workerName;
    if (!key) return;

    const amount = Number(item?.totalAmount) || 0;
    const status = Number(item?.status);
    const currentTs = Math.max(toTimestamp(item?.createdAt), toTimestamp(item?.workDate), 0);

    if (!grouped[key]) {
      grouped[key] = {
        key,
        workerName,
        workerUid: workerUid || '-',
        totalAmount: 0,
        paidAmount: 0,
        pendingAmount: 0,
        recordCount: 0,
        latestStatus: status,
        latestTime: currentTs,
        lastWorkDateText: toDateText(item?.workDate),
      };
    }

    const target = grouped[key];
    target.totalAmount += amount;
    target.recordCount += 1;
    if (status === 2) target.paidAmount += amount;
    else target.pendingAmount += amount;

    if (currentTs >= target.latestTime) {
      target.latestTime = currentTs;
      target.latestStatus = status;
      target.lastWorkDateText = toDateText(item?.workDate);
    }
  });

  return Object.keys(grouped).map((key) => {
    const item = grouped[key];
    const statusMeta = mapSalaryStatus(item.latestStatus);
    return {
      key: item.key,
      workerName: item.workerName,
      workerUid: item.workerUid,
      recordCount: item.recordCount,
      lastWorkDateText: item.lastWorkDateText || '-',
      totalAmount: Number(item.totalAmount.toFixed(2)),
      paidAmount: Number(item.paidAmount.toFixed(2)),
      pendingAmount: Number(item.pendingAmount.toFixed(2)),
      totalAmountText: toMoneyText(item.totalAmount),
      paidAmountText: toMoneyText(item.paidAmount),
      pendingAmountText: toMoneyText(item.pendingAmount),
      statusText: statusMeta.text,
      statusClass: statusMeta.className,
      latestTime: item.latestTime,
    };
  }).sort((a, b) => {
    if (b.totalAmount !== a.totalAmount) return b.totalAmount - a.totalAmount;
    return b.latestTime - a.latestTime;
  });
}

function buildPayrollSummary(rows) {
  const list = Array.isArray(rows) ? rows : [];
  let totalAmount = 0;
  let paidAmount = 0;
  let pendingAmount = 0;

  list.forEach((item) => {
    totalAmount += Number(item?.totalAmount || 0);
    paidAmount += Number(item?.paidAmount || 0);
    pendingAmount += Number(item?.pendingAmount || 0);
  });

  return {
    workerCount: list.length,
    totalAmountText: toMoneyText(totalAmount),
    paidAmountText: toMoneyText(paidAmount),
    pendingAmountText: toMoneyText(pendingAmount),
  };
}

Page({
  data: {
    baseId: null,
    role: 'worker',
    isBossView: false,
    showBossPanels: false,

    baseInfo: null,
    loading: true,
    loadError: '',
    categoryText: '',
    auditText: '',
    jobRequirementText: '待补充',
    envSummaryText: '待补充',
    addressText: '待补充',
    licenseUrl: '',
    envImages: [],
    hasExpiredTempImage: false,

    sectionOpen: {
      baseInfo: true,
      signupProgress: true,
      payroll: true,
    },

    progressLoading: false,
    progressError: '',
    progressRows: [],
    progressSummary: {
      totalJobs: 0,
      openJobs: 0,
      closedJobs: 0,
      totalApplicants: 0,
    },

    payrollLoading: false,
    payrollError: '',
    payrollRows: [],
    payrollSummary: {
      workerCount: 0,
      totalAmountText: '0.00',
      paidAmountText: '0.00',
      pendingAmountText: '0.00',
    },
  },

  onLoad(options) {
    const userInfo = wx.getStorageSync('userInfo') || {};
    const role = resolveRole(userInfo);
    const isBossView = role === 'boss';
    const baseId = Number(options?.id || 0);

    if (!baseId) {
      this.setData({
        loading: false,
        loadError: '基地信息无效',
      });
      return;
    }

    this.setData({
      role,
      isBossView,
      baseId,
    });

    this.refreshPageData();
  },

  onPullDownRefresh() {
    this.refreshPageData().finally(() => wx.stopPullDownRefresh());
  },

  toggleSection(e) {
    const key = e.currentTarget.dataset.key;
    if (!key) return;
    const current = !!this.data.sectionOpen[key];
    this.setData({ [`sectionOpen.${key}`]: !current });
  },

  async refreshPageData() {
    await this.loadBaseDetail();
    if (this.data.isBossView && this.data.showBossPanels) {
      await Promise.all([
        this.loadSignupProgressData(),
        this.loadPayrollData(),
      ]);
    } else {
      this.setData({
        progressRows: [],
        progressError: '',
        payrollRows: [],
        payrollError: '',
        payrollSummary: {
          workerCount: 0,
          totalAmountText: '0.00',
          paidAmountText: '0.00',
          pendingAmountText: '0.00',
        },
      });
    }
  },

  async loadBaseDetail() {
    this.setData({
      loading: true,
      loadError: '',
    });

    try {
      const baseInfo = await app.request({
        url: `/base/${this.data.baseId}`,
        method: 'GET',
      });

      const meta = safeParseDescription(baseInfo?.description);
      const addressText = toText(baseInfo?.address, '待补充');
      const jobRequirementText = toText(
        meta.jobRequirement || meta.jobRequirements || meta.jobDescription || meta.description,
        '待补充',
      );
      const rawEnvImages = parseImageCollection(meta.workEnvImages || meta.environmentImages || meta.envImages);
      const envImages = rawEnvImages.map((item) => normalizePersistedImageUrl(item)).filter(Boolean);
      const envSummaryText = toText(
        meta.environmentSummary || meta.workEnvSummary || meta.environment || meta.workEnvironment,
        envImages.length ? `已上传 ${envImages.length} 张环境图片` : '待补充',
      );
      const rawLicenseUrl = toText(baseInfo?.licenseUrl || meta.licenseUrl, '');
      const licenseUrl = normalizePersistedImageUrl(rawLicenseUrl);
      const hasExpiredTempImage = (rawLicenseUrl && !licenseUrl) || envImages.length < rawEnvImages.length;

      // 解析 cloud:// 为可访问的临时 URL
      const allCloudUrls = [];
      if (/^cloud:\/\//.test(licenseUrl)) allCloudUrls.push({ key: 'licenseUrl', url: licenseUrl });
      envImages.forEach((url, i) => {
        if (/^cloud:\/\//.test(url)) allCloudUrls.push({ key: `envImage_${i}`, url });
      });
      if (allCloudUrls.length) {
        Promise.all(
          allCloudUrls.map((item) =>
            app.resolveCloudFileUrl(item.url).then((resolved) => ({ key: item.key, resolved }))
          )
        ).then((results) => {
          const patch = {};
          results.forEach((r) => {
            if (r.key === 'licenseUrl') patch.licenseUrl = r.resolved;
            else {
              const idx = parseInt(r.key.replace('envImage_', ''), 10);
              if (!isNaN(idx)) {
                const arr = [...(this.data.envImages || envImages)];
                arr[idx] = r.resolved;
                patch.envImages = arr;
              }
            }
          });
          if (Object.keys(patch).length) this.setData(patch);
        }).catch(() => {});
      }
      const showBossPanels = this.data.isBossView && Number(baseInfo?.auditStatus) === 1;

      this.setData({
        baseInfo,
        loading: false,
        categoryText: mapCategoryLabel(baseInfo?.category),
        auditText: mapAuditLabel(baseInfo?.auditStatus),
        jobRequirementText,
        envSummaryText,
        addressText,
        licenseUrl,
        envImages,
        hasExpiredTempImage,
        showBossPanels,
      });
    } catch (error) {
      this.setData({
        loading: false,
        loadError: extractErrorMessage(error, '加载基地详情失败，请稍后重试'),
      });
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  async loadSignupProgressData() {
    this.setData({
      progressLoading: true,
      progressError: '',
    });
    try {
      const [jobsRes, applicationsRes] = await Promise.all([
        app.request({ url: `/base/${this.data.baseId}/jobs?showAll=1`, method: 'GET' }).catch(() => []),
        app.request({ url: `/base/${this.data.baseId}/applications`, method: 'GET' }).catch(() => []),
      ]);

      const progress = buildProgressRows(jobsRes, applicationsRes);
      this.setData({
        progressLoading: false,
        progressRows: progress.rows,
        progressSummary: progress.summary,
      });
    } catch (error) {
      this.setData({
        progressLoading: false,
        progressRows: [],
        progressSummary: {
          totalJobs: 0,
          openJobs: 0,
          closedJobs: 0,
          totalApplicants: 0,
        },
        progressError: extractErrorMessage(error, '报名进度加载失败'),
      });
    }
  },

  async loadPayrollData() {
    this.setData({
      payrollLoading: true,
      payrollError: '',
    });

    try {
      const payload = await app.request({
        url: `/salary/list?baseId=${this.data.baseId}`,
        method: 'GET',
      });

      const payrollRows = buildPayrollRows(payload?.list);
      const payrollSummary = buildPayrollSummary(payrollRows);
      this.setData({
        payrollLoading: false,
        payrollRows,
        payrollSummary,
      });
    } catch (error) {
      this.setData({
        payrollLoading: false,
        payrollRows: [],
        payrollSummary: {
          workerCount: 0,
          totalAmountText: '0.00',
          paidAmountText: '0.00',
          pendingAmountText: '0.00',
        },
        payrollError: extractErrorMessage(error, '工资数据加载失败，请稍后重试'),
      });
    }
  },

  previewImage(e) {
    const src = toText(e.currentTarget.dataset.src);
    if (!src) return;

    const urls = this.data.envImages.length
      ? this.data.envImages
      : (this.data.licenseUrl ? [this.data.licenseUrl] : []);

    wx.previewImage({ current: src, urls });
  },

  onLicenseImageError() {
    this.setData({
      licenseUrl: '',
      hasExpiredTempImage: true,
    });
  },

  onEnvImageError(e) {
    const index = Number(e.currentTarget.dataset.index);
    if (!Number.isFinite(index)) return;
    const next = this.data.envImages.filter((_, i) => i !== index);
    this.setData({
      envImages: next,
      hasExpiredTempImage: true,
    });
  },
});
