// pages/field/records/records.js
const app = getApp();

function formatDate(date) {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const d = date.getDate().toString().padStart(2, '0');
  return y + '-' + m + '-' + d;
}

function friendlyDate(dateStr) {
  const today = formatDate(new Date());
  const yesterday = formatDate(new Date(Date.now() - 86400000));
  if (dateStr === today) return '今天';
  if (dateStr === yesterday) return '昨天';
  return dateStr;
}

Page({
  data: {
    baseId: null,
    baseName: '',
    selectedDate: '',
    dateLabel: '今天',
    records: [],
    loading: true,
    totalCount: 0,
  },

  onLoad() {
    const today = formatDate(new Date());
    this.setData({ selectedDate: today, dateLabel: '今天' });
    this.resolveBaseId();
  },

  onShow() {
    const tabBar = this.getTabBar && this.getTabBar();
    if (tabBar) {
      tabBar.setData({ selected: 2 });
    }
    if (this.data.baseId) {
      this.loadRecords();
    }
  },

  onPullDownRefresh() {
    this.loadRecords();
    setTimeout(() => wx.stopPullDownRefresh(), 1500);
  },

  async resolveBaseId() {
    const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo');
    if (userInfo && userInfo.assignedBaseId) {
      this.setData({ baseId: userInfo.assignedBaseId });
      this.loadBaseName(userInfo.assignedBaseId);
      this.loadRecords();
      return;
    }
    try {
      const profile = await app.request({ url: '/user/profile', method: 'GET' });
      if (profile && profile.assignedBaseId) {
        this.setData({ baseId: profile.assignedBaseId });
        this.loadBaseName(profile.assignedBaseId);
        this.loadRecords();
      } else {
        this.setData({ loading: false });
      }
    } catch (e) {
      this.setData({ loading: false });
    }
  },

  async loadBaseName(baseId) {
    try {
      const base = await app.request({ url: '/base/' + baseId, method: 'GET' });
      if (base && (base.baseName || base.name)) {
        this.setData({ baseName: base.baseName || base.name });
      }
    } catch (e) {
      // 忽略
    }
  },

  async loadRecords() {
    if (!this.data.baseId) return;
    this.setData({ loading: true });

    try {
      const date = this.data.selectedDate;
      const res = await app.request({
        url: '/attendance/records?baseId=' + this.data.baseId + '&date=' + date,
        method: 'GET',
      });

      const list = Array.isArray(res) ? res : (res && res.list ? res.list : []);

      // 格式化时间
      const records = list.map(item => {
        let timeStr = '';
        if (item.checkinTime) {
          const d = new Date(item.checkinTime);
          timeStr = d.getHours().toString().padStart(2, '0') + ':' +
                    d.getMinutes().toString().padStart(2, '0');
        } else if (item.createdAt) {
          const d = new Date(item.createdAt);
          timeStr = d.getHours().toString().padStart(2, '0') + ':' +
                    d.getMinutes().toString().padStart(2, '0');
        }
        return Object.assign({}, item, {
          displayTime: timeStr,
          displayName: (item.user && item.user.name) || item.userName || '未知',
          displayAvatar: (item.user && item.user.name) ? item.user.name[0] : '?',
        });
      });

      this.setData({
        records,
        totalCount: records.length,
        loading: false,
      });
    } catch (err) {
      console.error('加载考勤记录失败:', err);
      this.setData({ records: [], totalCount: 0, loading: false });
    }
  },

  // 日期选择器
  onDateChange(e) {
    const date = e.detail.value;
    this.setData({
      selectedDate: date,
      dateLabel: friendlyDate(date),
    });
    this.loadRecords();
  },

  // 前一天
  prevDay() {
    const current = new Date(this.data.selectedDate);
    current.setDate(current.getDate() - 1);
    const date = formatDate(current);
    this.setData({
      selectedDate: date,
      dateLabel: friendlyDate(date),
    });
    this.loadRecords();
  },

  // 后一天
  nextDay() {
    const current = new Date(this.data.selectedDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    current.setDate(current.getDate() + 1);
    if (current > today) return; // 不能选未来日期
    const date = formatDate(current);
    this.setData({
      selectedDate: date,
      dateLabel: friendlyDate(date),
    });
    this.loadRecords();
  },
});
