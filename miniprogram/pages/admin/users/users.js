/**
 * Layer: Mini Program Page
 * Responsibility: Super-admin audit center and user deletion panel.
 */
const app = getApp();
const { resolveRole, isSuperAdminRole, roleLabel } = require('../../../utils/role');

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

Page({
  data: {
    loading: true,
    role: 'worker',
    roleText: '',
    userInfo: null,
    activeNav: 'audit',

    pendingBaseList: [],
    pendingUserList: [],

    userKeyword: '',
    allUserList: [],
  },

  onLoad() {
    if (!this.ensureSuperAdmin()) return;
    this.loadAuditData();
  },

  onShow() {
    if (!this.ensureSuperAdmin()) return;
    this.loadAuditData();
  },

  onPullDownRefresh() {
    this.loadAuditData().finally(() => wx.stopPullDownRefresh());
  },

  ensureSuperAdmin() {
    const token = wx.getStorageSync('token');
    const userInfo = app.getCurrentUser();
    const role = resolveRole(userInfo);

    if (!token || !userInfo) {
      wx.reLaunch({ url: '/pages/login/login' });
      return false;
    }

    if (!isSuperAdminRole(role)) {
      wx.showModal({
        title: '无权限',
        content: '审核中心仅超级管理员可访问。',
        showCancel: false,
        success: () => wx.navigateBack({ delta: 1 }),
      });
      return false;
    }

    this.setData({
      role,
      roleText: roleLabel(role),
      userInfo,
    });

    return true;
  },

  onUserKeywordInput(e) {
    this.setData({ userKeyword: e.detail.value });
  },

  searchUsers() {
    this.loadAllUsers();
  },

  async loadAuditData() {
    this.setData({ loading: true });
    try {
      const [baseRes, pendingUserRes] = await Promise.all([
        app.request({ url: '/base?showAll=true', method: 'GET' }).catch(() => []),
        app.request({ url: '/user/list?status=0&page=1&pageSize=100', method: 'GET' }).catch(() => ({ list: [] })),
      ]);

      const pendingBaseList = normalizeArray(baseRes)
        .filter((item) => Number(item.auditStatus) === 0)
        .map((item) => ({
          id: item.id,
          baseName: item.baseName || item.name || `基地#${item.id}`,
          contactPhone: item.contactPhone || '-',
          regionCode: item.regionCode || '-',
          address: item.address || '-',
          createdAtText: formatDateTime(item.createdAt),
        }));

      const pendingUserList = normalizeArray(pendingUserRes)
        .filter((item) => Number(item.infoAuditStatus) === 0)
        .map((item) => ({
          id: item.id,
          name: item.name || '-',
          uid: item.uid || '-',
          roleText: roleLabel(item.roleKey || item.role || 'worker'),
          phone: item.phone || '-',
          assignedBaseId: item.assignedBaseId || '-',
          createdAtText: formatDateTime(item.createdAt),
        }));

      this.setData({ pendingBaseList, pendingUserList });
      await this.loadAllUsers();
    } catch (err) {
      wx.showToast({ title: err.message || '加载审核数据失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  async loadAllUsers() {
    const keyword = String(this.data.userKeyword || '').trim();
    const params = ['page=1', 'pageSize=200'];
    if (keyword) params.push(`keyword=${encodeURIComponent(keyword)}`);

    const res = await app.request({ url: `/user/list?${params.join('&')}`, method: 'GET' }).catch(() => ({ list: [] }));
    const meId = Number(this.data.userInfo?.id || 0);

    const allUserList = normalizeArray(res).map((item) => {
      const id = Number(item.id);
      return {
        id,
        name: item.name || '-',
        uid: item.uid || '-',
        roleText: roleLabel(item.roleKey || item.role || 'worker'),
        phone: item.phone || '-',
        assignedBaseId: item.assignedBaseId || '-',
        auditText: Number(item.infoAuditStatus) === 1 ? '已通过' : Number(item.infoAuditStatus) === 2 ? '已拒绝' : '待审核',
        createdAtText: formatDateTime(item.createdAt),
        canDelete: id !== meId,
      };
    });

    this.setData({ allUserList });
  },

  async auditBase(e) {
    const id = Number(e.currentTarget.dataset.id);
    const status = Number(e.currentTarget.dataset.status);
    if (!id || ![1, 2].includes(status)) return;

    try {
      await app.request({
        url: `/base/${id}/audit`,
        method: 'PATCH',
        data: { status },
      });
      wx.showToast({ title: status === 1 ? '已通过' : '已驳回', icon: 'success' });
      this.loadAuditData();
    } catch (err) {
      wx.showToast({ title: err.message || '基地审核失败', icon: 'none' });
    }
  },

  async auditUser(e) {
    const id = Number(e.currentTarget.dataset.id);
    const status = Number(e.currentTarget.dataset.status);
    if (!id || ![1, 2].includes(status)) return;

    let reason = '';
    if (status === 2) {
      const modalRes = await new Promise((resolve) => {
        wx.showModal({
          title: '驳回原因',
          editable: true,
          placeholderText: '可选填写驳回原因',
          success: resolve,
        });
      });
      if (!modalRes.confirm) return;
      reason = String(modalRes.content || '').trim();
    }

    try {
      await app.request({
        url: `/user/${id}/audit`,
        method: 'PATCH',
        data: {
          status,
          reason: reason || undefined,
        },
      });
      wx.showToast({ title: status === 1 ? '已通过' : '已驳回', icon: 'success' });
      this.loadAuditData();
    } catch (err) {
      wx.showToast({ title: err.message || '信息审核失败', icon: 'none' });
    }
  },

  async deleteUser(e) {
    const id = Number(e.currentTarget.dataset.id);
    if (!id) return;
    if (id === Number(this.data.userInfo?.id)) {
      wx.showToast({ title: '不能删除当前登录账号', icon: 'none' });
      return;
    }

    const modalRes = await new Promise((resolve) => {
      wx.showModal({
        title: '删除人员',
        content: '删除后该账号将被软删除，是否继续？',
        success: resolve,
      });
    });
    if (!modalRes.confirm) return;

    try {
      await app.request({
        url: `/user/${id}`,
        method: 'DELETE',
      });
      wx.showToast({ title: '删除成功', icon: 'success' });
      this.loadAuditData();
    } catch (err) {
      wx.showToast({ title: err.message || '删除失败', icon: 'none' });
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
