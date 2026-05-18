const app = getApp();
const { resolveRole } = require('../../../utils/role');

const CATEGORY_OPTIONS = [
  { label: '水果基地', value: 1 },
  { label: '蔬菜基地', value: 2 },
  { label: '其他', value: 3 },
];

function todayString() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function monthStartString() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

function trimText(value) {
  return String(value || '').trim();
}

function safeNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function formatAmount(value) {
  return safeNumber(value, 0).toFixed(2);
}

function normalizeArray(res) {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.list)) return res.list;
  return [];
}

function payrollStatusText(status) {
  if (status === 2) return '已结算';
  if (status === 1) return '待老板结算';
  return '待工人确认';
}

function payrollStatusClass(status) {
  if (status === 2) return 'paid';
  if (status === 1) return 'confirmed';
  return 'pending';
}

function payrollVolumeText(item) {
  const pieceCount = safeNumber(item?.pieceCount, 0);
  const workDuration = safeNumber(item?.workDuration, 0);
  if (pieceCount > 0) return `计件 ${pieceCount}`;
  if (workDuration > 0) return `工时 ${workDuration}h`;
  return '固定日薪';
}

function emptyPayrollSummary() {
  return {
    totalRecords: 0,
    pendingCount: 0,
    confirmedCount: 0,
    paidCount: 0,
    totalAmount: '0.00',
  };
}

function buildPayrollRangeText(dateFrom, dateTo) {
  if (dateFrom && dateTo) return `${dateFrom}_${dateTo}`;
  return todayString();
}

function formatDateTimeText(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value).replace('T', ' ').slice(0, 19);
  }
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
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

    payrollLoading: false,
    payrollSettling: false,
    canShowPayrollSection: false,
    payrollBases: [],
    payrollBaseIndex: 0,
    payrollBaseId: '',
    payrollDateFrom: monthStartString(),
    payrollDateTo: todayString(),
    payrollRows: [],
    payrollSummary: emptyPayrollSummary(),
    payrollReportGeneratedAtText: '',
    payrollReportFileName: '',
    ownedBaseId: 0,
  },

  async onLoad() {
    const userInfo = wx.getStorageSync('userInfo') || {};
    const role = resolveRole(userInfo);

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
    await this.loadOwnedBaseForForm();
    this.sanitizeTransientImages();
  },

  async onShow() {
    const tabBar = this.getTabBar && this.getTabBar();
    if (tabBar) {
      tabBar.setData({ selected: 2 });
    }
    await this.loadOwnedBaseForForm();
    this.sanitizeTransientImages();
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

  async loadOwnedBaseForForm() {
    const currentUser = wx.getStorageSync('userInfo') || app.getCurrentUser() || {};
    const ownerId = Number(currentUser.id || currentUser.userId || 0);
    if (!ownerId) return;

    const list = await app.request({
      url: `/base?ownerId=${ownerId}&showAll=1`,
      method: 'GET',
    }).catch(() => []);

    const baseList = normalizeArray(list);
    if (!baseList.length) {
      this.setData({
        ownedBaseId: 0,
        auditSubmitted: false,
        auditStatusText: mapAuditStatusText(0),
      });
      return;
    }

    const latestBase = [...baseList].sort((a, b) => {
      const ta = new Date(a?.createdAt || 0).getTime();
      const tb = new Date(b?.createdAt || 0).getTime();
      if (Number.isFinite(tb - ta) && tb !== ta) return tb - ta;
      return Number(b?.id || 0) - Number(a?.id || 0);
    })[0];

    const rawDescription = trimText(latestBase?.description);
    let description = {};
    try {
      description = rawDescription ? JSON.parse(rawDescription) : {};
    } catch (_) {
      description = rawDescription ? { jobDescription: rawDescription } : {};
    }

    const categoryValue = Number(latestBase?.category || 1);
    const categoryIdx = CATEGORY_OPTIONS.findIndex((item) => Number(item?.value) === categoryValue);
    const categoryIndex = categoryIdx >= 0 ? categoryIdx : 0;

    const resolvedLicenseUrl = await app.resolveCloudFileUrl(
      normalizePersistedImageUrl(latestBase?.licenseUrl || description?.licenseUrl || ''),
    );

    this.setData({
      ownedBaseId: Number(latestBase?.id || 0),
      companyName: trimText(latestBase?.baseName),
      companyAdminName: trimText(description?.companyAdminContact?.name || this.data.companyAdminName),
      companyAdminPhone: normalizePhone(
        latestBase?.contactPhone
        || description?.companyAdminContact?.phone
        || this.data.companyAdminPhone,
      ),
      categoryIndex,
      regionCode: String(latestBase?.regionCode || this.data.regionCode || '610100'),
      address: trimText(latestBase?.address || ''),
      salary: trimText(description?.salary || ''),
      jobDescription: trimText(description?.jobDescription || ''),
      licenseImage: resolvedLicenseUrl,
      envImages: normalizePersistedImageList(description?.workEnvImages),
      auditSubmitted: true,
      auditStatusText: mapAuditStatusText(latestBase?.auditStatus),
      error: '',
    });
  },

  async loadBossPayrollBoard() {
    const currentUser = wx.getStorageSync('userInfo') || app.getCurrentUser() || {};
    const ownerId = Number(currentUser.id || currentUser.userId || 0);
    const dateFrom = this.data.payrollDateFrom || monthStartString();
    const dateTo = this.data.payrollDateTo || todayString();

    if (dateFrom && dateTo && dateFrom > dateTo) {
      wx.showToast({
        title: '开始日期不能晚于结束日期',
        icon: 'none',
      });
      return;
    }

    if (!ownerId) {
      this.setData({
        canShowPayrollSection: false,
        payrollBases: [],
        payrollBaseIndex: 0,
        payrollBaseId: '',
        payrollRows: [],
        payrollSummary: emptyPayrollSummary(),
      });
      return;
    }

    this.setData({ payrollLoading: true });
    try {
      const baseRes = await app.request({
        url: `/base?ownerId=${ownerId}&showAll=1`,
        method: 'GET',
      }).catch(() => []);

      const baseList = normalizeArray(baseRes);
      const approvedBaseList = baseList.filter((item) => Number(item?.auditStatus ?? item?.audit_status) === 1);
      const canShowPayrollSection = approvedBaseList.length > 0;

      const payrollBases = approvedBaseList.map((item) => ({
        id: String(item.id),
        baseName: item.baseName || item.name || `基地#${item.id}`,
      }));

      let payrollBaseIndex = Number(this.data.payrollBaseIndex || 0);
      if (payrollBaseIndex >= payrollBases.length) payrollBaseIndex = 0;
      const selectedBase = payrollBases[payrollBaseIndex] || null;

      if (!selectedBase) {
        this.setData({
          canShowPayrollSection,
          payrollBases,
          payrollBaseIndex,
          payrollBaseId: '',
          payrollRows: [],
          payrollSummary: emptyPayrollSummary(),
          payrollReportGeneratedAtText: '',
          payrollReportFileName: '',
        });
        return;
      }

      const salaryRes = await app.request({
        url: `/salary/list?baseId=${encodeURIComponent(selectedBase.id)}&dateFrom=${encodeURIComponent(dateFrom)}&dateTo=${encodeURIComponent(dateTo)}`,
        method: 'GET',
      }).catch(() => ({ list: [] }));

      const reportRes = await app.request({
        url: `/salary/reports/submitted?baseId=${encodeURIComponent(selectedBase.id)}&dateFrom=${encodeURIComponent(dateFrom)}&dateTo=${encodeURIComponent(dateTo)}`,
        method: 'GET',
      }).catch(() => []);

      let pendingCount = 0;
      let confirmedCount = 0;
      let paidCount = 0;
      let totalAmount = 0;

      const payrollRows = normalizeArray(salaryRes).map((item) => {
        const status = safeNumber(item.status, 0);
        const amount = safeNumber(item.totalAmount, 0);
        totalAmount += amount;
        if (status === 0) pendingCount += 1;
        if (status === 1) confirmedCount += 1;
        if (status === 2) paidCount += 1;

        return {
          id: item.id,
          status,
          canSettle: status === 1,
          workerName: item.workerName || '-',
          workerUid: item.workerUid || '-',
          baseName: item.baseName || selectedBase.baseName || '-',
          jobTitle: item.jobTitle || '-',
          workDate: item.workDate || '-',
          amountText: formatAmount(amount),
          statusText: payrollStatusText(status),
          statusClass: payrollStatusClass(status),
          volumeText: payrollVolumeText(item),
          createdAtText: item.createdAt ? String(item.createdAt).replace('T', ' ').slice(0, 19) : '-',
        };
      });

      const latestReport = normalizeArray(reportRes)[0] || null;

      this.setData({
        canShowPayrollSection,
        payrollBases,
        payrollBaseIndex,
        payrollBaseId: selectedBase.id,
        payrollRows,
        payrollSummary: {
          totalRecords: payrollRows.length,
          pendingCount,
          confirmedCount,
          paidCount,
          totalAmount: formatAmount(totalAmount),
        },
        payrollReportGeneratedAtText: latestReport ? formatDateTimeText(latestReport.createdAt) : '',
        payrollReportFileName: latestReport?.fileName || '',
      });
    } catch (err) {
      wx.showToast({
        title: extractErrorMessage(err, '加载工资情况失败'),
        icon: 'none',
      });
    } finally {
      this.setData({ payrollLoading: false });
    }
  },

  onPayrollBaseChange(e) {
    this.setData({
      payrollBaseIndex: Number(e.detail.value || 0),
    });
    this.loadBossPayrollBoard();
  },

  onPayrollDateFromChange(e) {
    this.setData({
      payrollDateFrom: e.detail.value,
    });
    this.loadBossPayrollBoard();
  },

  onPayrollDateToChange(e) {
    this.setData({
      payrollDateTo: e.detail.value,
    });
    this.loadBossPayrollBoard();
  },

  async pickSettlementMethod() {
    return new Promise((resolve) => {
      wx.showActionSheet({
        itemList: ['银行卡转账', '现金发放'],
        success: (res) => resolve(res.tapIndex === 1 ? 'cash' : 'transfer'),
        fail: () => resolve(''),
      });
    });
  },

  async settleConfirmedPayrolls() {
    const rows = (this.data.payrollRows || []).filter((item) => item && item.canSettle);
    if (!rows.length) {
      wx.showToast({
        title: '当前没有待老板结算的工资单',
        icon: 'none',
      });
      return;
    }

    const paymentMethod = await this.pickSettlementMethod();
    if (!paymentMethod) return;

    const paymentMethodText = paymentMethod === 'cash' ? '现金发放' : '银行卡转账';
    wx.showModal({
      title: '批量结算工资',
      content: `将使用${paymentMethodText}结算 ${rows.length} 笔工人已确认工资，是否继续？`,
      success: async (res) => {
        if (!res.confirm) return;

        this.setData({ payrollSettling: true });
        wx.showLoading({
          title: '结算中...',
          mask: true,
        });

        let successCount = 0;
        let failedCount = 0;
        const failedNames = [];
        let syncResult = null;
        let syncFailedMessage = '';

        try {
          for (let i = 0; i < rows.length; i += 1) {
            const row = rows[i] || {};
            try {
              await app.request({
                url: `/salary/${row.id}/settle`,
                method: 'POST',
                data: { paymentMethod },
              });
              successCount += 1;
            } catch (_) {
              failedCount += 1;
              if (failedNames.length < 5) {
                failedNames.push(row.workerName || `salary-${row.id}`);
              }
            }
          }

          if (successCount > 0) {
            try {
              syncResult = await this.syncPayrollReportSnapshot({ silent: true });
            } catch (err) {
              syncFailedMessage = extractErrorMessage(err, '工资表自动同步失败');
            }
          }

          await this.loadBossPayrollBoard();

          const failedHint = failedNames.length ? `\n失败示例：${failedNames.join('、')}` : '';
          const syncHint = successCount <= 0
            ? ''
            : syncResult
              ? `\n系统已自动生成工资表：${syncResult.fileName || '-'}`
              : `\n工资已结算，但工资表自动同步失败${syncFailedMessage ? `：${syncFailedMessage}` : ''}`;
          wx.showModal({
            title: '工资结算完成',
            content: `成功 ${successCount} 笔，失败 ${failedCount} 笔。${failedHint}${syncHint}`,
            showCancel: false,
          });
        } finally {
          wx.hideLoading();
          this.setData({ payrollSettling: false });
        }
      },
    });
  },

  async syncPayrollReportSnapshot(options = {}) {
    const { silent = false } = options;
    const selectedBase = this.data.payrollBases[this.data.payrollBaseIndex] || null;
    if (!selectedBase?.id) {
      return null;
    }

    const rangeText = buildPayrollRangeText(this.data.payrollDateFrom, this.data.payrollDateTo);
    const res = await app.request({
      url: '/salary/reports/submit',
      method: 'POST',
      data: {
        baseId: Number(selectedBase.id),
        dateFrom: this.data.payrollDateFrom,
        dateTo: this.data.payrollDateTo,
      },
    });

    this.setData({
      payrollReportGeneratedAtText: formatDateTimeText(res?.updatedAt || res?.createdAt || new Date()),
      payrollReportFileName: res?.fileName || `salary-report-${rangeText}.xlsx`,
    });

    if (!silent) {
      wx.showToast({
        title: '工资表已自动同步',
        icon: 'success',
      });
    }

    return res;
  },

  refreshPayrollBoard() {
    this.loadBossPayrollBoard();
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
      const hasOwnedBase = Number(this.data.ownedBaseId || 0) > 0;
      const res = await app.request({
        url: hasOwnedBase ? `/base/${Number(this.data.ownedBaseId)}` : '/base',
        method: hasOwnedBase ? 'PATCH' : 'POST',
        data: payload,
      });

      this.setData({
        submitting: false,
        ownedBaseId: Number(res?.id || this.data.ownedBaseId || 0),
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
              ownedBaseId: Number(updated?.id || this.data.ownedBaseId || 0),
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

  goToApplicants() {
    wx.navigateTo({ url: '/pages/boss/applicants/applicants' });
  },

  goToBaseList() {
    wx.switchTab({ url: '/pages/base/list/list' });
  },

  goToJobList() {
    wx.switchTab({ url: '/pages/job/list/list' });
  },
});
