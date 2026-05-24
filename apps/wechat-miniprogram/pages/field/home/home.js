const app = getApp();

function normalizeArray(res) {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.list)) return res.list;
  if (Array.isArray(res?.records)) return res.records;
  if (Array.isArray(res?.bases)) return res.bases;
  return [];
}

Page({
  data: {
    userInfo: null,
    baseInfo: null,
    baseId: null,
    baseName: '',
    managedBases: [],
    baseIndex: 0,
    stats: { checkedIn: 0, pending: 0, absent: 0, rate: '0%' },
    recentRecords: [],
    pendingWorkers: [],
    loading: true,
    error: '',
  },

  onLoad() {
    this.checkLogin();
  },

  onShow() {
    this.loadData();
  },

  onPullDownRefresh() {
    this.loadData();
    setTimeout(() => wx.stopPullDownRefresh(), 1500);
  },

  checkLogin() {
    const userInfo = wx.getStorageSync('userInfo');
    if (!userInfo) {
      wx.showModal({
        title: '提示',
        content: '请先登录',
        showCancel: false,
        success: () => {
          wx.reLaunch({ url: '/pages/login/login' });
        },
      });
      return;
    }
    this.setData({ userInfo });
  },

  async loadData() {
    const token = wx.getStorageSync('token');
    if (!token) {
      this.setData({ loading: false });
      return;
    }
    this.setData({ loading: true, error: '' });

    try {
      const baseId = await this.resolveActiveBase();
      if (!baseId) {
        this.setData({
          loading: false,
          error: '当前账号未绑定可管理基地，请联系管理员分配。',
        });
        return;
      }

      const today = this.todayString();
      const [baseInfo, attendanceStats, records, pendingWorkers] = await Promise.all([
        app.request({ url: `/base/${baseId}`, method: 'GET' }).catch(() => null),
        app.request({ url: `/attendance/stats?baseId=${baseId}`, method: 'GET' }).catch(() => null),
        app.request({ url: `/attendance/records?baseId=${baseId}&date=${today}&limit=10`, method: 'GET' }).catch(() => []),
        app.request({ url: `/attendance/pending-workers?baseId=${baseId}&date=${today}`, method: 'GET' }).catch(() => []),
      ]);

      const statsData = attendanceStats || {};
      const checkedIn = statsData.checkedIn || statsData.present || 0;
      const total = statsData.total || 0;
      const pending = statsData.pending || 0;
      const rate = total > 0 ? Math.round((checkedIn / total) * 100) + '%' : '0%';

      this.setData({
        baseInfo: baseInfo || null,
        baseName: (baseInfo && (baseInfo.baseName || baseInfo.name)) || this.data.baseName || `基地 #${baseId}`,
        stats: {
          checkedIn,
          pending,
          absent: statsData.absent || 0,
          rate,
        },
        recentRecords: normalizeArray(records).slice(0, 5),
        pendingWorkers: normalizeArray(pendingWorkers).slice(0, 6),
        loading: false,
      });
    } catch (err) {
      this.setData({
        loading: false,
        error: '加载数据失败：' + (err.message || '未知错误'),
      });
    }
  },

  async resolveActiveBase() {
    const userInfo = this.data.userInfo || app.globalData.userInfo || wx.getStorageSync('userInfo') || {};
    let bases = normalizeArray(await app.request({ url: '/base/managed', method: 'GET' }).catch(() => []))
      .map((item) => ({
        id: Number(item.id),
        baseName: item.baseName || item.name || `基地 #${item.id}`,
      }));

    if (!bases.length && userInfo.assignedBaseId) {
      bases = [{ id: Number(userInfo.assignedBaseId), baseName: `基地 #${userInfo.assignedBaseId}` }];
    }

    if (!bases.length) {
      this.setData({
        managedBases: [],
        baseIndex: 0,
        baseId: null,
        baseName: '',
      });
      return null;
    }

    const preferredId = Number(wx.getStorageSync('fieldActiveBaseId') || userInfo.assignedBaseId || 0);
    let index = preferredId ? bases.findIndex((item) => Number(item.id) === preferredId) : 0;
    if (index < 0) index = 0;

    const selected = bases[index] || bases[0];
    wx.setStorageSync('fieldActiveBaseId', Number(selected.id));
    this.setData({
      managedBases: bases,
      baseIndex: index,
      baseId: Number(selected.id),
      baseName: selected.baseName,
    });
    return Number(selected.id);
  },

  onBaseChange(e) {
    const index = Number(e.detail.value);
    const picked = this.data.managedBases[index];
    if (!picked) return;

    wx.setStorageSync('fieldActiveBaseId', Number(picked.id));
    this.setData({
      baseIndex: index,
      baseId: Number(picked.id),
      baseName: picked.baseName,
    });
    this.loadData();
  },

  todayString() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  },

  goScan() {
    wx.navigateTo({ url: '/pages/field/scan/scan' });
  },

  goRecords() {
    wx.navigateTo({ url: '/pages/field/records/records' });
  },
});
