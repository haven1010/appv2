/**
 * Layer: Mini Program Page
 * Responsibility: Displays worker signup records under Profile > My Signups.
 */
const app = getApp();
const { resolveRole, isAdminRole } = require('../../../utils/role');

const STATUS_MAP = {
  0: { key: 'pending', text: '待审核', className: 'status-pending' },
  1: { key: 'approved', text: '已通过', className: 'status-ok' },
  2: { key: 'rejected', text: '已拒绝', className: 'status-warn' },
  3: { key: 'cancelled', text: '已取消', className: 'status-muted' },
};

function toStatusInfo(status) {
  const key = Number(status);
  const found = STATUS_MAP[key];
  if (found) return found;
  return { key: 'unknown', text: '未知状态', className: 'status-muted' };
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value).replace('T', ' ').slice(0, 19);
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

Page({
  data: {
    pageReady: false,
    loading: true,
    keyword: '',
    activeFilter: 'all',
    cancellingId: 0,
    filters: [
      { key: 'all', label: '全部' },
      { key: 'pending', label: '待审核' },
      { key: 'approved', label: '已通过' },
      { key: 'rejected', label: '已拒绝' },
      { key: 'cancelled', label: '已取消' },
    ],
    stats: {
      total: 0,
      signedUp: 0,
      checkedIn: 0,
    },
    records: [],
    viewRecords: [],
  },

  onLoad() {
    if (this.redirectIfRoleNotWorker()) return;
    this.loadRecords();
    this.readyTimer = setTimeout(() => {
      this.setData({ pageReady: true });
    }, 30);
  },

  onShow() {
    if (this.redirectIfRoleNotWorker()) return;
  },

  onUnload() {
    if (this.readyTimer) {
      clearTimeout(this.readyTimer);
      this.readyTimer = null;
    }
  },

  onPullDownRefresh() {
    this.loadRecords().finally(() => wx.stopPullDownRefresh());
  },

  redirectIfRoleNotWorker() {
    const userInfo = wx.getStorageSync('userInfo');
    const role = resolveRole(userInfo);
    if (role === 'boss') {
      wx.reLaunch({ url: '/pages/base/list/list' });
      return true;
    }
    if (isAdminRole(role)) {
      wx.reLaunch({ url: '/pages/admin/home/home' });
      return true;
    }
    return false;
  },

  onKeywordInput(e) {
    this.setData({ keyword: e.detail.value || '' }, () => {
      this.applyFilters();
    });
  },

  onFilterTap(e) {
    const key = e.currentTarget.dataset.key || 'all';
    if (key === this.data.activeFilter) return;
    this.setData({ activeFilter: key }, () => {
      this.applyFilters();
    });
  },

  applyFilters() {
    const activeFilter = this.data.activeFilter;
    const keyword = String(this.data.keyword || '').trim().toLowerCase();
    const all = Array.isArray(this.data.records) ? this.data.records : [];

    const viewRecords = all.filter((item) => {
      const passFilter = activeFilter === 'all' || item.statusKey === activeFilter;
      if (!passFilter) return false;
      if (!keyword) return true;
      const base = String(item.baseName || '').toLowerCase();
      const job = String(item.jobTitle || '').toLowerCase();
      return base.includes(keyword) || job.includes(keyword);
    });

    this.setData({ viewRecords });
  },

  async loadRecords() {
    const token = wx.getStorageSync('token');
    if (!token) {
      this.setData({ loading: false, records: [], viewRecords: [] });
      return;
    }

    this.setData({ loading: true });

    try {
      const res = await app.request({
        url: '/base/applications/me',
        method: 'GET',
      });

      const rows = Array.isArray(res) ? res : [];
      const records = rows.map((item, index) => {
        const statusInfo = toStatusInfo(item.status);
        const applicationId = Number(item.id) || 0;
        const status = Number(item.status);
        return {
          id: applicationId || `record-${index}`,
          signupId: applicationId,
          baseId: Number(item.baseId) || 0,
          jobId: Number(item.jobId) || 0,
          workDate: item.workDate || '',
          baseName: item.baseName || '未知基地',
          jobTitle: item.jobTitle || '未命名岗位',
          workDateText: formatDate(item.workDate),
          createdTimeText: formatDateTime(item.createdAt),
          checkinTimeText: formatDateTime(item.checkinTime),
          status,
          statusKey: statusInfo.key,
          statusText: statusInfo.text,
          statusClass: statusInfo.className,
          canCancel: status === 0,
          canViewQR: status === 1,
          canViewAttendance: status === 1 && item.checkinTime,
        };
      });

      const signedUp = records.filter((item) => item.statusKey === 'pending').length;
      const checkedIn = records.filter((item) => item.statusKey === 'approved').length;

      this.setData(
        {
          loading: false,
          cancellingId: 0,
          records,
          stats: {
            total: records.length,
            signedUp,
            checkedIn,
          },
        },
        () => {
          this.applyFilters();
        },
      );
    } catch (err) {
      console.error('加载我的报名失败:', err);
      this.setData({ loading: false, cancellingId: 0, records: [], viewRecords: [] });
      wx.showToast({ title: err?.message || '加载失败，请稍后重试', icon: 'none' });
    }
  },

  onCancelRecord(e) {
    const signupId = Number(e.currentTarget.dataset.signupId || 0);
    const record = (this.data.records || []).find((item) => Number(item.signupId) === signupId);
    if (!record || !record.canCancel || this.data.cancellingId) return;

    wx.showModal({
      title: '取消报名',
      content: `确认取消【${record.baseName} / ${record.jobTitle}】的报名记录吗？`,
      confirmText: '确认取消',
      cancelText: '暂不取消',
      success: (res) => {
        if (!res.confirm) return;
        this.executeCancelRecord(record);
      },
    });
  },

  async executeCancelRecord(record) {
    this.setData({ cancellingId: Number(record.signupId) || 0 });
    wx.showLoading({
      title: '取消中',
      mask: true,
    });

    try {
      await app.request({
        url: '/attendance/signup/cancel',
        method: 'POST',
        data: {
          signupId: record.signupId,
          baseId: record.baseId,
          jobId: record.jobId,
          workDate: record.workDate,
        },
      });

      wx.hideLoading();
      wx.showToast({
        title: '报名已取消',
        icon: 'success',
      });

      await this.loadRecords();
    } catch (error) {
      wx.hideLoading();
      wx.showToast({
        title: error?.message || '取消失败，请稍后重试',
        icon: 'none',
      });
    } finally {
      this.setData({ cancellingId: 0 });
    }
  },

  goWorkHistory() {
    wx.navigateTo({ url: '/pages/profile/workHistory/workHistory' });
  },

  backToSquare() {
    wx.switchTab({ url: '/pages/index/index' });
  },

  onViewQRCode(e) {
    const signupId = Number(e.currentTarget.dataset.signupId || 0);
    if (!signupId) return;
    wx.navigateTo({ url: `/pages/qrcode/qrcode?applicationId=${signupId}` });
  },

  onViewAttendance(e) {
    const signupId = Number(e.currentTarget.dataset.signupId || 0);
    if (!signupId) return;
    wx.navigateTo({ url: `/pages/attendance/detail/detail?applicationId=${signupId}` });
  },
});
