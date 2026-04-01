// pages/base/detail/detail.js
const app = getApp();

function toText(value, fallback = '') {
  const text = value == null ? '' : String(value).trim();
  return text || fallback;
}

function safeParseDescription(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;

  try {
    return JSON.parse(String(value));
  } catch (error) {
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
  return '其他农作';
}

function mapAuditLabel(auditStatus) {
  const code = Number(auditStatus);
  if (code === 1) return '已审核';
  if (code === 2) return '已拒绝';
  return '待审核';
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
      // Fall through to plain text split.
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

Page({
  data: {
    baseId: null,
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
  },

  onLoad(options) {
    const baseId = Number(options && options.id);
    if (!baseId) {
      this.setData({
        loading: false,
        loadError: '基地信息无效',
      });
      return;
    }

    this.setData({ baseId });
    this.loadBaseDetail();
  },

  onPullDownRefresh() {
    this.loadBaseDetail().finally(() => wx.stopPullDownRefresh());
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
      const rawLicenseUrl = toText((baseInfo && baseInfo.licenseUrl) || meta.licenseUrl, '');
      const licenseUrl = normalizePersistedImageUrl(rawLicenseUrl, apiOrigin);
      const hasExpiredTempImage = (rawLicenseUrl && !licenseUrl) || envImages.length < rawEnvImages.length;
      const envSummaryFallback = hasExpiredTempImage && !envImages.length
        ? '历史图片地址失效，请老板重新上传'
        : (envImages.length ? `已上传 ${envImages.length} 张环境图片` : '待补充');
      let envSummaryText = pickFieldText([
        meta.environmentSummary,
        meta.workEnvSummary,
        meta.environment,
        meta.workEnvironment,
      ], envSummaryFallback);
      if (hasExpiredTempImage && !envImages.length && /已上传\s*\d+\s*张/.test(envSummaryText)) {
        envSummaryText = envSummaryFallback;
      }

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
