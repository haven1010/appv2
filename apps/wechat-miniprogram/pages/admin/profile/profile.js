/**
 * Layer: Mini Program Page
 * Responsibility: Admin profile page for personal info and logout.
 */
const app = getApp();
const { requireAuth } = require('../../../utils/auth-guard');
const { resolveRole, isAdminRole, roleLabel } = require('../../../utils/role');

function maskPhone(phone) {
  const p = String(phone || '');
  if (p.length < 7) return p || '-';
  return `${p.slice(0, 3)}****${p.slice(-4)}`;
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
  return [];
}

function operationTypeText(value) {
  const key = String(value || '').toLowerCase();
  if (key === 'create') return '新增';
  if (key === 'update') return '修改';
  if (key === 'delete') return '删除';
  if (key === 'audit') return '审核';
  return key || '-';
}

function resourceTypeText(value) {
  const key = String(value || '').toLowerCase();
  if (key === 'user') return '人员';
  if (key === 'base') return '基地';
  if (key === 'job') return '岗位';
  if (key === 'application') return '报名';
  if (key === 'cooperation') return '合作';
  if (key === 'attendance') return '签到';
  if (key === 'salary') return '工资';
  if (key === 'payment') return '发放';
  return key || '-';
}

Page({
  data: {
    loading: true,
    logsLoading: false,
    role: 'worker',
    roleText: '',
    userInfo: null,
    profile: null,
    canViewLogs: false,
    operationLogs: [],
    activeNav: 'me',
  },

  onLoad() {
    if (!requireAuth()) return;
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

    this.setData({
      role,
      roleText: roleLabel(role),
      userInfo,
      canViewLogs: role === 'super_admin',
    });

    return true;
  },

  async loadAll() {
    await this.loadProfile();
    if (this.data.canViewLogs) {
      await this.loadOperationLogs();
    }
  },

  async loadProfile() {
    this.setData({ loading: true });
    try {
      const profile = await app.request({ url: '/user/profile', method: 'GET' });
      this.setData({
        profile: {
          uid: profile?.uid || '-',
          name: profile?.name || '-',
          role: roleLabel(profile?.roleKey || profile?.role || this.data.role),
          phoneMasked: maskPhone(profile?.phone),
          emergencyContact: profile?.emergencyContact || '-',
          emergencyPhone: maskPhone(profile?.emergencyPhone),
          assignedBaseId: profile?.assignedBaseId || '-',
        },
      });
    } catch (err) {
      wx.showToast({ title: err.message || '加载个人信息失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  async loadOperationLogs() {
    if (!this.data.canViewLogs) return;

    this.setData({ logsLoading: true });
    try {
      const res = await app.request({
        url: '/operation-log/list?page=1&pageSize=20',
        method: 'GET',
      });

      const list = normalizeArray(res).map((item) => ({
        id: item.id,
        operationTypeText: operationTypeText(item.operationType),
        resourceTypeText: resourceTypeText(item.resourceType),
        resourceId: item.resourceId || '-',
        description: item.description || '-',
        userId: item.userId || '-',
        createdAtText: formatDateTime(item.createdAt),
      }));

      this.setData({ operationLogs: list });
    } catch (err) {
      wx.showToast({ title: err.message || '加载操作日志失败', icon: 'none' });
    } finally {
      this.setData({ logsLoading: false });
    }
  },

  logout() {
    wx.showModal({
      title: '退出登录',
      content: '确定退出当前账号吗？',
      success: (res) => {
        if (!res.confirm) return;
        wx.removeStorageSync('token');
        wx.removeStorageSync('userInfo');
        app.globalData.token = null;
        app.globalData.userInfo = null;
        wx.reLaunch({ url: '/pages/login/login' });
      },
    });
  },

  refreshAll() {
    this.loadAll();
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
