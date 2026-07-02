const app = getApp();
const { requireAuth } = require('../../../utils/auth-guard');

Page({
  data: {
    salaryId: 0,
    currentAmount: '0.00',
    reason: '',
    expectedAmount: '',
    submitting: false,
  },

  onLoad(options) {
    if (!requireAuth()) return;
    const salaryId = Number(options.salaryId || 0);
    const currentAmount = options.amount || '0.00';

    if (!salaryId) {
      wx.showToast({ title: '参数错误', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }

    this.setData({
      salaryId,
      currentAmount,
    });
  },

  onReasonInput(e) {
    this.setData({ reason: e.detail.value || '' });
  },

  onExpectedAmountInput(e) {
    this.setData({ expectedAmount: e.detail.value || '' });
  },

  async onSubmit() {
    const reason = String(this.data.reason || '').trim();
    if (!reason) {
      wx.showToast({ title: '请填写申诉原因', icon: 'none' });
      return;
    }

    if (reason.length < 10) {
      wx.showToast({ title: '申诉原因至少10个字', icon: 'none' });
      return;
    }

    const payload = { reason };
    const expectedAmountText = String(this.data.expectedAmount || '').trim();
    if (expectedAmountText) {
      const amount = Number(expectedAmountText);
      if (!Number.isFinite(amount) || amount <= 0) {
        wx.showToast({ title: '期望金额格式不正确', icon: 'none' });
        return;
      }
      payload.expectedAmount = expectedAmountText;
    }

    this.setData({ submitting: true });
    wx.showLoading({ title: '提交中...' });

    try {
      await app.request({
        url: `/salary/worker/${this.data.salaryId}/appeal`,
        method: 'POST',
        data: payload,
      });

      wx.hideLoading();
      wx.showToast({ title: '申诉已提交', icon: 'success' });

      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    } catch (err) {
      wx.hideLoading();
      this.setData({ submitting: false });
      console.error('提交申诉失败:', err);
      wx.showToast({ title: err.message || '提交失败', icon: 'none' });
    }
  },

  goBack() {
    wx.navigateBack();
  },
});
