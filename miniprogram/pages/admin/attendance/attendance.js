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
  return String(value).replace('T', ' ').slice(0, 19);
}

function normalizeArray(res) {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.list)) return res.list;
  if (Array.isArray(res?.records)) return res.records;
  if (Array.isArray(res?.bases)) return res.bases;
  return [];
}

function statusText(status) {
  if (status === 1) return '已签到';
  if (status === 2) return '缺勤';
  if (status === 3) return '已取消';
  if (status === 0) return '已报名';
  return '未签到';
}

Page({
  data: {
    loading: true,
    checkinLoading: false,

    role: 'worker',
    roleText: '',
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
        title: '无权限',
        content: '该页面仅管理员可访问。',
        showCancel: false,
        success: () => wx.switchTab({ url: '/pages/index/index' }),
      });
      return false;
    }

    this.setData({ role, roleText: roleLabel(role), userInfo });
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
          bases = [{ id: String(base.id || baseId), baseName: base.baseName || base.name || `基地#${baseId}` }];
        }
      }
    } else if (role === 'base_manager') {
      const list = await app.request({ url: `/base?ownerId=${userInfo.id}`, method: 'GET' }).catch(() => []);
      bases = normalizeArray(list).map((item) => ({
        id: String(item.id),
        baseName: item.baseName || item.name || `基地#${item.id}`,
      }));
    } else if (isSuperAdminRole(role)) {
      const list = await app.request({ url: '/base?showAll=true', method: 'GET' }).catch(() => []);
      bases = normalizeArray(list).map((item) => ({
        id: String(item.id),
        baseName: item.baseName || item.name || `基地#${item.id}`,
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
      wx.showToast({ title: err.message || '加载签到数据失败', icon: 'none' });
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
      workerName: item.workerName || item.user?.name || '-',
      workerUid: item.workerUid || item.user?.uid || '-',
      statusText: statusText(Number(item.status)),
      checkinTimeText: formatDateTime(item.checkinTime || item.createdAt),
      jobTitle: item.jobTitle || '-',
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
      wx.showToast({ title: '扫码已取消', icon: 'none' });
    }
  },

  async submitCheckin() {
    const baseId = this.data.selectedBaseId;
    const qrContent = String(this.data.checkinQrContent || '').trim();

    if (!baseId) {
      wx.showToast({ title: '请先选择基地', icon: 'none' });
      return;
    }
    if (!qrContent) {
      wx.showToast({ title: '请输入二维码内容', icon: 'none' });
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

      const name = res?.user?.name || res?.workerName || '人员';
      this.setData({
        checkinQrContent: '',
        checkinResult: `${name} 签到成功 · ${formatDateTime(res?.checkinTime || new Date().toISOString())}`,
      });
      wx.showToast({ title: '签到成功', icon: 'success' });
      this.loadAttendanceData();
    } catch (err) {
      wx.showToast({ title: err.message || '签到失败', icon: 'none' });
    } finally {
      this.setData({ checkinLoading: false });
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