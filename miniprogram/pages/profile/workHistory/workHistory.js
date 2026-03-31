/**
 * Layer: Mini Program Page
 * Responsibility: Implements the Work History page lifecycle, local interaction state, and backend integration for the WeChat client.
 * Notes: Keep comments focused on intent, invariants, side effects, and cross-module contracts.
 */
// pages/profile/workHistory/workHistory.js
const app = getApp();

function toStatusText(status) {
  if (status === 2 || status === 'paid') return '已发放';
  if (status === 1 || status === 'confirmed') return '已确认';
  if (status === 3 || status === 'rejected' || status === -1) return '异常记录';
  return '待确认';
}

function toStatusClass(status) {
  if (status === 2 || status === 'paid') return 'status-paid';
  if (status === 1 || status === 'confirmed') return 'status-ok';
  if (status === 3 || status === 'rejected' || status === -1) return 'status-error';
  return 'status-pending';
}

function formatDate(dateValue) {
  if (!dateValue) return '日期待补充';
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return String(dateValue).slice(0, 10);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return year + '-' + month + '-' + day;
}

function formatTime(raw) {
  if (!raw) return '';
  if (typeof raw !== 'string') return '';
  if (raw.length > 10) return raw.slice(11, 16);
  return raw.slice(0, 5);
}

function buildDetail(record) {
  const parts = [];
  if (record.workHours) parts.push('工时 ' + record.workHours + ' 小时');
  if (record.pieceCount) parts.push('计件 ' + record.pieceCount + ' 件');
  if (record.amount || record.totalAmount) parts.push('薪资 ¥' + (record.totalAmount || record.amount));
  if (record.remark) parts.push('备注：' + record.remark);
  if (parts.length === 0) {
    return '本次工作按计划完成，如需核对详情可联系基地管理员。';
  }
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
      const value = Math.min(14, scrollTop * speed);
      return -Math.round(value);
    });

    this.setData({
      scrollTop,
      topShadeOpacity: Math.min(1, scrollTop / 150),
      parallaxOffsets,
    });
  },

  noop() {},

  handleBlankTap() {
    if (!this.data.records.length) return;
    const shouldCollapse = this.data.records.some((item) => item.expanded);
    if (!shouldCollapse) return;

    const collapsed = this.data.records.map((item) =>
      Object.assign({}, item, { expanded: false })
    );
    this.setData({ records: collapsed });
  },

  toggleRecord(e) {
    const index = Number(e.currentTarget.dataset.index);
    if (Number.isNaN(index)) return;
    const key = 'records[' + index + '].expanded';
    this.setData({ [key]: !this.data.records[index].expanded });
  },

  async loadRecords() {
    try {
      const res = await app.request({ url: '/attendance/worker/records', method: 'GET' });
      const list = Array.isArray(res) ? res : [];
      const records = list.map((record, index) => {
        const status = record.status;
        const checkinTimeText = formatTime(record.checkinTime);
        return Object.assign({}, record, {
          id: record.id || record.recordId || 'record-' + index,
          expanded: false,
          delay: Math.min(index * 90, 900) + 'ms',
          statusText: record.statusText || toStatusText(status),
          statusClass: toStatusClass(status),
          workDateText: formatDate(record.workDate || record.checkinTime),
          checkinTimeText,
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
      wx.showToast({ title: '加载失败，请稍后重试', icon: 'none' });
    }
  },
});
