const app = getApp();
const { resolveRole } = require('../../../utils/role');

const CATEGORY_OPTIONS = [
  { label: '水果基地', value: 1 },
  { label: '蔬菜基地', value: 2 },
  { label: '其他', value: 3 },
];

function trimText(value) {
  return String(value || '').trim();
}

function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 11);
}

function isHttpUrl(value) {
  return /^https?:\/\//i.test(trimText(value));
}

function isDevtoolsTmpUrl(value) {
  return /^https?:\/\/127\.0\.0\.1:\d+\/__tmp__\//i.test(trimText(value));
}

function shouldUploadImage(value) {
  const text = trimText(value);
  if (!text) return false;
  if (isDevtoolsTmpUrl(text)) return true;
  if (/^wxfile:\/\//i.test(text)) return true;
  if (/^[a-zA-Z]:\\/.test(text)) return true;
  if (isHttpUrl(text)) return false;
  return true;
}

function normalizePersistedImageUrl(value) {
  const text = trimText(value);
  if (!text) return '';
  if (isDevtoolsTmpUrl(text)) return '';
  if (/^wxfile:\/\//i.test(text)) return '';
  if (/^[a-zA-Z]:\\/.test(text)) return '';
  if (/^file:\/\//i.test(text)) return '';
  return text;
}

function normalizePersistedImageList(values) {
  if (!Array.isArray(values)) return [];
  return values.map((item) => normalizePersistedImageUrl(item)).filter(Boolean);
}

function mapAuditStatusText(status) {
  const statusNum = Number(status);
  if (statusNum === 1) return '已通过';
  if (statusNum === 2) return '已拒绝';
  return '待审核';
}

function maskIdCard(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (text.length <= 8) return text;
  return `${text.slice(0, 4)}********${text.slice(-4)}`;
}

function extractErrorMessage(err, fallback = '提交失败，请稍后重试') {
  const response = err && err.response ? err.response : {};
  const candidates = [
    err && err.message,
    err && err.errMsg,
    Array.isArray(response.message) ? response.message.join(' / ') : response.message,
    response.msg,
  ];

  for (let i = 0; i < candidates.length; i += 1) {
    const message = trimText(candidates[i]);
    if (message) return message;
  }

  return fallback;
}

Page({
  data: {
    categoryOptions: CATEGORY_OPTIONS,
    categoryIndex: 0,

    ownerName: '',
    ownerPhone: '',
    originalOwnerName: '',
    originalOwnerPhone: '',
    ownerIdCardMasked: '',
    companyAdminName: '',
    companyAdminPhone: '',

    companyName: '',
    regionCode: '610100',
    address: '',
    salary: '',
    jobDescription: '',
    licenseImage: '',
    envImages: [],
    uploadingLicense: false,
    uploadingEnv: false,

    submitting: false,
    auditSubmitted: false,
    auditStatusText: '待审核',
    error: '',
  },

  async onLoad() {
    const token = wx.getStorageSync('token');
    const userInfo = wx.getStorageSync('userInfo') || {};
    const role = resolveRole(userInfo);

    if (!token) {
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }

    if (role !== 'boss') {
      wx.showModal({
        title: '无权限',
        content: '该页面仅老板账号可访问。',
        showCancel: false,
        success: () => wx.reLaunch({ url: '/pages/login/login' }),
      });
      return;
    }

    this.setData({
      ownerName: trimText(userInfo.name),
      ownerPhone: normalizePhone(userInfo.phone || userInfo.mobile || ''),
      originalOwnerName: trimText(userInfo.name),
      originalOwnerPhone: normalizePhone(userInfo.phone || userInfo.mobile || ''),
      ownerIdCardMasked: userInfo.idCard ? maskIdCard(userInfo.idCard) : '',
    });

    await this.loadProfileFallback();
    this.sanitizeTransientImages();
  },

  onShow() {
    const token = wx.getStorageSync('token');
    const userInfo = wx.getStorageSync('userInfo') || {};
    if (!token || resolveRole(userInfo) !== 'boss') {
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }
    this.sanitizeTransientImages();
  },

  logout() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出当前老板账号吗？',
      success: (res) => {
        if (!res.confirm) return;
        wx.removeStorageSync('token');
        wx.removeStorageSync('userInfo');
        wx.removeStorageSync('bossBaseDraft');
        app.globalData.token = null;
        app.globalData.userInfo = null;
        wx.reLaunch({ url: '/pages/login/login' });
      },
    });
  },

  async loadProfileFallback() {
    const profile = await app.request({
      url: '/user/profile',
      method: 'GET',
    }).catch(() => null);

    if (!profile) return;

    const ownerName = trimText(profile.name || this.data.ownerName);
    const ownerPhone = normalizePhone(profile.phone || this.data.ownerPhone);
    const ownerIdCardMasked = profile.idCard ? maskIdCard(profile.idCard) : this.data.ownerIdCardMasked;

    this.setData({
      ownerName,
      ownerPhone,
      originalOwnerName: ownerName,
      originalOwnerPhone: ownerPhone,
      ownerIdCardMasked,
    });
  },

  sanitizeTransientImages() {
    const normalizedLicenseImage = normalizePersistedImageUrl(this.data.licenseImage);
    const normalizedEnvImages = normalizePersistedImageList(this.data.envImages);
    const removedInState = (
      trimText(this.data.licenseImage) !== normalizedLicenseImage
      || normalizedEnvImages.length !== this.data.envImages.length
    );

    if (removedInState) {
      this.setData({
        licenseImage: normalizedLicenseImage,
        envImages: normalizedEnvImages,
        error: this.data.error || '检测到失效的临时图片，已自动移除，请重新上传',
      });
    }

    const draft = wx.getStorageSync('bossBaseDraft');
    if (!draft || typeof draft !== 'object' || !draft.payload || typeof draft.payload !== 'object') return;

    const nextPayload = Object.assign({}, draft.payload);
    nextPayload.licenseUrl = normalizePersistedImageUrl(nextPayload.licenseUrl);

    const rawDescription = trimText(nextPayload.description);
    if (rawDescription) {
      try {
        const parsed = JSON.parse(rawDescription);
        if (parsed && typeof parsed === 'object') {
          if (Object.prototype.hasOwnProperty.call(parsed, 'licenseUrl')) {
            parsed.licenseUrl = normalizePersistedImageUrl(parsed.licenseUrl);
          }
          if (Object.prototype.hasOwnProperty.call(parsed, 'workEnvImages')) {
            parsed.workEnvImages = normalizePersistedImageList(parsed.workEnvImages);
          }
          nextPayload.description = JSON.stringify(parsed);
        }
      } catch (_) {
        // Keep original draft description when it is not valid JSON.
      }
    }

    const oldPayloadJson = JSON.stringify(draft.payload);
    const newPayloadJson = JSON.stringify(nextPayload);
    if (oldPayloadJson !== newPayloadJson) {
      wx.setStorageSync('bossBaseDraft', Object.assign({}, draft, { payload: nextPayload }));
    }
  },

  onFieldInput(e) {
    const field = e.currentTarget.dataset.field;
    const raw = e.detail.value;
    const phoneFields = ['ownerPhone', 'companyAdminPhone'];
    const value = phoneFields.includes(field) ? normalizePhone(raw) : raw;

    this.setData({
      [field]: value,
      error: '',
    });
  },

  onCategoryChange(e) {
    this.setData({
      categoryIndex: Number(e.detail.value || 0),
      error: '',
    });
  },

  chooseLicenseImage() {
    if (this.data.uploadingLicense) return;

    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      success: async (res) => {
        const file = res?.tempFiles?.[0];
        if (!file?.tempFilePath) return;

        this.setData({ uploadingLicense: true });
        wx.showLoading({
          title: '上传执照中...',
          mask: true,
        });

        try {
          const uploadedUrl = await this.uploadSingleImage(file.tempFilePath);
          this.setData({
            licenseImage: uploadedUrl,
            error: '',
          });
        } catch (error) {
          this.setData({
            error: extractErrorMessage(error, '营业执照上传失败，请重试'),
          });
          wx.showToast({
            title: '营业执照上传失败',
            icon: 'none',
          });
        } finally {
          wx.hideLoading();
          this.setData({ uploadingLicense: false });
        }
      },
    });
  },

  chooseEnvImages() {
    if (this.data.uploadingEnv) return;

    const remain = 3 - this.data.envImages.length;
    if (remain <= 0) return;

    wx.chooseMedia({
      count: remain,
      mediaType: ['image'],
      success: async (res) => {
        const selected = (res?.tempFiles || []).map((item) => item.tempFilePath).filter(Boolean);
        if (!selected.length) return;

        this.setData({ uploadingEnv: true });
        wx.showLoading({
          title: '上传环境图...',
          mask: true,
        });

        try {
          const uploadedList = [];
          for (let i = 0; i < selected.length; i += 1) {
            const uploaded = await this.uploadSingleImage(selected[i]);
            if (uploaded) uploadedList.push(uploaded);
          }

          this.setData({
            envImages: this.data.envImages.concat(uploadedList).slice(0, 3),
            error: '',
          });
        } catch (error) {
          this.setData({
            error: extractErrorMessage(error, '环境图片上传失败，请重试'),
          });
          wx.showToast({
            title: '环境图片上传失败',
            icon: 'none',
          });
        } finally {
          wx.hideLoading();
          this.setData({ uploadingEnv: false });
        }
      },
    });
  },

  removeEnvImage(e) {
    const index = Number(e.currentTarget.dataset.index);
    if (!Number.isFinite(index)) return;

    const next = this.data.envImages.filter((_, idx) => idx !== index);
    this.setData({ envImages: next });
  },

  onLicensePreviewError() {
    this.setData({
      licenseImage: '',
      error: '营业执照临时文件已失效，请重新选择图片',
    });
  },

  onEnvPreviewError(e) {
    const index = Number(e.currentTarget.dataset.index);
    if (!Number.isFinite(index)) return;

    const next = this.data.envImages.filter((_, idx) => idx !== index);
    this.setData({
      envImages: next,
      error: '有环境图片已失效，已移除，请重新添加',
    });
  },

  validateForm() {
    const ownerName = trimText(this.data.ownerName);
    const ownerPhone = normalizePhone(this.data.ownerPhone);
    const companyAdminName = trimText(this.data.companyAdminName);
    const companyAdminPhone = normalizePhone(this.data.companyAdminPhone);
    const companyName = trimText(this.data.companyName);
    const regionCode = Number(this.data.regionCode);
    const address = trimText(this.data.address);
    const salary = trimText(this.data.salary);
    const jobDescription = trimText(this.data.jobDescription);

    if (this.data.uploadingLicense || this.data.uploadingEnv) return '图片上传中，请稍候';
    if (!ownerName) return '请填写老板姓名';
    if (ownerPhone.length !== 11) return '请输入正确的老板手机号';
    if (!companyAdminName) return '请填写公司管理员姓名';
    if (companyAdminPhone.length !== 11) return '请输入正确的公司管理员手机号';
    if (!companyName) return '请填写企业名称';
    if (!this.data.licenseImage) return '请上传营业执照';
    if (!this.data.envImages.length) return '请至少上传一张工作环境图片';
    if (!address) return '请填写工作地址';
    if (!salary) return '请填写工资标准';
    if (!jobDescription) return '请填写岗位描述';
    if (!Number.isInteger(regionCode) || regionCode <= 0) return '请填写有效的区域编码';

    return '';
  },

  buildPayload(uploaded = {}) {
    const licenseUrl = trimText(uploaded.licenseUrl || this.data.licenseImage);
    const envImages = Array.isArray(uploaded.envImages) && uploaded.envImages.length
      ? uploaded.envImages
      : this.data.envImages;
    const category = this.data.categoryOptions[this.data.categoryIndex]?.value || 1;

    const descriptionPayload = {
      salary: trimText(this.data.salary),
      jobDescription: trimText(this.data.jobDescription),
      workEnvImages: envImages,
      ownerProfile: {
        name: trimText(this.data.ownerName),
        phone: normalizePhone(this.data.ownerPhone),
        idCardMasked: this.data.ownerIdCardMasked,
      },
      companyAdminContact: {
        name: trimText(this.data.companyAdminName),
        phone: normalizePhone(this.data.companyAdminPhone),
      },
      auditFlow: 'boss_submit_super_admin_review',
      uiStyle: 'crayon-warm-handdrawn',
      submittedAt: new Date().toISOString(),
    };

    return {
      baseName: trimText(this.data.companyName),
      licenseUrl,
      contactPhone: normalizePhone(this.data.companyAdminPhone),
      category,
      regionCode: Number(this.data.regionCode),
      address: trimText(this.data.address),
      description: JSON.stringify(descriptionPayload),
    };
  },

  async uploadSingleImage(filePath) {
    const path = trimText(filePath);
    if (!path) return '';
    if (!shouldUploadImage(path)) return path;

    const res = await app.upload({
      url: '/base/upload/image',
      filePath: path,
      name: 'file',
    });

    const url = trimText(res && res.url);
    if (!url) {
      throw new Error('图片上传失败，未返回可访问地址');
    }
    return url;
  },

  async uploadFormImages() {
    const licenseUrl = await this.uploadSingleImage(this.data.licenseImage);
    const envImages = [];

    for (let i = 0; i < this.data.envImages.length; i += 1) {
      const uploaded = await this.uploadSingleImage(this.data.envImages[i]);
      if (uploaded) envImages.push(uploaded);
    }

    return { licenseUrl, envImages };
  },

  saveLocalDraft(payload) {
    wx.setStorageSync('bossBaseDraft', {
      payload,
      auditStatus: 0,
      createdAt: Date.now(),
    });
  },

  async findOwnedBaseIdByName(baseName) {
    const targetName = trimText(baseName);
    if (!targetName) return 0;

    const userInfo = wx.getStorageSync('userInfo') || {};
    const ownerId = Number(userInfo.id || userInfo.userId || 0);
    if (!ownerId) return 0;

    const list = await app.request({
      url: `/base?ownerId=${ownerId}&showAll=1`,
      method: 'GET',
    }).catch(() => []);

    const matched = (Array.isArray(list) ? list : []).find(
      (item) => trimText(item && item.baseName) === targetName,
    );
    return Number((matched && matched.id) || 0);
  },

  async tryUpdateExistingBase(payload) {
    const baseId = await this.findOwnedBaseIdByName(payload && payload.baseName);
    if (!baseId) return null;

    return app.request({
      url: `/base/${baseId}`,
      method: 'PATCH',
      data: payload,
    });
  },

  async syncOwnerProfile() {
    const ownerName = trimText(this.data.ownerName);
    const ownerPhone = normalizePhone(this.data.ownerPhone);
    const originalOwnerName = trimText(this.data.originalOwnerName);
    const originalOwnerPhone = normalizePhone(this.data.originalOwnerPhone);

    const payload = {};
    if (ownerName && ownerName !== originalOwnerName) {
      payload.name = ownerName;
    }
    if (ownerPhone && ownerPhone !== originalOwnerPhone) {
      payload.phone = ownerPhone;
    }

    if (!Object.keys(payload).length) return;

    const profile = await app.request({
      url: '/user/profile',
      method: 'PATCH',
      data: payload,
    });

    const nextOwnerName = trimText(profile?.name || ownerName);
    const nextOwnerPhone = normalizePhone(profile?.phone || ownerPhone);

    this.setData({
      ownerName: nextOwnerName || ownerName,
      ownerPhone: nextOwnerPhone || ownerPhone,
      originalOwnerName: nextOwnerName || ownerName,
      originalOwnerPhone: nextOwnerPhone || ownerPhone,
    });
  },

  async submitForAudit() {
    if (this.data.submitting || this.data.uploadingLicense || this.data.uploadingEnv) return;

    const error = this.validateForm();
    if (error) {
      this.setData({ error });
      return;
    }

    this.setData({
      submitting: true,
      error: '',
    });

    let payload = null;

    try {
      const uploaded = await this.uploadFormImages();
      payload = this.buildPayload(uploaded);

      this.setData({
        licenseImage: uploaded.licenseUrl || this.data.licenseImage,
        envImages: uploaded.envImages.length ? uploaded.envImages : this.data.envImages,
      });

      await this.syncOwnerProfile();
      const res = await app.request({
        url: '/base',
        method: 'POST',
        data: payload,
      });

      this.setData({
        submitting: false,
        auditSubmitted: true,
        auditStatusText: mapAuditStatusText(res?.auditStatus),
      });

      wx.showToast({
        title: '已提交审核',
        icon: 'success',
      });
    } catch (requestError) {
      const statusCode = Number(requestError?.statusCode || 0);

      if (statusCode === 409 && payload && /已存在|被使用|重复/.test(extractErrorMessage(requestError, ''))) {
        try {
          const updated = await this.tryUpdateExistingBase(payload);
          if (updated) {
            this.setData({
              submitting: false,
              auditSubmitted: true,
              auditStatusText: mapAuditStatusText(updated?.auditStatus),
            });

            wx.showToast({
              title: '已更新并提交审核',
              icon: 'success',
            });
            return;
          }
        } catch (updateError) {
          this.setData({
            submitting: false,
            auditSubmitted: false,
            error: extractErrorMessage(updateError),
          });

          wx.showToast({
            title: '更新失败，请重试',
            icon: 'none',
          });
          return;
        }
      }

      if (statusCode >= 400 && statusCode < 500) {
        this.setData({
          submitting: false,
          auditSubmitted: false,
          error: extractErrorMessage(requestError),
        });

        wx.showToast({
          title: '提交失败，请修改后重试',
          icon: 'none',
        });
        return;
      }

      const fallbackPayload = payload || this.buildPayload();
      this.saveLocalDraft(fallbackPayload);

      this.setData({
        submitting: false,
        auditSubmitted: true,
        auditStatusText: '待审核（离线暂存）',
      });

      wx.showToast({
        title: '后端不可用，已暂存',
        icon: 'none',
      });
    }
  },
});
