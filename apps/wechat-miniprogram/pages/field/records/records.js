const app = getApp();

function normalizeArray(res) {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.records)) return res.records;
  if (Array.isArray(res?.list)) return res.list;
  if (Array.isArray(res?.bases)) return res.bases;
  return [];
}

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function shiftDate(dateText, delta) {
  const current = new Date(`${dateText}T00:00:00`);
  current.setDate(current.getDate() + delta);
  return formatDate(current);
}

function formatTime(value) {
  if (!value) return '--:--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(11, 16) || String(value);
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function buildDateLabel(dateText) {
  const today = formatDate(new Date());
  if (dateText === today) return '今天';
  return '签到表';
}

Page({
  data: {
    baseId: null,
    baseName: '',
    managedBases: [],
    baseIndex: 0,
    selectedDate: '',
    dateLabel: '',
    records: [],
    loading: true,
    exporting: false,
    totalCount: 0,
  },

  onLoad() {
    const today = formatDate(new Date());
    this.setData({
      selectedDate: today,
      dateLabel: buildDateLabel(today),
    });
    this.resolveBaseId();
  },

  onPullDownRefresh() {
    this.loadRecords().finally(() => wx.stopPullDownRefresh());
  },

  async resolveBaseId() {
    const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo') || {};
    let bases = normalizeArray(await app.request({ url: '/base/managed', method: 'GET' }).catch(() => []))
      .map((item) => ({
        id: Number(item.id),
        baseName: item.baseName || item.name || `基地 #${item.id}`,
      }));

    if (!bases.length && userInfo.assignedBaseId) {
      bases = [{ id: Number(userInfo.assignedBaseId), baseName: `基地 #${userInfo.assignedBaseId}` }];
    }

    if (!bases.length) {
      this.setData({ loading: false });
      return;
    }

    const preferredId = Number(wx.getStorageSync('fieldActiveBaseId') || userInfo.assignedBaseId || 0);
    let baseIndex = preferredId ? bases.findIndex((item) => Number(item.id) === preferredId) : 0;
    if (baseIndex < 0) baseIndex = 0;
    const selected = bases[baseIndex];

    this.setData({
      managedBases: bases,
      baseIndex,
      baseId: Number(selected.id),
      baseName: selected.baseName,
    });
    await this.loadRecords();
  },

  onBaseChange(e) {
    const baseIndex = Number(e.detail.value || 0);
    const selected = this.data.managedBases[baseIndex];
    if (!selected) return;

    wx.setStorageSync('fieldActiveBaseId', Number(selected.id));
    this.setData({
      baseIndex,
      baseId: Number(selected.id),
      baseName: selected.baseName,
    });
    this.loadRecords();
  },

  onDateChange(e) {
    const selectedDate = e.detail.value;
    this.setData({
      selectedDate,
      dateLabel: buildDateLabel(selectedDate),
    });
    this.loadRecords();
  },

  prevDay() {
    const selectedDate = shiftDate(this.data.selectedDate, -1);
    this.setData({
      selectedDate,
      dateLabel: buildDateLabel(selectedDate),
    });
    this.loadRecords();
  },

  nextDay() {
    const today = formatDate(new Date());
    if (this.data.selectedDate >= today) return;
    const selectedDate = shiftDate(this.data.selectedDate, 1);
    this.setData({
      selectedDate,
      dateLabel: buildDateLabel(selectedDate),
    });
    this.loadRecords();
  },

  async loadRecords() {
    if (!this.data.baseId) return;
    this.setData({ loading: true });
    try {
      const res = await app.request({
        url: `/attendance/records?baseId=${this.data.baseId}&date=${this.data.selectedDate}`,
        method: 'GET',
      });

      const records = normalizeArray(res).map((item, index) => {
        const name = item.workerName || item.user?.name || '未命名工人';
        const status = Number(item.status || 0);
        let statusText = '待签到';
        let statusClass = 'pending';
        if (status === 1) { statusText = '已签到'; statusClass = 'checked'; }
        if (status === 2) { statusText = '缺勤'; statusClass = 'absent'; }
        if (status === 3) { statusText = '已取消'; statusClass = 'cancelled'; }
        return {
          id: item.id || `record-${index}`,
          displayAvatar: String(name).slice(0, 1),
          displayName: name,
          displayUid: item.workerUid || item.user?.uid || '--',
          displayJob: item.jobTitle || item.job?.title || '-',
          displayTime: formatTime(item.checkinTime || item.createdAt),
          displayWorkDate: item.workDate || '-',
          statusText,
          statusClass,
        };
      });

      this.setData({
        records,
        totalCount: records.length,
        loading: false,
      });
    } catch (err) {
      this.setData({ records: [], totalCount: 0, loading: false });
      wx.showToast({ title: err.message || '加载签到表失败', icon: 'none' });
    }
  },

  async exportRecords() {
    if (!this.data.baseId || this.data.exporting) return;
    this.setData({ exporting: true });
    try {
      const res = await app.exportXlsx({
        url: `/attendance/export/records?baseId=${this.data.baseId}&date=${this.data.selectedDate}`,
        method: 'GET',
        fileName: `签到表-${this.data.selectedDate}.xlsx`,
      });
      wx.showToast({ title: '签到表已导出', icon: 'success' });
      if (res?.filePath) {
        console.log('[export] attendance xlsx file =', res.filePath);
      }
    } catch (err) {
      wx.showToast({ title: err.message || '导出失败', icon: 'none' });
    } finally {
      this.setData({ exporting: false });
    }
  },
});
