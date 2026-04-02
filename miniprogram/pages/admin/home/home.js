/**
 * Layer: Mini Program Page
 * Responsibility: Provides role-based admin home experiences for field, base, and super administrators.
 */
const app = getApp();
const { resolveRole, isAdminRole, roleLabel } = require('../../../utils/role');

const SUPER_ROLE_OPTIONS = [
  { label: 'All Users', value: '' },
  { label: 'Boss', value: 'boss' },
  { label: 'Field Manager', value: 'field_manager' },
  { label: 'Base Manager', value: 'base_manager' },
  { label: 'Worker', value: 'worker' },
];

function todayString() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function nowMinuteString() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day} ${hh}:${mm}`;
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

function normalizeArray(res) {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.list)) return res.list;
  if (Array.isArray(res?.records)) return res.records;
  if (Array.isArray(res?.bases)) return res.bases;
  return [];
}

function attendanceText(status) {
  if (status === 1) return 'checked_in';
  if (status === 2) return 'absent';
  if (status === 3) return 'cancelled';
  if (status === 0) return 'signed_up';
  return 'not_checked_in';
}

function attendanceChip(status) {
  if (status === 1) return 'success';
  if (status === 2) return 'danger';
  if (status === 0) return 'pending';
  return 'info';
}

function salaryText(status) {
  if (status === 2) return 'paid';
  if (status === 1) return 'confirmed';
  if (status === 0) return 'pending';
  return 'none';
}

function salaryChip(status) {
  if (status === 2) return 'success';
  if (status === 1) return 'info';
  if (status === 0) return 'pending';
  return 'danger';
}

function auditText(status) {
  if (status === 1) return 'approved';
  if (status === 2) return 'rejected';
  return 'pending';
}

function fieldAppStatusText(status) {
  if (status === 1) return '已录用';
  if (status === 2) return '已拒绝';
  if (status === 3) return '已取消';
  return '待处理';
}

function fieldAppStatusChip(status) {
  if (status === 1) return 'success';
  if (status === 2) return 'danger';
  if (status === 0) return 'pending';
  return 'info';
}

function parseBirthFromIdCard(idCard) {
  const text = String(idCard || '').trim().toUpperCase();
  if (!/^\d{17}[\dX]$/.test(text) && !/^\d{15}$/.test(text)) return null;

  if (text.length === 18) {
    const year = Number(text.slice(6, 10));
    const month = Number(text.slice(10, 12));
    const day = Number(text.slice(12, 14));
    if (!year || !month || !day) return null;
    return { year, month, day };
  }

  const yy = Number(text.slice(6, 8));
  const month = Number(text.slice(8, 10));
  const day = Number(text.slice(10, 12));
  if (!month || !day) return null;
  return { year: 1900 + yy, month, day };
}

function inferGenderText(rawGender, idCard) {
  const normalized = String(rawGender || '').trim().toLowerCase();
  if (['male', 'm', 'man', 'boy', '男'].includes(normalized)) return '男';
  if (['female', 'f', 'woman', 'girl', '女'].includes(normalized)) return '女';

  const text = String(idCard || '').trim().toUpperCase();
  if (/^\d{17}[\dX]$/.test(text)) {
    const code = Number(text.charAt(16));
    if (!Number.isNaN(code)) return code % 2 === 1 ? '男' : '女';
  }
  if (/^\d{15}$/.test(text)) {
    const code = Number(text.charAt(14));
    if (!Number.isNaN(code)) return code % 2 === 1 ? '男' : '女';
  }
  return '-';
}

function inferAgeText(rawAge, idCard) {
  const numericAge = Number(rawAge);
  if (Number.isFinite(numericAge) && numericAge > 0) {
    return String(Math.floor(numericAge));
  }

  const birth = parseBirthFromIdCard(idCard);
  if (!birth) return '-';

  const now = new Date();
  let age = now.getFullYear() - birth.year;
  const month = now.getMonth() + 1;
  const day = now.getDate();
  if (month < birth.month || (month === birth.month && day < birth.day)) {
    age -= 1;
  }
  if (!Number.isFinite(age) || age < 0 || age > 120) return '-';
  return String(age);
}

Page({
  data: {
    loading: true,
    role: 'worker',
    roleText: '',
    userInfo: null,
    activeNav: 'home',

    fieldDate: todayString(),
    fieldBases: [],
    fieldBaseIndex: 0,
    fieldBaseId: '',
    fieldBaseName: '',
    fieldBaseCards: [],
    fieldSelectedBaseId: '',
    fieldSelectedBase: null,
    fieldApplicantRows: [],
    fieldApplicantSummary: {
      total: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
      cancelled: 0,
    },
    fieldCheckedRows: [],
    fieldPendingRows: [],
    fieldFirstVisitRows: [],
    fieldScanText: '',
    fieldCheckinResult: '',
    fieldError: '',

    managedBases: [],
    managedBaseIndex: 0,
    managedBaseId: '',
    managedBaseName: '',
    managedBaseRows: [],
    managedSummary: {
      totalWorkers: 0,
      checkedIn: 0,
      withSalary: 0,
    },
    managedSyncedAt: '',

    superRoleOptions: SUPER_ROLE_OPTIONS,
    superRoleIndex: 0,
    superKeyword: '',
    superList: [],
    superStats: {},
    superTotal: 0,
  },

  onLoad() {
    if (!this.ensureAdmin()) return;
    this.loadRoleHome();
  },

  onShow() {
    if (!this.ensureAdmin()) return;
    this.loadRoleHome();
  },

  onPullDownRefresh() {
    this.loadRoleHome().finally(() => wx.stopPullDownRefresh());
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
        content: 'Current account is not an admin role.',
        showCancel: false,
        success: () => wx.switchTab({ url: '/pages/index/index' }),
      });
      return false;
    }

    this.setData({
      userInfo,
      role,
      roleText: roleLabel(role),
    });

    return true;
  },

  async fetchManagedBases() {
    const role = this.data.role;
    const userInfo = this.data.userInfo || app.getCurrentUser() || {};

    if (role === 'base_manager' || role === 'field_manager') {
      const managed = await app.request({ url: '/base/managed', method: 'GET' }).catch(() => []);
      const managedBases = normalizeArray(managed).map((item) => ({
        id: String(item.id),
        baseName: item.baseName || item.name || `基地 #${item.id}`,
      }));
      if (managedBases.length) {
        return managedBases;
      }
    }

    if (role === 'base_manager') {
      const fallback = await app.request({ url: `/base?ownerId=${userInfo.id}`, method: 'GET' }).catch(() => []);
      return normalizeArray(fallback).map((item) => ({
        id: String(item.id),
        baseName: item.baseName || item.name || `基地 #${item.id}`,
      }));
    }

    if (role === 'field_manager') {
      if (userInfo.assignedBaseId) {
        return [{ id: String(userInfo.assignedBaseId), baseName: `基地 #${userInfo.assignedBaseId}` }];
      }

      const profile = await app.request({ url: '/user/profile', method: 'GET' }).catch(() => null);
      if (profile?.assignedBaseId) {
        const merged = Object.assign({}, userInfo, { assignedBaseId: profile.assignedBaseId });
        wx.setStorageSync('userInfo', merged);
        app.globalData.userInfo = merged;
        this.setData({ userInfo: merged });
        return [{ id: String(profile.assignedBaseId), baseName: `基地 #${profile.assignedBaseId}` }];
      }
    }

    return [];
  },

  async resolveAssignedBaseId() {
    const userInfo = this.data.userInfo || app.getCurrentUser() || {};
    const bases = await this.fetchManagedBases();
    if (!bases.length) {
      this.setData({
        fieldBases: [],
        fieldBaseIndex: 0,
        fieldBaseId: '',
        fieldBaseName: '',
      });
      return '';
    }

    const preferredIds = [
      this.data.fieldBaseId,
      wx.getStorageSync('adminFieldBaseId'),
      userInfo.assignedBaseId ? String(userInfo.assignedBaseId) : '',
    ].filter(Boolean);

    let index = 0;
    const preferredId = preferredIds[0];
    if (preferredId) {
      const foundIndex = bases.findIndex((item) => item.id === String(preferredId));
      if (foundIndex >= 0) index = foundIndex;
    }

    const selected = bases[index] || bases[0];
    wx.setStorageSync('adminFieldBaseId', selected.id);
    this.setData({
      fieldBases: bases,
      fieldBaseIndex: index,
      fieldBaseId: selected.id,
      fieldBaseName: selected.baseName,
    });
    return selected.id;
  },

  async loadRoleHome() {
    this.setData({ loading: true });
    try {
      const role = this.data.role;
      if (role === 'field_manager') {
        await this.loadFieldHome();
      } else if (role === 'base_manager') {
        await this.loadBaseManagerHome();
      } else {
        await this.loadSuperAdminHome();
      }
    } finally {
      this.setData({ loading: false });
    }
  },

  async loadFieldHomeLegacy() {
    const baseId = await this.resolveAssignedBaseId();
    if (!baseId) {
      this.setData({
        fieldError: 'Current account is not bound to a base.',
        fieldBaseId: '',
        fieldBaseName: '',
        fieldCheckedRows: [],
        fieldPendingRows: [],
        fieldFirstVisitRows: [],
      });
      return;
    }

    const date = this.data.fieldDate || todayString();
    const [baseRes, appsRes, recordsRes] = await Promise.all([
      app.request({ url: `/base/${baseId}`, method: 'GET' }).catch(() => null),
      app.request({ url: `/base/${baseId}/applications`, method: 'GET' }).catch(() => []),
      app.request({ url: `/attendance/records?baseId=${baseId}&date=${date}`, method: 'GET' }).catch(() => []),
    ]);

    const applications = normalizeArray(appsRes);
    const records = normalizeArray(recordsRes);

    const approvedApps = applications.filter((item) => Number(item.status) === 1);
    const approvedByUser = {};
    for (let i = 0; i < approvedApps.length; i += 1) {
      const row = approvedApps[i] || {};
      const userId = String(row.userId || row.user?.id || '');
      if (userId) approvedByUser[userId] = row;
    }

    const checkedRows = [];
    const checkedByUser = {};
    const firstVisitRows = [];

    for (let i = 0; i < records.length; i += 1) {
      const row = records[i] || {};
      const status = Number(row.status);
      const user = row.user || {};
      const userId = String(row.userId || user.id || '');
      const uid = user.uid || row.workerUid || '';
      const name = user.name || row.workerName || 'Unknown Worker';
      const trace = `UID: ${uid || '-'} | 报名记录: ${row.id || '-'} | 状态: ${attendanceText(status)}`;
      const packed = {
        key: `record-${row.id || i}`,
        userId,
        uid,
        name,
        trace,
        checkinTime: formatDateTime(row.checkinTime || row.createdAt),
      };

      if (status === 1) {
        checkedRows.push(packed);
        if (userId) checkedByUser[userId] = true;
      }

      if (status !== 1 || (userId && !approvedByUser[userId])) {
        firstVisitRows.push(Object.assign({}, packed, {
          trace: `${trace} | Type: first_visit_or_offline_checkin`,
        }));
      }
    }

    const pendingRows = approvedApps
      .filter((item) => {
        const userId = String(item.userId || item.user?.id || '');
        return userId && !checkedByUser[userId];
      })
      .map((item, index) => {
        const user = item.user || {};
        const uid = user.uid || '';
        const name = user.name || item.workerName || 'Pending Worker';
        return {
          key: `pending-${item.id || index}`,
          uid,
          name,
          trace: `UID: ${uid || '-'} | ApplyID: ${item.id || '-'} | approved_waiting_checkin`,
          checkinTime: '-',
        };
      });

    this.setData({
      fieldError: '',
      fieldBaseId: String(baseId),
      fieldBaseName: baseRes?.baseName || baseRes?.name || `基地 #${baseId}`,
      fieldCheckedRows: checkedRows,
      fieldPendingRows: pendingRows,
      fieldFirstVisitRows: firstVisitRows,
      fieldCheckinResult: '',
    });
  },

  onFieldDateChange(e) {
    this.setData({ fieldDate: e.detail.value });
    this.loadFieldHome();
  },

  onFieldScanInput(e) {
    this.setData({ fieldScanText: e.detail.value });
  },

  async scanFieldCheckin() {
    try {
      const scanRes = await new Promise((resolve, reject) => {
        wx.scanCode({
          onlyFromCamera: true,
          scanType: ['qrCode', 'barCode'],
          success: resolve,
          fail: reject,
        });
      });

      this.setData({ fieldScanText: scanRes.result || '' });
      this.submitFieldCheckin();
    } catch (_) {
      wx.showToast({ title: 'Scan cancelled', icon: 'none' });
    }
  },

  async submitFieldCheckin() {
    const baseId = this.data.fieldBaseId;
    const qrContent = String(this.data.fieldScanText || '').trim();

    if (!baseId) {
      wx.showToast({ title: 'Base not bound', icon: 'none' });
      return;
    }
    if (!qrContent) {
      wx.showToast({ title: 'Scan code or input first', icon: 'none' });
      return;
    }

    try {
      const res = await app.request({
        url: '/attendance/checkin',
        method: 'POST',
        data: {
          qrContent,
          baseId: Number(baseId),
        },
      });

      const displayName = res?.user?.name || res?.workerName || 'Worker';
      this.setData({
        fieldScanText: '',
        fieldCheckinResult: `${displayName} check-in success | ${formatDateTime(res?.checkinTime || new Date().toISOString())}`,
      });
      wx.showToast({ title: 'Check-in success', icon: 'success' });
      this.loadFieldHome();
    } catch (err) {
      wx.showToast({ title: err.message || 'Check-in failed', icon: 'none' });
    }
  },

  async exportFieldSheet() {
    const baseId = String(this.data.fieldBaseId || '').trim();
    const workDate = this.data.fieldDate || todayString();

    if (!baseId) {
      wx.showToast({ title: 'Current base is not bound', icon: 'none' });
      return;
    }

    const url = `/attendance/export/records?date=${encodeURIComponent(workDate)}&baseId=${encodeURIComponent(baseId)}`;
    wx.showLoading({ title: '导出中...', mask: true });
    try {
      const res = await app.exportXlsx({
        url,
        method: 'GET',
        fileName: `考勤明细-${workDate}.xlsx`,
      });
      wx.showToast({ title: 'Export success', icon: 'success' });
      if (res?.filePath) {
        console.log('[export] field attendance xlsx file =', res.filePath);
      }
    } catch (err) {
      wx.showToast({ title: err.message || '导出失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },
  async loadBaseManagerHome() {
    const bases = await this.fetchManagedBases();

    if (!bases.length) {
      this.setData({
        managedBases: [],
        managedBaseIndex: 0,
        managedBaseId: '',
        managedBaseName: '',
        managedBaseRows: [],
        managedSummary: {
          totalWorkers: 0,
          checkedIn: 0,
          withSalary: 0,
        },
        managedSyncedAt: nowMinuteString(),
      });
      return;
    }

    let index = this.data.managedBaseIndex || 0;
    if (index >= bases.length) index = 0;
    const selected = bases[index];

    this.setData({
      managedBases: bases,
      managedBaseIndex: index,
      managedBaseId: selected.id,
      managedBaseName: selected.baseName,
    });

    await this.loadManagedBaseRows(selected.id, selected.baseName);
  },

  async loadManagedBaseRows(baseId, baseName) {
    const date = todayString();
    const [appsRes, recordsRes, salaryRes] = await Promise.all([
      app.request({ url: `/base/${baseId}/applications?status=1`, method: 'GET' }).catch(() => []),
      app.request({ url: `/attendance/records?baseId=${baseId}&date=${date}`, method: 'GET' }).catch(() => []),
      app.request({ url: `/salary/list?baseId=${baseId}&dateFrom=${date}&dateTo=${date}`, method: 'GET' }).catch(() => ({ list: [] })),
    ]);

    const applications = normalizeArray(appsRes);
    const records = normalizeArray(recordsRes);
    const salaries = normalizeArray(salaryRes);

    const attendanceByUserId = {};
    for (let i = 0; i < records.length; i += 1) {
      const row = records[i] || {};
      const userId = String(row.userId || row.user?.id || '');
      if (userId) attendanceByUserId[userId] = row;
    }

    const salaryByUid = {};
    for (let i = 0; i < salaries.length; i += 1) {
      const row = salaries[i] || {};
      const uid = String(row.workerUid || '').trim();
      if (uid) salaryByUid[uid] = row;
    }

    const cards = applications.map((item, idx) => {
      const user = item.user || {};
      const userId = String(item.userId || user.id || '');
      const uid = user.uid || '';
      const attendance = attendanceByUserId[userId] || null;
      const salary = salaryByUid[uid] || null;

      const attendanceStatus = attendance ? Number(attendance.status) : -1;
      const salaryStatus = salary ? Number(salary.status) : -1;

      return {
        key: `worker-${item.id || idx}`,
        expanded: false,
        name: user.name || item.workerName || 'Unknown Worker',
        uid,
        trace: `报名ID: ${item.id || '-'} | 手机: ${user.phone || '-'} | 身份证: ${user.idCard || '-'}`,
        attendanceStatusText: attendanceText(attendanceStatus),
        attendanceChipType: attendanceChip(attendanceStatus),
        checkinTime: formatDateTime(attendance?.checkinTime || attendance?.createdAt),
        salaryStatusText: salaryText(salaryStatus),
        salaryChipType: salaryChip(salaryStatus),
        salaryAmount: salary ? Number(salary.totalAmount || 0).toFixed(2) : '0.00',
      };
    });

    this.setData({
      managedBaseId: String(baseId),
      managedBaseName: baseName,
      managedBaseRows: cards,
      managedSummary: {
        totalWorkers: cards.length,
        checkedIn: cards.filter((item) => item.attendanceStatusText === 'checked_in').length,
        withSalary: cards.filter((item) => item.salaryStatusText !== 'none').length,
      },
      managedSyncedAt: nowMinuteString(),
    });
  },

  onManagedBaseChange(e) {
    const index = Number(e.detail.value);
    const picked = this.data.managedBases[index];
    if (!picked) return;

    this.setData({
      managedBaseIndex: index,
      managedBaseId: picked.id,
      managedBaseName: picked.baseName,
    });

    this.loadManagedBaseRows(picked.id, picked.baseName);
  },

  onFieldBaseChange(e) {
    const index = Number(e.detail.value);
    const picked = this.data.fieldBases[index];
    if (!picked) return;

    wx.setStorageSync('adminFieldBaseId', picked.id);
    this.setData({
      fieldBaseIndex: index,
      fieldBaseId: picked.id,
      fieldBaseName: picked.baseName,
    });
    this.loadFieldHome();
  },

  toggleManagedWorker(e) {
    const key = e.currentTarget.dataset.key;
    const list = Array.isArray(this.data.managedBaseRows) ? this.data.managedBaseRows.slice() : [];
    const idx = list.findIndex((item) => item.key === key);
    if (idx < 0) return;
    list[idx] = Object.assign({}, list[idx], { expanded: !list[idx].expanded });
    this.setData({ managedBaseRows: list });
  },

  refreshManagedRows() {
    const baseId = this.data.managedBaseId;
    const baseName = this.data.managedBaseName;
    if (!baseId) {
      this.loadBaseManagerHome();
      return;
    }
    this.loadManagedBaseRows(baseId, baseName);
  },

  onSuperRoleChange(e) {
    this.setData({ superRoleIndex: Number(e.detail.value) });
    this.loadSuperAdminHome();
  },

  onSuperKeywordInput(e) {
    this.setData({ superKeyword: e.detail.value });
  },

  searchSuperUsers() {
    this.loadSuperAdminHome();
  },

  async loadSuperAdminHome() {
    const roleFilter = this.data.superRoleOptions[this.data.superRoleIndex]?.value || '';
    const keyword = String(this.data.superKeyword || '').trim();
    const params = [];
    if (roleFilter) params.push(`role=${encodeURIComponent(roleFilter)}`);
    if (keyword) params.push(`keyword=${encodeURIComponent(keyword)}`);
    params.push('page=1');
    params.push('pageSize=80');

    const [statsRes, usersRes] = await Promise.all([
      app.request({ url: '/user/stats', method: 'GET' }).catch(() => ({})),
      app.request({ url: `/user/list?${params.join('&')}`, method: 'GET' }).catch(() => ({ list: [], total: 0 })),
    ]);

    const meId = Number(this.data.userInfo?.id || 0);
    const list = normalizeArray(usersRes).map((item) => ({
      id: Number(item.id || 0),
      name: item.name || '-',
      uid: item.uid || '-',
      roleText: roleLabel(item.roleKey || item.role || 'worker'),
      auditText: auditText(Number(item.infoAuditStatus)),
      phone: item.phone || '-',
      idCard: item.idCard || '-',
      assignedBaseId: item.assignedBaseId || '-',
      updatedAtText: formatDateTime(item.updatedAt),
      createdAtText: formatDateTime(item.createdAt),
      canDelete: Number(item.id || 0) > 0 && Number(item.id || 0) !== meId,
      expanded: false,
    }));

    this.setData({
      superStats: statsRes || {},
      superList: list,
      superTotal: Number(usersRes?.total || list.length),
    });
  },

  toggleSuperUserDetail(e) {
    const id = Number(e.currentTarget.dataset.id);
    if (!id) return;
    const list = Array.isArray(this.data.superList) ? this.data.superList.slice() : [];
    const idx = list.findIndex((item) => Number(item.id) === id);
    if (idx < 0) return;
    list[idx] = Object.assign({}, list[idx], { expanded: !list[idx].expanded });
    this.setData({ superList: list });
  },

  async deleteSuperUser(e) {
    const id = Number(e.currentTarget.dataset.id);
    if (!id) return;
    if (id === Number(this.data.userInfo?.id || 0)) {
      wx.showToast({ title: '不能删除当前登录账号', icon: 'none' });
      return;
    }

    const modalRes = await new Promise((resolve) => {
      wx.showModal({
        title: '删除人员',
        content: '删除后该人员将被归档并禁用登录，历史记录保留用于审计，是否继续？',
        success: resolve,
      });
    });
    if (!modalRes.confirm) return;

    try {
      await app.request({
        url: `/user/${id}`,
        method: 'DELETE',
      });
      wx.showToast({ title: '人员删除成功', icon: 'success' });
      await this.loadSuperAdminHome();
    } catch (err) {
      wx.showToast({ title: err.message || '删除失败', icon: 'none' });
    }
  },

  async loadFieldHome() {
    const baseId = await this.resolveAssignedBaseId();
    if (!baseId) {
      this.setData({
        fieldError: 'Current account is not bound to a base.',
        fieldBaseId: '',
        fieldBaseName: '',
        fieldBaseCards: [],
        fieldSelectedBaseId: '',
        fieldSelectedBase: null,
        fieldApplicantRows: [],
        fieldApplicantSummary: {
          total: 0,
          pending: 0,
          approved: 0,
          rejected: 0,
          cancelled: 0,
        },
        fieldCheckedRows: [],
        fieldPendingRows: [],
        fieldFirstVisitRows: [],
      });
      return;
    }

    const baseRes = await app.request({ url: `/base/${baseId}`, method: 'GET' }).catch(() => null);
    const card = {
      id: String(baseRes?.id || baseId),
      baseName: baseRes?.baseName || baseRes?.name || `Base #${baseId}`,
      auditStatus: Number(baseRes?.auditStatus),
      auditText: Number(baseRes?.auditStatus) === 1 ? '已入驻' : (Number(baseRes?.auditStatus) === 2 ? '已驳回' : '待审核'),
      auditChipType: Number(baseRes?.auditStatus) === 1 ? 'success' : (Number(baseRes?.auditStatus) === 2 ? 'danger' : 'pending'),
      contactPhone: baseRes?.contactPhone || '-',
      regionCode: baseRes?.regionCode || '-',
      address: baseRes?.address || '-',
    };

    const previousSelected = String(this.data.fieldSelectedBaseId || '');
    const selectedBaseId = previousSelected && previousSelected === card.id ? previousSelected : card.id;

    this.setData({
      fieldError: '',
      fieldBaseId: card.id,
      fieldBaseName: card.baseName,
      fieldBaseCards: [card],
      fieldSelectedBaseId: selectedBaseId,
      fieldCheckinResult: '',
    });

    await this.loadFieldBaseDetail(selectedBaseId);
  },

  async loadFieldBaseDetail(baseId) {
    const selectedBaseId = String(baseId || '').trim();
    if (!selectedBaseId) return;

    const date = this.data.fieldDate || todayString();
    const [baseRes, appsRes, recordsRes] = await Promise.all([
      app.request({ url: `/base/${selectedBaseId}`, method: 'GET' }).catch(() => null),
      app.request({ url: `/base/${selectedBaseId}/applications`, method: 'GET' }).catch(() => []),
      app.request({ url: `/attendance/records?baseId=${selectedBaseId}&date=${date}`, method: 'GET' }).catch(() => []),
    ]);

    const selectedBase = {
      id: String(baseRes?.id || selectedBaseId),
      baseName: baseRes?.baseName || baseRes?.name || `Base #${selectedBaseId}`,
      auditText: Number(baseRes?.auditStatus) === 1 ? '已入驻' : (Number(baseRes?.auditStatus) === 2 ? '已驳回' : '待审核'),
      contactPhone: baseRes?.contactPhone || '-',
      regionCode: baseRes?.regionCode || '-',
      address: baseRes?.address || '-',
      description: baseRes?.description || '-',
      createdAtText: formatDateTime(baseRes?.createdAt),
      updatedAtText: formatDateTime(baseRes?.updatedAt),
    };

    const apps = normalizeArray(appsRes);
    const summary = {
      total: apps.length,
      pending: 0,
      approved: 0,
      rejected: 0,
      cancelled: 0,
    };

    const applicantRows = apps.map((item, idx) => {
      const user = item.user || {};
      const idCard = user.idCard || '';
      const status = Number(item.status);
      if (status === 0) summary.pending += 1;
      if (status === 1) summary.approved += 1;
      if (status === 2) summary.rejected += 1;
      if (status === 3) summary.cancelled += 1;

      return {
        key: `field-app-${item.id || idx}`,
        id: Number(item.id || 0),
        name: user.name || item.workerName || '-',
        uid: user.uid || '-',
        phone: user.phone || '-',
        genderText: inferGenderText(user.gender || user.sex, idCard),
        ageText: inferAgeText(user.age, idCard),
        statusText: fieldAppStatusText(status),
        statusChipType: fieldAppStatusChip(status),
        jobTitle: item.job?.jobTitle || item.jobTitle || '-',
        applyTimeText: formatDateTime(item.createdAt),
      };
    });

    const approvedApps = apps.filter((item) => Number(item.status) === 1);
    const approvedByUser = {};
    for (let i = 0; i < approvedApps.length; i += 1) {
      const row = approvedApps[i] || {};
      const userId = String(row.userId || row.user?.id || '');
      if (userId) approvedByUser[userId] = row;
    }

    const records = normalizeArray(recordsRes);
    const checkedRows = [];
    const checkedByUser = {};
    const firstVisitRows = [];

    for (let i = 0; i < records.length; i += 1) {
      const row = records[i] || {};
      const status = Number(row.status);
      const user = row.user || {};
      const userId = String(row.userId || user.id || '');
      const uid = user.uid || row.workerUid || '';
      const name = user.name || row.workerName || 'Unknown Worker';
      const packed = {
        key: `record-${row.id || i}`,
        userId,
        uid,
        name,
        trace: `UID: ${uid || '-'} | signupRecord: ${row.id || '-'} | status: ${attendanceText(status)}`,
        checkinTime: formatDateTime(row.checkinTime || row.createdAt),
      };

      if (status === 1) {
        checkedRows.push(packed);
        if (userId) checkedByUser[userId] = true;
      }

      if (status !== 1 || (userId && !approvedByUser[userId])) {
        firstVisitRows.push(Object.assign({}, packed, {
          trace: `${packed.trace} | type: first_visit_or_offline_checkin`,
        }));
      }
    }

    const pendingRows = approvedApps
      .filter((item) => {
        const userId = String(item.userId || item.user?.id || '');
        return userId && !checkedByUser[userId];
      })
      .map((item, index) => {
        const user = item.user || {};
        const uid = user.uid || '';
        const name = user.name || item.workerName || 'Pending Worker';
        return {
          key: `pending-${item.id || index}`,
          uid,
          name,
          trace: `UID: ${uid || '-'} | signupId: ${item.id || '-'} | approved_waiting_checkin`,
          checkinTime: '-',
        };
      });

    this.setData({
      fieldBaseId: selectedBase.id,
      fieldBaseName: selectedBase.baseName,
      fieldSelectedBaseId: selectedBase.id,
      fieldSelectedBase: selectedBase,
      fieldApplicantRows: applicantRows,
      fieldApplicantSummary: summary,
      fieldCheckedRows: checkedRows,
      fieldPendingRows: pendingRows,
      fieldFirstVisitRows: firstVisitRows,
      fieldError: '',
    });
  },

  async onFieldBaseCardTap(e) {
    const baseId = String(e.currentTarget.dataset.id || '').trim();
    if (!baseId) return;
    if (baseId === String(this.data.fieldSelectedBaseId || '') && this.data.fieldSelectedBase) return;
    await this.loadFieldBaseDetail(baseId);
  },

  refreshFieldAttendance() {
    const baseId = String(this.data.fieldSelectedBaseId || '').trim();
    if (!baseId) return;
    this.loadFieldBaseDetail(baseId);
  },

  goBaseCenter() {
    wx.navigateTo({ url: '/pages/admin/base/base' });
  },

  goScanCenter() {
    wx.navigateTo({ url: '/pages/admin/attendance/attendance' });
  },

  goAuditCenter() {
    wx.navigateTo({ url: '/pages/admin/users/users' });
  },

  goPayrollCenter() {
    wx.navigateTo({ url: '/pages/admin/system/system' });
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
