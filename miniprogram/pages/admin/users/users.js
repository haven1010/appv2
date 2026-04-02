/**
 * Layer: Mini Program Page
 * Responsibility: Super-admin audit center with full base/user visibility, manager creation, and card-level delete actions.
 */
const app = getApp();
const { resolveRole, isSuperAdminRole, roleLabel } = require('../../../utils/role');

const CREATE_ROLE_OPTIONS = [
  { label: '基地管理员', value: 'base_manager' },
  { label: '现场管理员', value: 'field_manager' },
];

const ADMIN_ROLE_SET = {
  super_admin: true,
  region_admin: true,
  base_manager: true,
  field_manager: true,
};

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

function cleanPhone(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 11);
}

function cleanIdCard(value) {
  return String(value || '').trim().toUpperCase().slice(0, 18);
}

function infoAuditText(status) {
  const num = Number(status);
  if (num === 1) return '已通过';
  if (num === 2) return '已驳回';
  return '待审核';
}

function baseAuditText(status) {
  const num = Number(status);
  if (num === 1) return '已通过';
  if (num === 2) return '已驳回';
  return '待审核';
}

function baseCategoryText(category) {
  const num = Number(category);
  if (num === 1) return '水果基地';
  if (num === 2) return '蔬菜基地';
  if (num === 3) return '其他基地';
  return '-';
}

function createRoleValue(index) {
  return CREATE_ROLE_OPTIONS[index]?.value || CREATE_ROLE_OPTIONS[0].value;
}

function safeText(value) {
  const text = String(value == null ? '' : value).trim();
  return text || '-';
}

Page({
  data: {
    loading: true,
    creating: false,
    role: 'worker',
    roleText: '',
    userInfo: null,
    activeNav: 'audit',

    pendingBaseList: [],
    pendingUserList: [],

    userKeyword: '',

    baseRawList: [],
    allBaseList: [],
    adminUserList: [],
    workerUserList: [],

    createRoleOptions: CREATE_ROLE_OPTIONS,
    createRoleIndex: 0,
    createName: '',
    createIdCard: '',
    createPhone: '',
    fieldBaseOptions: [{ id: '', baseName: '请选择基地' }],
    assignedBaseIndex: 0,
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
    this.setData({ userKeyword: e.detail.value || '' });
  },

  searchUsers() {
    this.loadAllUsers();
  },

  onCreateRoleChange(e) {
    const nextIndex = Number(e.detail.value || 0);
    this.setData({
      createRoleIndex: nextIndex,
      assignedBaseIndex: createRoleValue(nextIndex) === 'field_manager' ? this.data.assignedBaseIndex : 0,
    });
  },

  onCreateNameInput(e) {
    this.setData({ createName: (e.detail.value || '').trim() });
  },

  onCreateIdCardInput(e) {
    this.setData({ createIdCard: cleanIdCard(e.detail.value) });
  },

  onCreatePhoneInput(e) {
    this.setData({ createPhone: cleanPhone(e.detail.value) });
  },

  onCreateBaseChange(e) {
    this.setData({ assignedBaseIndex: Number(e.detail.value || 0) });
  },

  async createManager() {
    if (this.data.creating) return;

    const roleKey = createRoleValue(this.data.createRoleIndex);
    const name = String(this.data.createName || '').trim();
    const idCard = cleanIdCard(this.data.createIdCard);
    const phone = cleanPhone(this.data.createPhone);

    if (!name) {
      wx.showToast({ title: '请输入姓名', icon: 'none' });
      return;
    }
    if (!/^\d{17}[\dX]$/.test(idCard)) {
      wx.showToast({ title: '身份证格式不正确', icon: 'none' });
      return;
    }
    if (phone.length !== 11) {
      wx.showToast({ title: '请输入11位手机号', icon: 'none' });
      return;
    }

    const payload = {
      roleKey,
      name,
      idCard,
      phone,
    };

    if (roleKey === 'field_manager') {
      const picked = this.data.fieldBaseOptions[this.data.assignedBaseIndex] || {};
      const assignedBaseId = Number(picked.id || 0);
      if (!assignedBaseId) {
        wx.showToast({ title: '请选择绑定基地', icon: 'none' });
        return;
      }
      payload.assignedBaseId = assignedBaseId;
    }

    this.setData({ creating: true });
    try {
      await app.request({
        url: '/user/admin',
        method: 'POST',
        data: payload,
      });

      wx.showToast({ title: '管理员创建成功', icon: 'success' });
      this.setData({
        createRoleIndex: 0,
        createName: '',
        createIdCard: '',
        createPhone: '',
        assignedBaseIndex: 0,
      });
      await this.loadAuditData();
    } catch (err) {
      wx.showToast({ title: err.message || '创建失败', icon: 'none' });
    } finally {
      this.setData({ creating: false });
    }
  },

  async loadAuditData() {
    this.setData({ loading: true });
    try {
      const [baseRes, pendingUserRes] = await Promise.all([
        app.request({ url: '/base?showAll=true', method: 'GET' }).catch(() => []),
        app.request({ url: '/user/list?status=0&page=1&pageSize=200', method: 'GET' }).catch(() => ({ list: [] })),
      ]);

      const baseRawList = normalizeArray(baseRes);

      const pendingBaseList = baseRawList
        .filter((item) => Number(item.auditStatus) === 0)
        .map((item) => ({
          id: Number(item.id),
          baseName: item.baseName || item.name || `基地#${item.id}`,
          contactPhone: item.contactPhone || '-',
          regionCode: item.regionCode || '-',
          address: item.address || '-',
          createdAtText: formatDateTime(item.createdAt),
        }));

      const pendingUserList = normalizeArray(pendingUserRes)
        .filter((item) => Number(item.infoAuditStatus) === 0)
        .map((item) => ({
          id: Number(item.id),
          name: item.name || '-',
          uid: item.uid || '-',
          roleText: roleLabel(item.roleKey || item.role || 'worker'),
          phone: item.phone || '-',
          assignedBaseId: item.assignedBaseId || '-',
          createdAtText: formatDateTime(item.createdAt),
        }));

      this.setData({ pendingBaseList, pendingUserList, baseRawList });
      await this.loadAllUsers(baseRawList);
    } catch (err) {
      wx.showToast({ title: err.message || '加载审核数据失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  async loadAllUsers(baseListOverride) {
    const keyword = String(this.data.userKeyword || '').trim();
    const params = ['page=1', 'pageSize=500'];
    if (keyword) params.push(`keyword=${encodeURIComponent(keyword)}`);

    const res = await app.request({ url: `/user/list?${params.join('&')}`, method: 'GET' }).catch(() => ({ list: [] }));
    const rawUsers = normalizeArray(res);
    const rawBases = Array.isArray(baseListOverride) ? baseListOverride : normalizeArray(this.data.baseRawList);

    const meId = Number(this.data.userInfo?.id || 0);

    const nameByUserId = {};
    for (let i = 0; i < rawUsers.length; i += 1) {
      const row = rawUsers[i] || {};
      const id = Number(row.id || 0);
      if (id) nameByUserId[id] = row.name || '-';
    }

    const mappedBaseList = rawBases.map((item) => {
      const ownerId = Number(item.ownerId || 0);
      return {
        id: Number(item.id || 0),
        baseName: item.baseName || item.name || `基地#${item.id}`,
        auditStatus: Number(item.auditStatus),
        auditText: baseAuditText(item.auditStatus),
        categoryText: baseCategoryText(item.category),
        ownerId: ownerId || '-',
        ownerName: ownerId ? (nameByUserId[ownerId] || '-') : '-',
        contactPhone: safeText(item.contactPhone),
        regionCode: safeText(item.regionCode),
        address: safeText(item.address),
        description: safeText(item.description),
        licenseUrl: safeText(item.licenseUrl),
        createdAtText: formatDateTime(item.createdAt),
        updatedAtText: formatDateTime(item.updatedAt),
      };
    });

    const baseNameById = {};
    for (let i = 0; i < mappedBaseList.length; i += 1) {
      const base = mappedBaseList[i] || {};
      const id = Number(base.id || 0);
      if (id) baseNameById[id] = base.baseName || `基地#${id}`;
    }

    const allUsers = rawUsers.map((item) => {
      const id = Number(item.id || 0);
      const roleKey = item.roleKey || item.role || 'worker';
      const assignedBaseId = Number(item.assignedBaseId || 0);
      const assignedBaseName = assignedBaseId ? (baseNameById[assignedBaseId] || '-') : '-';
      return {
        id,
        roleKey,
        roleText: roleLabel(roleKey),
        name: safeText(item.name),
        uid: safeText(item.uid),
        phone: safeText(item.phone),
        idCard: safeText(item.idCard),
        emergencyContact: safeText(item.emergencyContact),
        emergencyPhone: safeText(item.emergencyPhone),
        homeAddress: safeText(item.homeAddress),
        bankName: safeText(item.bankName),
        bankCardNo: safeText(item.bankCardNo),
        faceImgUrl: safeText(item.faceImgUrl),
        regionCode: safeText(item.regionCode),
        assignedBaseId: assignedBaseId || '-',
        assignedBaseText: assignedBaseId ? `${assignedBaseName} (ID:${assignedBaseId})` : '-',
        auditText: infoAuditText(item.infoAuditStatus),
        createdAtText: formatDateTime(item.createdAt),
        updatedAtText: formatDateTime(item.updatedAt),
        canDelete: id && id !== meId,
      };
    });

    const adminUserList = allUsers.filter((item) => ADMIN_ROLE_SET[item.roleKey]);
    const workerUserList = allUsers.filter((item) => item.roleKey === 'worker');

    const approvedBases = mappedBaseList.filter((item) => Number(item.auditStatus) === 1);
    const nextFieldBaseOptions = [{ id: '', baseName: '请选择基地' }].concat(
      approvedBases.map((item) => ({
        id: item.id,
        baseName: `${item.baseName} (ID:${item.id})`,
      })),
    );

    const currentSelectedId = Number((this.data.fieldBaseOptions[this.data.assignedBaseIndex] || {}).id || 0);
    const nextAssignedBaseIndex = currentSelectedId
      ? Math.max(0, nextFieldBaseOptions.findIndex((item) => Number(item.id || 0) === currentSelectedId))
      : 0;

    this.setData({
      allBaseList: mappedBaseList,
      adminUserList,
      workerUserList,
      fieldBaseOptions: nextFieldBaseOptions,
      assignedBaseIndex: nextAssignedBaseIndex,
    });
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
      wx.showToast({ title: status === 1 ? '审核通过' : '审核驳回', icon: 'success' });
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
      wx.showToast({ title: status === 1 ? '审核通过' : '审核驳回', icon: 'success' });
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
      this.loadAuditData();
    } catch (err) {
      wx.showToast({ title: err.message || '删除失败', icon: 'none' });
    }
  },

  async deleteBaseCard(e) {
    const id = Number(e.currentTarget.dataset.id);
    if (!id) return;

    const modalRes = await new Promise((resolve) => {
      wx.showModal({
        title: '删除基地',
        content: '删除后将彻底清理该基地全部信息，且支持后续重新入驻，是否继续？',
        success: resolve,
      });
    });
    if (!modalRes.confirm) return;

    try {
      await app.request({
        url: `/base/${id}`,
        method: 'DELETE',
      });
      wx.showToast({ title: '基地删除成功', icon: 'success' });
      this.loadAuditData();
    } catch (err) {
      wx.showToast({ title: err.message || '基地删除失败', icon: 'none' });
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
