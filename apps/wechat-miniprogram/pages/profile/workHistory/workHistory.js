const app = getApp();

function formatDate(dateValue) {
  if (!dateValue) return '待补充';
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return String(dateValue).slice(0, 10);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatMoney(value) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount.toFixed(2) : '0.00';
}

function salaryStatusMeta(status) {
  if (status === 'paid') {
    return { text: '已发放', className: 'status-paid' };
  }
  if (status === 'confirmed') {
    return { text: '已确认', className: 'status-ok' };
  }
  return { text: '待结算', className: 'status-pending' };
}

function buildDetail(record) {
  const parts = [];
  if (record.workStartDate || record.workEndDate) {
    parts.push(`务工周期 ${record.workStartDate || '-'} 至 ${record.workEndDate || '-'}`);
  }
  parts.push(`本次工资 ¥${formatMoney(record.totalAmount)}`);
  if (record.phone) parts.push(`联系电话 ${record.phone}`);
  if (record.idCard) parts.push(`身份证 ${record.idCard}`);
  if (record.remark) parts.push(`备注 ${record.remark}`);
  return parts.join('；');
}

Page({
  data: {
    pageReady: false,
    topShadeOpacity: 0,
    scrollTop: 0,
    records: [],
    parallaxOffsets: [],
    loading: true,
  },

  onLoad() {
    this.loadRecords();
    setTimeout(() => {
      this.setData({ pageReady: true });
    }, 30);
  },

  onPullDownRefresh() {
    this.loadRecords().finally(() => wx.stopPullDownRefresh());
  },

  onScroll(e) {
    const scrollTop = (e.detail && e.detail.scrollTop) || 0;
    if (Math.abs(scrollTop - this.data.scrollTop) < 8) return;

    const parallaxOffsets = this.data.records.map((_, index) => {
      const speed = 0.03 + (index % 3) * 0.01;
      return -Math.round(Math.min(14, scrollTop * speed));
    });

    this.setData({
      scrollTop,
      topShadeOpacity: Math.min(1, scrollTop / 150),
      parallaxOffsets,
    });
  },

  noop() {},

  handleBlankTap() {
    if (!this.data.records.some((item) => item.expanded)) return;
    this.setData({
      records: this.data.records.map((item) => Object.assign({}, item, { expanded: false })),
    });
  },

  toggleRecord(e) {
    const index = Number(e.currentTarget.dataset.index);
    if (Number.isNaN(index)) return;
    const key = `records[${index}].expanded`;
    this.setData({ [key]: !this.data.records[index].expanded });
  },

  async loadRecords() {
    const user = wx.getStorageSync('userInfo') || {};
    const userId = Number(user.id || 0);
    try {
      const res = await app.request({
        url: `/worklog/archive?userId=${userId}`,
        method: 'GET',
      });
      const list = Array.isArray(res) ? res : [];
      const records = list.map((record, index) => {
        const statusMeta = salaryStatusMeta(record.salaryStatus);
        return Object.assign({}, record, {
          id: record.id || `archive-${index}`,
          expanded: false,
          delay: `${Math.min(index * 90, 900)}ms`,
          statusText: statusMeta.text,
          statusClass: statusMeta.className,
          workDateText: formatDate(record.completedAt || record.workEndDate || record.createdAt),
          detailText: buildDetail(record),
        });
      });
      this.setData({
        records,
        parallaxOffsets: records.map(() => 0),
        loading: false,
      });
    } catch (err) {
      this.setData({
        records: [],
        parallaxOffsets: [],
        loading: false,
      });
      wx.showToast({ title: err?.message || '加载失败，请稍后重试', icon: 'none' });
    }
  },
});
