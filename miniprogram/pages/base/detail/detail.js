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

function normalizeImageList(meta) {
  if (!meta) return [];

  const candidates = [
    meta.workEnvImages,
    meta.environmentImages,
    meta.envImages,
    meta.images,
  ];

  for (let i = 0; i < candidates.length; i += 1) {
    const item = candidates[i];
    if (Array.isArray(item)) {
      return item.map((src) => toText(src)).filter(Boolean);
    }
  }
  return [];
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

      const meta = safeParseDescription(baseInfo && baseInfo.description);
      const addressText = toText(baseInfo && baseInfo.address, '待补充');
      const jobRequirementText = pickFieldText([
        meta.jobRequirement,
        meta.jobRequirements,
        meta.jobDescription,
        meta.description,
      ], '待补充');
      const rawEnvImages = normalizeImageList(meta);
      const envImages = rawEnvImages.map((item) => normalizePersistedImageUrl(item)).filter(Boolean);
      const envSummaryText = pickFieldText([
        meta.environmentSummary,
        meta.workEnvSummary,
        meta.environment,
        meta.workEnvironment,
      ], envImages.length ? `已上传 ${envImages.length} 张环境图片` : '待补充');
      const rawLicenseUrl = toText((baseInfo && baseInfo.licenseUrl) || meta.licenseUrl, '');
      const licenseUrl = normalizePersistedImageUrl(rawLicenseUrl);
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
