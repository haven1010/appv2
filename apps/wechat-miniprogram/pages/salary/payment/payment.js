const app = getApp();
const { requireAuth } = require('../../../utils/auth-guard');

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
    salaryId: 0,
    amount: '0.00',
    status: 0,
    statusText: '',
    statusClass: '',
    confirmedTime: '',
    paidTime: '',
    estimatedArrival: '',
    bankCard: '',
    payoutType: '',
    payoutTypeText: '',
    steps: [],
  },

  onLoad(options) {
    if (!requireAuth()) return;
    const salaryId = Number(options.salaryId || 0);
    if (!salaryId) {
      wx.showToast({ title: '参数错误', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }
    this.setData({ salaryId });
    this.loadPaymentStatus();
  },

  async loadPaymentStatus() {
    wx.showLoading({ title: '加载中...' });
    try {
      const res = await app.request({
        url: `/salary/worker/${this.data.salaryId}/payment`,
        method: 'GET',
      });

      const statusMap = {
        0: { text: '待确认', class: 'status-pending' },
        1: { text: '处理中', class: 'status-processing' },
        2: { text: '已到账', class: 'status-paid' },
      };

      const payoutTypeMap = {
        1: '现金',
        2: '银行转账',
      };

      const status = statusMap[res.status] || statusMap[0];

      const steps = [
        {
          title: '工资确认',
          time: formatDateTime(res.confirmedTime),
          completed: res.status >= 1,
          active: res.status === 0,
        },
        {
          title: '发放处理',
          time: res.status >= 2 ? formatDateTime(res.paidTime) : '处理中',
          completed: res.status >= 2,
          active: res.status === 1,
        },
        {
          title: '到账完成',
          time: res.status >= 2 ? formatDateTime(res.paidTime) : '预计1-3个工作日',
          completed: res.status >= 2,
          active: false,
        },
      ];

      this.setData({
        amount: Number(res.totalAmount).toFixed(2),
        status: res.status,
        statusText: status.text,
        statusClass: status.class,
        confirmedTime: formatDateTime(res.confirmedTime),
        paidTime: formatDateTime(res.paidTime),
        estimatedArrival: res.estimatedArrival || '1-3个工作日',
        bankCard: res.bankCard || '',
        payoutType: res.payoutType || '',
        payoutTypeText: payoutTypeMap[res.payoutType] || '',
        steps,
      });

      wx.hideLoading();
    } catch (err) {
      wx.hideLoading();
      console.error('加载支付状态失败:', err);
      wx.showToast({ title: err.message || '加载失败', icon: 'none' });
    }
  },

  goBack() {
    wx.navigateBack();
  },
});
