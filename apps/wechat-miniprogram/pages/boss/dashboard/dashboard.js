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

function normalizeArray(res) {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.list)) return res.list;
  return [];
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

function safeNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function formatAmount(value) {
  return safeNumber(value, 0).toFixed(2);
}

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

function formatDateTimeText(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).replace('T', ' ').slice(0, 19);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
}

function buildFeeSummary(summary = {}) {
  const wageAmount = safeNumber(summary.totalAmount, 0);
  const serviceFee = Number((wageAmount * 0.03).toFixed(2));
  const channelFee = Number((wageAmount * 0.006).toFixed(2));
  const totalFee = Number((serviceFee + channelFee).toFixed(2));
  return {
    serviceRateText: '3.0%',
    channelRateText: '0.6%',
    serviceFeeText: formatAmount(serviceFee),
    channelFeeText: formatAmount(channelFee),
    totalFeeText: formatAmount(totalFee),
    payableTotalText: formatAmount(wageAmount + totalFee),
  };
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

function mapAuditStatusText(status) {
  const code = Number(status);
  if (code === 1) return '已通过';
  if (code === 2) return '已拒绝';
  return '待审核';
}

function mapBossStage(status) {
  const code = Number(status || 0);
  if (code === 1) return 'approved';
  if (code === 2) return 'rejected';
  if (code === 0) return 'pending';
  return 'unsettled';
}

function buildBossDescriptionMeta(description) {
  const meta = safeParseJson(description);
  return {
    salary: trimText(meta.salary),
    jobDescription: trimText(meta.jobDescription),
    ownerProfile: meta.ownerProfile && typeof meta.ownerProfile === 'object' ? meta.ownerProfile : {},
    companyAdminContact: meta.companyAdminContact && typeof meta.companyAdminContact === 'object'
      ? meta.companyAdminContact
      : {},
    enterpriseStage: trimText(meta.enterpriseStage || ''),
    submittedAt: trimText(meta.submittedAt || ''),
    workEnvImages: Array.isArray(meta.workEnvImages) ? meta.workEnvImages.filter(Boolean) : [],
  };
}

function buildBossDescriptionPayload(data = {}) {
  return JSON.stringify({
    ownerProfile: {
      name: trimText(data.ownerName),
      phone: normalizePhone(data.ownerPhone),
      idCardMasked: trimText(data.ownerIdCardMasked),
    },
    companyAdminContact: {
      name: trimText(data.companyAdminName),
      phone: normalizePhone(data.companyAdminPhone),
    },
    enterpriseStage: trimText(data.enterpriseStage || 'pending'),
    submittedAt: trimText(data.submittedAt || new Date().toISOString()),
    salary: '',
    jobDescription: '',
    workEnvImages: [],
    uiStyle: 'blue-white-rounded',
  });
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

async function resolveRenderableCloudUrl(fileId) {
  const target = trimText(fileId);
  if (!target) return '';
  const resolved = await app.resolveCloudFileUrl(target);
  return trimText(resolved);
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

    licenseImage: '',
    licenseImageFileId: '',
    uploadingLicense: false,
    submitting: false,
    error: '',

    bossStage: 'unsettled',
    auditSubmitted: false,
    auditStatusText: '待审核',
    ownedBaseId: 0,
    latestBaseInfo: null,

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
    feeSummary: buildFeeSummary(),
  },

  async onLoad() {
    const userInfo = wx.getStorageSync('userInfo') || {};
    const role = resolveRole(userInfo);

    if (role !== 'boss') {
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }

    this.setData({
      ownerName: trimText(userInfo.name),
      ownerPhone: normalizePhone(userInfo.phone || userInfo.mobile || ''),
      originalOwnerName: trimText(userInfo.name),
      originalOwnerPhone: normalizePhone(userInfo.phone || userInfo.mobile || ''),
      ownerIdCardMasked: userInfo.idCard ? maskIdCard(userInfo.idCard) : '',
    });

    await this.loadBaseStageData();
    await this.loadBossPayrollBoard();
  },

  async onShow() {
    await this.loadBaseStageData();
    await this.loadBossPayrollBoard();
  },

  onPullDownRefresh() {
    Promise.all([this.loadBaseStageData(), this.loadBossPayrollBoard()]).finally(() => wx.stopPullDownRefresh());
  },

  async loadBaseStageData() {
    const currentUser = wx.getStorageSync('userInfo') || app.getCurrentUser() || {};
    const ownerId = Number(currentUser.id || currentUser.userId || 0);
    if (!ownerId) return;

    const profile = await app.request({ url: '/user/profile', method: 'GET' }).catch(() => null);
    if (profile) {
      this.setData({
        ownerName: trimText(profile.name || this.data.ownerName),
        ownerPhone: normalizePhone(profile.phone || this.data.ownerPhone),
        originalOwnerName: trimText(profile.name || this.data.ownerName),
        originalOwnerPhone: normalizePhone(profile.phone || this.data.ownerPhone),
        ownerIdCardMasked: profile.idCard ? maskIdCard(profile.idCard) : this.data.ownerIdCardMasked,
      });
    }

    const list = await app.request({
      url: `/base?ownerId=${ownerId}&showAll=1`,
      method: 'GET',
    }).catch(() => []);

    const baseList = normalizeArray(list);
    if (!baseList.length) {
      this.setData({
        bossStage: 'unsettled',
        auditSubmitted: false,
        ownedBaseId: 0,
        latestBaseInfo: null,
      });
      return;
    }

    const latestBase = [...baseList].sort((a, b) => {
      const ta = new Date(a?.updatedAt || a?.createdAt || 0).getTime();
      const tb = new Date(b?.updatedAt || b?.createdAt || 0).getTime();
      return tb - ta;
    })[0];

    const meta = buildBossDescriptionMeta(latestBase.description);
    const categoryValue = Number(latestBase?.category || 1);
    const categoryIndex = CATEGORY_OPTIONS.findIndex((item) => Number(item.value) === categoryValue);
    const licenseImageFileId = trimText(latestBase.licenseUrl || '');
    const licenseImage = await resolveRenderableCloudUrl(licenseImageFileId);

    this.setData({
      ownedBaseId: Number(latestBase.id || 0),
      bossStage: mapBossStage(latestBase.auditStatus),
      auditSubmitted: true,
      auditStatusText: mapAuditStatusText(latestBase.auditStatus),
      latestBaseInfo: {
        baseName: trimText(latestBase.baseName),
        categoryText: CATEGORY_OPTIONS.find((item) => Number(item.value) === categoryValue)?.label || '其他',
        regionCode: String(latestBase.regionCode || ''),
        contactPhone: trimText(latestBase.contactPhone),
        submittedAtText: formatDateTimeText(meta.submittedAt || latestBase.createdAt),
        updatedAtText: formatDateTimeText(latestBase.updatedAt || latestBase.createdAt),
      },
      companyAdminName: trimText(meta.companyAdminContact?.name || ''),
      companyAdminPhone: normalizePhone(meta.companyAdminContact?.phone || latestBase.contactPhone || ''),
      companyName: trimText(latestBase.baseName),
      categoryIndex: categoryIndex >= 0 ? categoryIndex : 0,
      regionCode: String(latestBase.regionCode || '610100'),
      licenseImageFileId,
      licenseImage,
      error: '',
    });
  },

  async loadBossPayrollBoard() {
    if (this.data.bossStage !== 'approved') {
      this.setData({
        canShowPayrollSection: false,
        payrollBases: [],
        payrollBaseIndex: 0,
        payrollBaseId: '',
        payrollRows: [],
        payrollSummary: emptyPayrollSummary(),
        feeSummary: buildFeeSummary(),
      });
      return;
    }

    const ownerId = Number((wx.getStorageSync('userInfo') || {}).id || 0);
    if (!ownerId) return;

    this.setData({ payrollLoading: true });
    try {
      const baseRes = await app.request({
        url: `/base?ownerId=${ownerId}&showAll=1`,
        method: 'GET',
      }).catch(() => []);

      const payrollBases = normalizeArray(baseRes)
        .filter((item) => Number(item.auditStatus || 0) === 1)
        .map((item) => ({
          id: String(item.id),
          baseName: item.baseName || item.name || `基地#${item.id}`,
        }));

      if (!payrollBases.length) {
        this.setData({ canShowPayrollSection: false });
        return;
      }

      const payrollBaseIndex = Math.min(Number(this.data.payrollBaseIndex || 0), payrollBases.length - 1);
      const selectedBase = payrollBases[payrollBaseIndex];

      const salaryRes = await app.request({
        url: `/salary/list?baseId=${encodeURIComponent(selectedBase.id)}&dateFrom=${encodeURIComponent(this.data.payrollDateFrom)}&dateTo=${encodeURIComponent(this.data.payrollDateTo)}`,
        method: 'GET',
      }).catch(() => ({ list: [] }));

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
          canSettle: status === 1,
          workerName: item.workerName || '-',
          workerUid: item.workerUid || '-',
          baseName: item.baseName || selectedBase.baseName || '-',
          jobTitle: item.jobTitle || '-',
          workDate: item.workDate || '-',
          amountText: formatAmount(amount),
          statusText: status === 2 ? '已结算' : (status === 1 ? '待老板结算' : '待工人确认'),
          statusClass: status === 2 ? 'paid' : (status === 1 ? 'confirmed' : 'pending'),
          volumeText: item.pieceCount > 0 ? `计件 ${item.pieceCount}` : (item.workDuration > 0 ? `工时 ${item.workDuration}h` : '固定日薪'),
          createdAtText: item.createdAt ? String(item.createdAt).replace('T', ' ').slice(0, 19) : '-',
        };
      });

      const payrollSummary = {
        totalRecords: payrollRows.length,
        pendingCount,
        confirmedCount,
        paidCount,
        totalAmount: formatAmount(totalAmount),
      };

      this.setData({
        canShowPayrollSection: true,
        payrollBases,
        payrollBaseIndex,
        payrollBaseId: selectedBase.id,
        payrollRows,
        payrollSummary,
        feeSummary: buildFeeSummary(payrollSummary),
      });
    } finally {
      this.setData({ payrollLoading: false });
    }
  },

  onFieldInput(e) {
    const field = e.currentTarget.dataset.field;
    const raw = e.detail.value;
    const value = ['ownerPhone', 'companyAdminPhone'].includes(field) ? normalizePhone(raw) : raw;
    this.setData({ [field]: value, error: '' });
  },

  onCategoryChange(e) {
    this.setData({ categoryIndex: Number(e.detail.value || 0), error: '' });
  },

  async chooseLicenseImage() {
    if (this.data.uploadingLicense) return;
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      success: async (res) => {
        const file = res?.tempFiles?.[0];
        if (!file?.tempFilePath) return;

        this.setData({ uploadingLicense: true });
        try {
          const uploaded = await app.upload({ filePath: file.tempFilePath, url: '/base/upload/image', name: 'file' });
          const fileId = trimText(uploaded?.url || uploaded?.fileId || '');
          const previewUrl = await resolveRenderableCloudUrl(fileId);
          this.setData({
            licenseImageFileId: fileId,
            licenseImage: previewUrl,
            error: '',
          });
        } catch (error) {
          this.setData({ error: extractErrorMessage(error, '营业执照上传失败，请重试') });
        } finally {
          this.setData({ uploadingLicense: false });
        }
      },
    });
  },

  validateForm() {
    if (!trimText(this.data.ownerName)) return '请填写老板姓名';
    if (normalizePhone(this.data.ownerPhone).length !== 11) return '请输入正确的老板手机号';
    if (!trimText(this.data.companyAdminName)) return '请填写公司管理员姓名';
    if (normalizePhone(this.data.companyAdminPhone).length !== 11) return '请输入正确的公司管理员手机号';
    if (!trimText(this.data.companyName)) return '请填写企业名称';
    if (!trimText(this.data.regionCode)) return '请填写区域编码';
    if (!this.data.licenseImageFileId) return '请上传营业执照';
    return '';
  },

  async submitForAudit() {
    const error = this.validateForm();
    if (error) {
      this.setData({ error });
      return;
    }

    this.setData({ submitting: true, error: '' });
    try {
      const payload = {
        baseName: trimText(this.data.companyName),
        licenseUrl: trimText(this.data.licenseImageFileId),
        contactPhone: normalizePhone(this.data.companyAdminPhone),
        category: this.data.categoryOptions[this.data.categoryIndex]?.value || 1,
        regionCode: Number(this.data.regionCode || 0),
        address: '',
        description: buildBossDescriptionPayload({
          ownerName: this.data.ownerName,
          ownerPhone: this.data.ownerPhone,
          ownerIdCardMasked: this.data.ownerIdCardMasked,
          companyAdminName: this.data.companyAdminName,
          companyAdminPhone: this.data.companyAdminPhone,
          enterpriseStage: 'pending',
          submittedAt: new Date().toISOString(),
        }),
      };

      let res = null;
      if (this.data.ownedBaseId) {
        res = await app.request({
          url: `/base/${Number(this.data.ownedBaseId)}`,
          method: 'PATCH',
          data: payload,
        });
      } else {
        res = await app.request({
          url: '/base',
          method: 'POST',
          data: payload,
        });
      }

      this.setData({
        ownedBaseId: Number(res?.id || this.data.ownedBaseId || 0),
        bossStage: 'pending',
        auditSubmitted: true,
        auditStatusText: mapAuditStatusText(res?.auditStatus),
        latestBaseInfo: {
          baseName: payload.baseName,
          categoryText: this.data.categoryOptions[this.data.categoryIndex]?.label || '其他',
          regionCode: String(payload.regionCode || ''),
          contactPhone: payload.contactPhone,
          submittedAtText: formatDateTimeText(new Date().toISOString()),
          updatedAtText: formatDateTimeText(new Date().toISOString()),
        },
      });

      wx.showToast({ title: '已提交审核', icon: 'success' });
    } catch (requestError) {
      this.setData({ error: extractErrorMessage(requestError) });
      wx.showToast({ title: extractErrorMessage(requestError), icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  },

  onPayrollBaseChange(e) {
    this.setData({ payrollBaseIndex: Number(e.detail.value || 0) });
    this.loadBossPayrollBoard();
  },

  onPayrollDateFromChange(e) {
    this.setData({ payrollDateFrom: e.detail.value });
    this.loadBossPayrollBoard();
  },

  onPayrollDateToChange(e) {
    this.setData({ payrollDateTo: e.detail.value });
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
      wx.showToast({ title: '当前没有待老板结算的工资单', icon: 'none' });
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
        try {
          for (let i = 0; i < rows.length; i += 1) {
            const row = rows[i] || {};
            await app.request({
              url: `/salary/${row.id}/settle`,
              method: 'POST',
              data: { paymentMethod },
            }).catch(() => null);
          }
          await this.loadBossPayrollBoard();
          wx.showToast({ title: '工资已结算', icon: 'success' });
        } finally {
          this.setData({ payrollSettling: false });
        }
      },
    });
  },

  async syncPayrollReportSnapshot() {
    const selectedBase = this.data.payrollBases[this.data.payrollBaseIndex] || null;
    if (!selectedBase?.id) return;

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
      payrollReportFileName: res?.fileName || '',
    });

    wx.showToast({ title: '工资表已同步', icon: 'success' });
  },

  refreshPayrollBoard() {
    this.loadBossPayrollBoard();
  },

  refreshBossStage() {
    Promise.all([this.loadBaseStageData(), this.loadBossPayrollBoard()]);
  },

  goToApplicants() {
    wx.navigateTo({ url: '/pages/boss/applicants/applicants' });
  },

  goToBaseList() {
    wx.navigateTo({ url: '/pages/base/list/list' });
  },

  goToJobList() {
    wx.navigateTo({ url: '/pages/job/list/list' });
  },

  goToBossProfile() {
    wx.navigateTo({ url: '/pages/boss/profile/profile' });
  },

  logout() {
    wx.removeStorageSync('token');
    wx.removeStorageSync('userInfo');
    app.globalData.token = null;
    app.globalData.userInfo = null;
    wx.reLaunch({ url: '/pages/login/login' });
  },
});
