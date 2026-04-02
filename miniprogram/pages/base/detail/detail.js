// pages/base/detail/detail.js
const app = getApp();
const { resolveRole } = require('../../../utils/role');

function toText(value, fallback = '') {
  const text = value == null ? '' : String(value).trim();
  return text || fallback;
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

function pickFieldText(candidates, fallback = '') {
  if (!Array.isArray(candidates)) return fallback;
  for (let i = 0; i < candidates.length; i += 1) {
    const text = toText(candidates[i]);
    if (text) return text;
  }
  return fallback;
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

function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value && value.list)) return value.list;
  return [];
}

function resolveApiOrigin() {
  const baseUrl = toText((app && app.globalData && app.globalData.baseUrl) || wx.getStorageSync('apiBaseUrl'));
  const match = baseUrl.match(/^(https?:\/\/[^/]+)/i);
  return match ? match[1] : '';
}

function isHttpUrl(value) {
  return /^https?:\/\//i.test(toText(value));
}

function isLoopbackHttpUrl(value) {
  return /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/i.test(toText(value));
}

function isLoopbackOrigin(value) {
  return /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(toText(value));
}

function extractImageText(value) {
  if (typeof value === 'string') return toText(value);
  if (!value || typeof value !== 'object') return '';

  const candidates = [
    value.url,
    value.src,
    value.path,
    value.image,
    value.imageUrl,
  ];

  for (let i = 0; i < candidates.length; i += 1) {
    const text = toText(candidates[i]);
    if (text) return text;
  }

  return '';
}

function parseImageCollection(value) {
  if (Array.isArray(value)) {
    return value.map((item) => extractImageText(item)).filter(Boolean);
  }

  if (!value) return [];
  const text = extractImageText(value);
  if (!text) return [];
  if (/^data:image\//i.test(text)) return [text];

  if (text.startsWith('[') || text.startsWith('{')) {
    try {
      return parseImageCollection(JSON.parse(text));
    } catch (_) {
      // Keep fallback split.
    }
  }

  if (!/[,\n\r;，；]/.test(text)) return [text];
  return text
    .split(/[,\n\r;，；]+/)
    .map((item) => toText(item))
    .filter(Boolean);
}

function normalizeImageList(meta) {
  if (!meta) return [];

  const candidates = [
    meta.workEnvImages,
    meta.environmentImages,
    meta.envImages,
    meta.images,
  ];

  for (let i = 0; i < candidates.length; i += 1) {
    const urls = parseImageCollection(candidates[i]);
    if (urls.length) return urls;
  }
  return [];
}

function isDevtoolsTmpUrl(value) {
  return /^https?:\/\/127\.0\.0\.1:\d+\/__tmp__\//i.test(toText(value));
}

function normalizePersistedImageUrl(value, apiOrigin = '') {
  const text = toText(value);
  if (!text) return '';
  if (isDevtoolsTmpUrl(text)) return '';
  if (/^wxfile:\/\//i.test(text)) return '';
  if (/^[a-zA-Z]:\\/.test(text)) return '';
  if (/^file:\/\//i.test(text)) return '';
  if (/^data:image\//i.test(text)) return text;

  if (text.startsWith('//')) return `https:${text}`;

  if (!isHttpUrl(text)) {
    const cleanPath = text.replace(/^\/+/, '');
    if (!cleanPath) return '';
    return apiOrigin ? `${apiOrigin}/${cleanPath}` : '';
  }

  if (apiOrigin && !isLoopbackOrigin(apiOrigin) && isLoopbackHttpUrl(text)) {
    return text.replace(/^(https?:\/\/[^/]+)/i, apiOrigin);
  }

  return text;
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
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function toTimestamp(value) {
  const raw = toText(value);
  if (!raw) return 0;
  const ts = new Date(raw).getTime();
  return Number.isFinite(ts) ? ts : 0;
}

function mapSalaryStatus(status) {
  const code = Number(status);
  if (code === 2) return { text: '已发放', className: 'paid' };
  if (code === 1) return { text: '待发放', className: 'confirm' };
  return { text: '待核算', className: 'pending' };
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

function buildPayrollRows(rawRows) {
  const rows = normalizeArray(rawRows);
  const grouped = {};

  rows.forEach((item) => {
    const workerName = toText(item && item.workerName, '未实名采摘工');
    const workerUid = toText(item && item.workerUid);
    const workerPhone = toText(item && item.workerPhone);
    const key = workerUid || workerPhone || workerName;
    if (!key) return;

    const amount = Number(item && item.totalAmount) || 0;
    const status = Number(item && item.status);
    const currentTs = Math.max(
      toTimestamp(item && item.createdAt),
      toTimestamp(item && item.workDate),
      0,
    );

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
        lastWorkDateText: toDateText(item && item.workDate),
      };
    }

    const target = grouped[key];
    target.totalAmount += amount;
    target.recordCount += 1;

    if (status === 2) {
      target.paidAmount += amount;
    } else {
      target.pendingAmount += amount;
    }

    if (currentTs >= target.latestTime) {
      target.latestTime = currentTs;
      target.latestStatus = status;
      target.lastWorkDateText = toDateText(item && item.workDate);
    }
  });

  return Object.keys(grouped)
    .map((key) => {
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
    })
    .sort((a, b) => {
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
    totalAmount += Number(item && item.totalAmount) || 0;
    paidAmount += Number(item && item.paidAmount) || 0;
    pendingAmount += Number(item && item.pendingAmount) || 0;
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
    activePanel: 'base',

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
    const baseId = Number(options && options.id);

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
      activePanel: 'base',
      baseId,
    });

    this.refreshPageData();
  },

  onPullDownRefresh() {
    this.refreshPageData().finally(() => wx.stopPullDownRefresh());
  },

  async refreshPageData() {
    const tasks = [this.loadBaseDetail()];
    if (this.data.isBossView) {
      tasks.push(this.loadPayrollData());
    }
    await Promise.all(tasks);
  },

  onPanelChange(e) {
    const panel = e.currentTarget.dataset.panel;
    if (panel !== 'base' && panel !== 'payroll') return;
    if (panel === this.data.activePanel) return;
    this.setData({ activePanel: panel });
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

      const apiOrigin = resolveApiOrigin();
      const meta = safeParseDescription(baseInfo && baseInfo.description);
      const addressText = toText(baseInfo && baseInfo.address, '待补充');
      const jobRequirementText = pickFieldText([
        meta.jobRequirement,
        meta.jobRequirements,
        meta.jobDescription,
        meta.description,
      ], '待补充');
      const rawEnvImages = normalizeImageList(meta);
      const envImages = rawEnvImages.map((item) => normalizePersistedImageUrl(item, apiOrigin)).filter(Boolean);
      const envSummaryText = pickFieldText([
        meta.environmentSummary,
        meta.workEnvSummary,
        meta.environment,
        meta.workEnvironment,
      ], envImages.length ? `已上传 ${envImages.length} 张环境图片` : '待补充');
      const rawLicenseUrl = toText((baseInfo && baseInfo.licenseUrl) || meta.licenseUrl, '');
      const licenseUrl = normalizePersistedImageUrl(rawLicenseUrl, apiOrigin);
      const hasExpiredTempImage = (rawLicenseUrl && !licenseUrl) || envImages.length < rawEnvImages.length;

      this.setData({
        baseInfo,
        loading: false,
        categoryText: mapCategoryLabel(baseInfo && baseInfo.category),
        auditText: mapAuditLabel(baseInfo && baseInfo.auditStatus),
        jobRequirementText,
        envSummaryText,
        addressText,
        licenseUrl,
        envImages,
        hasExpiredTempImage,
      });
    } catch (err) {
      console.error('[base detail] load failed:', err);
      this.setData({
        loading: false,
        loadError: '加载基地详情失败，请稍后重试',
      });
      wx.showToast({
        title: '加载失败',
        icon: 'none',
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
      const payrollRows = buildPayrollRows(payload && payload.list);
      const payrollSummary = buildPayrollSummary(payrollRows);

      this.setData({
        payrollLoading: false,
        payrollRows,
        payrollSummary,
      });
    } catch (err) {
      console.error('[base detail] payroll load failed:', err);
      this.setData({
        payrollLoading: false,
        payrollRows: [],
        payrollSummary: {
          workerCount: 0,
          totalAmountText: '0.00',
          paidAmountText: '0.00',
          pendingAmountText: '0.00',
        },
        payrollError: extractErrorMessage(err, '工资数据加载失败，请稍后重试'),
      });
    }
  },

  previewImage(e) {
    const src = toText(e.currentTarget.dataset.src);
    if (!src) return;

    const urls = this.data.envImages.length
      ? this.data.envImages
      : (this.data.licenseUrl ? [this.data.licenseUrl] : []);

    wx.previewImage({
      current: src,
      urls,
    });
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

    const next = this.data.envImages.filter((_, idx) => idx !== index);
    this.setData({
      envImages: next,
      hasExpiredTempImage: true,
    });
  },
});
