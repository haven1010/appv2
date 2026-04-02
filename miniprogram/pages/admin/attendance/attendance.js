/**
 * Layer: Mini Program Page
 * Responsibility: Provides assistant scan-checkin operations for management roles.
 */
const app = getApp();
const { resolveRole, isAdminRole, isSuperAdminRole, roleLabel } = require('../../../utils/role');

function todayString() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDateTime(value) {
  if (!value) return '-';
  const raw = String(value).trim();
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    return raw.replace('T', ' ').slice(0, 19);
  }
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
}

function safeNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function toCsvCell(value) {
  const text = String(value == null ? '' : value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function parseDurationFromWorkHours(workHours) {
  const text = String(workHours || '').trim();
  if (!text) return 8;

  const match = text.match(/(\d{1,2}):(\d{1,2})\s*[-~]\s*(\d{1,2}):(\d{1,2})/);
  if (!match) return 8;

  const startHour = safeNumber(match[1], 0);
  const startMinute = safeNumber(match[2], 0);
  const endHour = safeNumber(match[3], 0);
  const endMinute = safeNumber(match[4], 0);

  let start = startHour * 60 + startMinute;
  let end = endHour * 60 + endMinute;
  if (end < start) end += 24 * 60;

  const duration = (end - start) / 60;
  if (!Number.isFinite(duration) || duration <= 0) return 8;
  return Math.max(0.5, Math.round(duration * 10) / 10);
}

function normalizeArray(res) {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.list)) return res.list;
  if (Array.isArray(res?.records)) return res.records;
  if (Array.isArray(res?.bases)) return res.bases;
  return [];
}

function statusText(status) {
  if (status === 1) return 'checked_in';
  if (status === 2) return 'absent';
  if (status === 3) return 'cancelled';
  if (status === 0) return 'signed_up';
  return 'not_checked_in';
}

Page({
  data: {
    loading: true,
    checkinLoading: false,
    exportLoading: false,
    salaryDraftLoading: false,

    role: 'worker',
    roleText: '',
    canManageSalary: false,
    userInfo: null,
    activeNav: 'scan',

    selectedDate: todayString(),
    bases: [],
    baseIndex: 0,
    selectedBaseId: '',

    checkinQrContent: '',
    checkinResult: '',

    stats: {},
    records: [],
    baseStats: [],
    salarySummary: {
      totalRecords: 0,
      pendingCount: 0,
      confirmedCount: 0,
      paidCount: 0,
      totalAmount: 0,
    },
  },

  onLoad() {
    if (!this.ensureAdmin()) return;
    this.loadAll();
  },

  onShow() {
    if (!this.ensureAdmin()) return;
    this.loadAll();
  },

  onPullDownRefresh() {
    this.loadAll().finally(() => wx.stopPullDownRefresh());
  },

  ensureAdmin() {
    const token = wx.getStorageSync('token');
    const userInfo = app.getCurrentUser();
    const role = resolveRole(userInfo);

    if (!token || !userInfo) {
      wx.reLaunch({ url: '/pages/login/login' });
      return false;
    }

    if (!isAdminRole(role)) {
      wx.showModal({
        title: 'No Permission',
        content: 'This page is for admin roles only.',
        showCancel: false,
        success: () => wx.switchTab({ url: '/pages/index/index' }),
      });
      return false;
    }

    if (isSuperAdminRole(role)) {
      wx.showModal({
        title: 'Notice',
        content: 'Super admin account does not participate in scan check-in or scan-based salary statistics.',
        showCancel: false,
        success: () => wx.redirectTo({ url: '/pages/admin/system/system' }),
      });
      return false;
    }

    const canManageSalary = role === 'base_manager';
    this.setData({ role, roleText: roleLabel(role), userInfo, canManageSalary });
    return true;
  },

  async resolveAssignedBaseId() {
    const userInfo = this.data.userInfo || {};
    if (userInfo.assignedBaseId) return String(userInfo.assignedBaseId);

    const profile = await app.request({ url: '/user/profile', method: 'GET' }).catch(() => null);
    if (profile?.assignedBaseId) {
      const merged = Object.assign({}, userInfo, { assignedBaseId: profile.assignedBaseId });
      wx.setStorageSync('userInfo', merged);
      app.globalData.userInfo = merged;
      this.setData({ userInfo: merged });
      return String(profile.assignedBaseId);
    }

    return '';
  },

  async loadBaseOptions() {
    const role = this.data.role;
    const userInfo = this.data.userInfo || {};

    let bases = [];
    if (role === 'field_manager') {
      const baseId = await this.resolveAssignedBaseId();
      if (baseId) {
        const base = await app.request({ url: `/base/${baseId}`, method: 'GET' }).catch(() => null);
        if (base) {
          bases = [{ id: String(base.id || baseId), baseName: base.baseName || base.name || `閸╁搫婀?${baseId}` }];
        }
      }
    } else if (role === 'base_manager') {
      const list = await app.request({ url: `/base?ownerId=${userInfo.id}`, method: 'GET' }).catch(() => []);
      bases = normalizeArray(list).map((item) => ({
        id: String(item.id),
        baseName: item.baseName || item.name || `閸╁搫婀?${item.id}`,
      }));
    } else if (isSuperAdminRole(role)) {
      const list = await app.request({ url: '/base?showAll=true', method: 'GET' }).catch(() => []);
      bases = normalizeArray(list).map((item) => ({
        id: String(item.id),
        baseName: item.baseName || item.name || `閸╁搫婀?${item.id}`,
      }));
    }

    let baseIndex = this.data.baseIndex || 0;
    if (baseIndex >= bases.length) baseIndex = 0;
    const selected = bases[baseIndex] || null;

    this.setData({
      bases,
      baseIndex,
      selectedBaseId: selected ? selected.id : '',
    });
  },

  async loadAll() {
    this.setData({ loading: true });
    try {
      await this.loadBaseOptions();
      await this.loadAttendanceData();
    } catch (err) {
      wx.showToast({ title: err.message || '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  async loadAttendanceData() {
    const date = this.data.selectedDate;
    const baseId = this.data.selectedBaseId;

    const recordsUrl = baseId
      ? `/attendance/records?date=${date}&baseId=${baseId}`
      : `/attendance/records?date=${date}`;

    const [statsRes, recordsRes, baseStatsRes] = await Promise.all([
      app.request({ url: `/attendance/stats?date=${date}`, method: 'GET' }).catch(() => ({})),
      app.request({ url: recordsUrl, method: 'GET' }).catch(() => []),
      app.request({ url: `/attendance/bases?date=${date}`, method: 'GET' }).catch(() => ({ bases: [] })),
    ]);

    const records = normalizeArray(recordsRes).map((item) => ({
      id: item.id,
      signupId: safeNumber(item.id, 0),
      baseId: safeNumber(item.baseId || baseId, 0),
      jobId: safeNumber(item.jobId, 0),
      status: safeNumber(item.status, -1),
      workDate: item.workDate || date,
      workerName: item.workerName || item.user?.name || '-',
      workerUid: item.workerUid || item.user?.uid || '-',
      workerPhone: item.workerPhone || item.user?.phone || '-',
      workerIdCard: item.workerIdCard || item.user?.idCard || '-',
      statusText: statusText(Number(item.status)),
      checkinTimeText: formatDateTime(item.checkinTime || item.createdAt),
      jobTitle: item.jobTitle || '-',
      baseName: item.baseName || '-',
    }));

    const baseStats = normalizeArray(baseStatsRes).map((item) => ({
      key: String(item.baseId || item.id),
      baseName: item.baseName || item.name || '-',
      present: Number(item.present || 0),
      total: Number(item.total || 0),
      attendanceRate: Number(item.attendanceRate || 0),
    }));

    this.setData({
      stats: statsRes || {},
      records,
      baseStats,
    });

    await this.loadSalarySummary(date, baseId);
  },

  async loadSalarySummary(date, baseId) {
    if (!this.data.canManageSalary || !baseId) {
      this.setData({
        salarySummary: {
          totalRecords: 0,
          pendingCount: 0,
          confirmedCount: 0,
          paidCount: 0,
          totalAmount: 0,
        },
      });
      return;
    }

    const listRes = await app.request({
      url: `/salary/list?baseId=${encodeURIComponent(baseId)}&dateFrom=${encodeURIComponent(date)}&dateTo=${encodeURIComponent(date)}`,
      method: 'GET',
    }).catch(() => ({ list: [] }));

    const rows = normalizeArray(listRes);
    let pendingCount = 0;
    let confirmedCount = 0;
    let paidCount = 0;
    let totalAmount = 0;

    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i] || {};
      const status = safeNumber(row.status, -1);
      const amount = safeNumber(row.totalAmount, 0);
      totalAmount += amount;
      if (status === 0) pendingCount += 1;
      if (status === 1) confirmedCount += 1;
      if (status === 2) paidCount += 1;
    }

    this.setData({
      salarySummary: {
        totalRecords: rows.length,
        pendingCount,
        confirmedCount,
        paidCount,
        totalAmount: Number(totalAmount.toFixed(2)),
      },
    });
  },

  onDateChange(e) {
    this.setData({ selectedDate: e.detail.value });
    this.loadAttendanceData();
  },

  onBaseChange(e) {
    const baseIndex = Number(e.detail.value);
    const picked = this.data.bases[baseIndex];
    this.setData({
      baseIndex,
      selectedBaseId: picked ? picked.id : '',
    });
    this.loadAttendanceData();
  },

  refreshSalarySummary() {
    this.loadSalarySummary(this.data.selectedDate, this.data.selectedBaseId);
  },

  onCheckinInput(e) {
    this.setData({ checkinQrContent: e.detail.value });
  },

  async scanAndCheckin() {
    try {
      const res = await new Promise((resolve, reject) => {
        wx.scanCode({
          onlyFromCamera: true,
          scanType: ['qrCode', 'barCode'],
          success: resolve,
          fail: reject,
        });
      });

      this.setData({ checkinQrContent: res.result || '' });
      this.submitCheckin();
    } catch (_) {
      wx.showToast({ title: 'Scan cancelled', icon: 'none' });
    }
  },

  async submitCheckin() {
    const baseId = this.data.selectedBaseId;
    const qrContent = String(this.data.checkinQrContent || '').trim();

    if (!baseId) {
      wx.showToast({ title: 'Please select a base first', icon: 'none' });
      return;
    }
    if (!qrContent) {
      wx.showToast({ title: '请输入或扫码二维码内容', icon: 'none' });
      return;
    }

    this.setData({ checkinLoading: true });
    try {
      const res = await app.request({
        url: '/attendance/checkin',
        method: 'POST',
        data: {
          qrContent,
          baseId: Number(baseId),
        },
      });

      const name = res?.user?.name || res?.workerName || 'Worker';
      this.setData({
        checkinQrContent: '',
        checkinResult: `${name} check-in success | ${formatDateTime(res?.checkinTime || new Date().toISOString())}`,
      });
      wx.showToast({ title: 'Check-in success', icon: 'success' });
      this.loadAttendanceData();
    } catch (err) {
      wx.showToast({ title: err.message || 'Check-in failed', icon: 'none' });
    } finally {
      this.setData({ checkinLoading: false });
    }
  },

  async exportRecords() {
    const records = this.data.records || [];
    if (!records.length) {
      wx.showToast({ title: '暂无报名/签到记录', icon: 'none' });
      return;
    }

    const date = encodeURIComponent(this.data.selectedDate || todayString());
    const baseId = this.data.selectedBaseId ? `&baseId=${encodeURIComponent(this.data.selectedBaseId)}` : '';
    const url = `/attendance/export/records?date=${date}${baseId}`;

    this.setData({ exportLoading: true });
    wx.showLoading({ title: '导出中...', mask: true });
    try {
      const res = await app.exportXlsx({
        url,
        method: 'GET',
        fileName: `考勤明细-${this.data.selectedDate || todayString()}.xlsx`,
      });
      wx.showToast({ title: '导出成功', icon: 'success' });
      if (res?.filePath) {
        console.log('[export] attendance records xlsx file =', res.filePath);
      }
    } catch (err) {
      wx.showToast({ title: err.message || '导出失败', icon: 'none' });
    } finally {
      wx.hideLoading();
      this.setData({ exportLoading: false });
    }
  },
  async exportBaseStats() {
    const list = this.data.baseStats || [];
    if (!list.length) {
      wx.showToast({ title: '暂无签到统计数据', icon: 'none' });
      return;
    }

    const date = encodeURIComponent(this.data.selectedDate || todayString());
    const url = `/attendance/export/base-stats?date=${date}`;

    wx.showLoading({ title: '导出中...', mask: true });
    try {
      const res = await app.exportXlsx({
        url,
        method: 'GET',
        fileName: `基地考勤统计-${this.data.selectedDate || todayString()}.xlsx`,
      });
      wx.showToast({ title: '导出成功', icon: 'success' });
      if (res?.filePath) {
        console.log('[export] attendance base stats xlsx file =', res.filePath);
      }
    } catch (err) {
      wx.showToast({ title: err.message || '导出失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },
  async generateSalaryDrafts() {
    if (!this.data.canManageSalary) {
      wx.showToast({ title: 'Current role cannot calculate salary', icon: 'none' });
      return;
    }

    const baseId = this.data.selectedBaseId;
    if (!baseId) {
      wx.showToast({ title: 'Please select a base first', icon: 'none' });
      return;
    }

    const checkedInRecords = (this.data.records || []).filter((item) => Number(item.status) === 1);
    if (!checkedInRecords.length) {
      wx.showToast({ title: 'No checked-in records for selected day', icon: 'none' });
      return;
    }

    this.setData({ salaryDraftLoading: true });
    wx.showLoading({ title: 'Calculating...', mask: true });

    const jobCache = {};
    let successCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    const failedNames = [];

    try {
      for (let i = 0; i < checkedInRecords.length; i += 1) {
        const record = checkedInRecords[i] || {};
        const signupId = safeNumber(record.signupId, 0);
        const jobId = safeNumber(record.jobId, 0);
        if (!signupId || !jobId) {
          skippedCount += 1;
          continue;
        }

        let job = jobCache[jobId];
        if (!job) {
          job = await app.request({
            url: `/base/jobs/${jobId}`,
            method: 'GET',
          }).catch(() => null);
          jobCache[jobId] = job;
        }

        const payType = safeNumber(job?.payType, 0);
        const payload = {};
        if (payType === 2) {
          payload.duration = parseDurationFromWorkHours(job?.workHours);
        } else if (payType === 3) {
          const targetCount = safeNumber(job?.targetCount, 0);
          payload.count = targetCount > 0 ? targetCount : 1;
        }

        try {
          await app.request({
            url: `/salary/calculate/${signupId}`,
            method: 'POST',
            data: payload,
          });
          successCount += 1;
        } catch (error) {
          const message = String(error?.message || '');
          if (/(未签到|not checked in|not_checked_in)/i.test(message)) {
            skippedCount += 1;
          } else {
            failedCount += 1;
            if (failedNames.length < 5) failedNames.push(record.workerName || `record-${signupId}`);
          }
        }
      }

      await this.loadSalarySummary(this.data.selectedDate, this.data.selectedBaseId);

      const extra = failedNames.length ? `\nFailed samples: ${failedNames.join(', ')}` : '';
      wx.showModal({
        title: 'Daily salary draft done',
        content: `success ${successCount}, skipped ${skippedCount}, failed ${failedCount}.${extra}`,
        showCancel: false,
      });
    } finally {
      wx.hideLoading();
      this.setData({ salaryDraftLoading: false });
    }
  },

  switchAdminNav(e) {
    const target = e.currentTarget.dataset.target;
    const map = {
      home: '/pages/admin/home/home',
      base: '/pages/admin/base/base',
      scan: '/pages/admin/attendance/attendance',
      audit: '/pages/admin/users/users',
      payroll: '/pages/admin/system/system',
      me: '/pages/admin/profile/profile',
    };
    const url = map[target];
    if (!url || target === this.data.activeNav) return;
    wx.redirectTo({ url });
  },
});

