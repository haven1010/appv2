/**
 * Layer: Mini Program Page
 * Responsibility: Provides role-based admin home experiences for field, base, and super administrators.
 */
const app = getApp();
const { resolveRole, isAdminRole, roleLabel } = require('../../../utils/role');

const SUPER_ROLE_OPTIONS = [
  { label: '全部人员', value: '' },
  { label: '现场管理员', value: 'field_manager' },
  { label: '基地管理员', value: 'base_manager' },
  { label: '采摘工', value: 'worker' },
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
  return String(value).replace('T', ' ').slice(0, 19);
}

function normalizeArray(res) {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.list)) return res.list;
  if (Array.isArray(res?.records)) return res.records;
  if (Array.isArray(res?.bases)) return res.bases;
  return [];
}

function attendanceText(status) {
  if (status === 1) return '已签到';
  if (status === 2) return '缺勤';
  if (status === 3) return '已取消';
  if (status === 0) return '已报名';
  return '未签到';
}

function attendanceChip(status) {
  if (status === 1) return 'success';
  if (status === 2) return 'danger';
  if (status === 0) return 'pending';
  return 'info';
}

function salaryText(status) {
  if (status === 2) return '已发放';
  if (status === 1) return '已确认';
  if (status === 0) return '待确认';
  return '未生成';
}

function salaryChip(status) {
  if (status === 2) return 'success';
  if (status === 1) return 'info';
  if (status === 0) return 'pending';
  return 'danger';
}

function auditText(status) {
  if (status === 1) return '已通过';
  if (status === 2) return '已拒绝';
  return '待审核';
}

Page({
  data: {
    loading: true,
    role: 'worker',
    roleText: '',
    userInfo: null,
    activeNav: 'home',

    fieldDate: todayString(),
    fieldBaseId: '',
    fieldBaseName: '',
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
        title: '无权限',
        content: '当前账号不是管理员角色。',
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

  async resolveAssignedBaseId() {
    const userInfo = this.data.userInfo || app.getCurrentUser() || {};
    if (userInfo.assignedBaseId) {
      return String(userInfo.assignedBaseId);
    }

    const profile = await app.request({ url: '/user/profile', method: 'GET' }).catch(() => null);
    if (profile && profile.assignedBaseId) {
      const merged = Object.assign({}, userInfo, { assignedBaseId: profile.assignedBaseId });
      wx.setStorageSync('userInfo', merged);
      app.globalData.userInfo = merged;
      this.setData({ userInfo: merged });
      return String(profile.assignedBaseId);
    }
    return '';
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

  async loadFieldHome() {
    const baseId = await this.resolveAssignedBaseId();
    if (!baseId) {
      this.setData({
        fieldError: '当前账号未绑定基地，无法执行签到。',
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
      const name = user.name || row.workerName || '未知人员';
      const trace = `UID: ${uid || '-'} · 记录ID: ${row.id || '-'} · 状态: ${attendanceText(status)}`;
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
          trace: `${trace} · 归类: 首次到访/补签到`,
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
        const name = user.name || item.workerName || '待签到人员';
        return {
          key: `pending-${item.id || index}`,
          uid,
          name,
          trace: `UID: ${uid || '-'} · 申请ID: ${item.id || '-'} · 审核通过待签到`,
          checkinTime: '-',
        };
      });

    this.setData({
      fieldError: '',
      fieldBaseId: String(baseId),
      fieldBaseName: baseRes?.baseName || baseRes?.name || `基地#${baseId}`,
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
      wx.showToast({ title: '扫码已取消', icon: 'none' });
    }
  },

  async submitFieldCheckin() {
    const baseId = this.data.fieldBaseId;
    const qrContent = String(this.data.fieldScanText || '').trim();

    if (!baseId) {
      wx.showToast({ title: '未绑定基地', icon: 'none' });
      return;
    }
    if (!qrContent) {
      wx.showToast({ title: '请先输入或扫码', icon: 'none' });
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

      const displayName = res?.user?.name || res?.workerName || '人员';
      this.setData({
        fieldScanText: '',
        fieldCheckinResult: `${displayName} 签到成功 · ${formatDateTime(res?.checkinTime || new Date().toISOString())}`,
      });
      wx.showToast({ title: '签到成功', icon: 'success' });
      this.loadFieldHome();
    } catch (err) {
      wx.showToast({ title: err.message || '签到失败', icon: 'none' });
    }
  },

  exportFieldSheet() {
    const rows = [];
    const checked = this.data.fieldCheckedRows || [];
    const pending = this.data.fieldPendingRows || [];
    const firstVisit = this.data.fieldFirstVisitRows || [];

    for (let i = 0; i < checked.length; i += 1) {
      rows.push({
        uid: checked[i].uid || '',
        name: checked[i].name || '',
        status: '已签到',
        checkinTime: checked[i].checkinTime || '-',
        trace: checked[i].trace || '',
      });
    }
    for (let i = 0; i < pending.length; i += 1) {
      rows.push({
        uid: pending[i].uid || '',
        name: pending[i].name || '',
        status: '未签到',
        checkinTime: '-',
        trace: pending[i].trace || '',
      });
    }
    for (let i = 0; i < firstVisit.length; i += 1) {
      rows.push({
        uid: firstVisit[i].uid || '',
        name: firstVisit[i].name || '',
        status: '首次到访/补签到',
        checkinTime: firstVisit[i].checkinTime || '-',
        trace: firstVisit[i].trace || '',
      });
    }

    if (!rows.length) {
      wx.showToast({ title: '暂无签到数据', icon: 'none' });
      return;
    }

    const header = 'UID,姓名,状态,签到时间,信息追溯';
    const body = rows.map((item) => [item.uid, item.name, item.status, item.checkinTime, item.trace]
      .map((cell) => {
        const text = String(cell || '');
        return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
      })
      .join(','));
    const csv = [header].concat(body).join('\n');

    wx.setClipboardData({
      data: csv,
      success: () => {
        wx.showModal({
          title: '签到表已生成',
          content: `已复制 ${rows.length} 条签到记录，可直接粘贴到 Excel。`,
          showCancel: false,
        });
      },
      fail: () => wx.showToast({ title: '生成失败', icon: 'none' }),
    });
  },

  async loadBaseManagerHome() {
    const userInfo = this.data.userInfo || {};
    const list = await app.request({
      url: `/base?ownerId=${userInfo.id}`,
      method: 'GET',
    }).catch(() => []);

    const bases = normalizeArray(list).map((item) => ({
      id: String(item.id),
      baseName: item.baseName || item.name || `基地#${item.id}`,
    }));

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
        name: user.name || item.workerName || '未知人员',
        uid,
        trace: `申请ID: ${item.id || '-'} · 手机: ${user.phone || '-'} · 身份证: ${user.idCard || '-'}`,
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
        checkedIn: cards.filter((item) => item.attendanceStatusText === '已签到').length,
        withSalary: cards.filter((item) => item.salaryStatusText !== '未生成').length,
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

    const list = normalizeArray(usersRes).map((item) => ({
      id: item.id,
      name: item.name || '-',
      uid: item.uid || '-',
      roleText: roleLabel(item.roleKey || item.role || 'worker'),
      auditText: auditText(Number(item.infoAuditStatus)),
      trace: `手机: ${item.phone || '-'} · 基地: ${item.assignedBaseId || '-'} · 更新时间: ${formatDateTime(item.updatedAt)}`,
    }));

    this.setData({
      superStats: statsRes || {},
      superList: list,
      superTotal: Number(usersRes?.total || list.length),
    });
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
