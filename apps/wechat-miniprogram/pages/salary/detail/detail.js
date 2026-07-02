const app = getApp();
const { requireAuth } = require('../../../utils/auth-guard');

function formatAmount(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num.toFixed(2) : '0.00';
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toLocaleDateString('zh-CN');
}

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
    baseName: '',
    workDate: '',
    totalAmount: '0.00',
    workDuration: '0',
    pieceCount: '',
    unitPrice: '0.00',
    statusText: '',
    statusClass: '',
    payoutType: '',
    payoutTypeText: '',
    bankCard: '',
    paidTime: '',
    canConfirm: false,
    canAppeal: false,
    confirming: false,
    hasAppeal: false,
    appealStatusText: '',
    appealStatusClass: '',
    appealReason: '',
    expectedAmount: '',
    appealReply: '',
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
    this.loadSalaryDetail();
  },

  async loadSalaryDetail() {
    wx.showLoading({ title: '加载中...' });
    try {
      const res = await app.request({
        url: `/salary/worker/${this.data.salaryId}`,
        method: 'GET',
      });

      const statusMap = {
        0: { text: '待确认', class: 'status-pending' },
        1: { text: '已确认', class: 'status-confirmed' },
        2: { text: '已发放', class: 'status-paid' },
      };

      const payoutTypeMap = {
        1: '现金',
        2: '转账',
      };

      const appealStatusMap = {
        0: { text: '无申诉', class: 'appeal-none' },
        1: { text: '申诉处理中', class: 'appeal-pending' },
        2: { text: '已调整待确认', class: 'appeal-resolved' },
        3: { text: '申诉已驳回', class: 'appeal-rejected' },
      };

      const status = statusMap[res.status] || statusMap[0];
      const appealStatus = appealStatusMap[res.workerAppealStatus] || appealStatusMap[0];

      this.setData({
        baseName: res.baseName || '未知基地',
        workDate: formatDate(res.workDate),
        totalAmount: formatAmount(res.totalAmount),
        workDuration: formatAmount(res.workDuration),
        pieceCount: res.pieceCount || '',
        unitPrice: formatAmount(res.unitPriceSnapshot),
        statusText: status.text,
        statusClass: status.class,
        payoutType: res.payoutType || '',
        payoutTypeText: payoutTypeMap[res.payoutType] || '',
        bankCard: res.bankCard || '',
        paidTime: formatDateTime(res.paidTime),
        canConfirm: res.status === 0,
        canAppeal: res.status === 0 && res.workerAppealStatus === 0,
        hasAppeal: res.workerAppealStatus > 0,
        appealStatusText: appealStatus.text,
        appealStatusClass: appealStatus.class,
        appealReason: res.workerAppealReason || '',
        expectedAmount: res.workerExpectedAmount ? formatAmount(res.workerExpectedAmount) : '',
        appealReply: res.appealReply || '',
      });

      wx.hideLoading();
    } catch (err) {
      wx.hideLoading();
      console.error('加载工资详情失败:', err);
      wx.showToast({ title: err.message || '加载失败', icon: 'none' });
    }
  },

  async onConfirm() {
    const result = await new Promise((resolve) => {
      wx.showModal({
        title: '确认工资',
        content: `确认工资金额 ¥${this.data.totalAmount} 无误？`,
        confirmText: '确认',
        cancelText: '取消',
        success: (res) => resolve(res.confirm),
      });
    });

    if (!result) return;

    this.setData({ confirming: true });
    wx.showLoading({ title: '确认中...' });

    try {
      await app.request({
        url: `/salary/worker/${this.data.salaryId}/confirm`,
        method: 'POST',
      });

      wx.hideLoading();
      wx.showToast({ title: '确认成功', icon: 'success' });

      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    } catch (err) {
      wx.hideLoading();
      this.setData({ confirming: false });
      console.error('确认工资失败:', err);
      wx.showToast({ title: err.message || '确认失败', icon: 'none' });
    }
  },

  onAppeal() {
    wx.navigateTo({
      url: `/pages/salary/appeal/appeal?salaryId=${this.data.salaryId}&amount=${this.data.totalAmount}`
    });
  },

  goBack() {
    wx.navigateBack();
  },
});
