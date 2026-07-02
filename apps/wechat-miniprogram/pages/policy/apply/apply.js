const app = getApp();
const { requireAuth } = require('../../../utils/auth-guard');
const { ensureRealNameReady } = require('../../../utils/realname');

Page({
  data: {
    policyId: 0,
    policyTitle: '',
    name: '',
    phone: '',
    idCard: '',
    reason: '',
    submitting: false,
  },

  onLoad(options) {
    if (!requireAuth()) return;
    const policyId = Number(options.policyId || 0);
    const policyTitle = decodeURIComponent(options.title || '');

    if (!policyId) {
      wx.showToast({ title: '参数错误', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }

    this.setData({ policyId, policyTitle });
  },

  onNameInput(e) {
    this.setData({ name: e.detail.value || '' });
  },

  onPhoneInput(e) {
    this.setData({ phone: e.detail.value || '' });
  },

  onIdCardInput(e) {
    this.setData({ idCard: e.detail.value || '' });
  },

  onReasonInput(e) {
    this.setData({ reason: e.detail.value || '' });
  },

  async onSubmit() {
    const realNameReady = await ensureRealNameReady({
      title: '完成实名后申请政策',
      content: '政策申请需要使用实名信息，请先完成认证。',
    });
    if (!realNameReady) return;

    const name = String(this.data.name || '').trim();
    if (!name) {
      wx.showToast({ title: '请填写姓名', icon: 'none' });
      return;
    }

    const phone = String(this.data.phone || '').trim();
    if (!phone) {
      wx.showToast({ title: '请填写联系电话', icon: 'none' });
      return;
    }

    const idCard = String(this.data.idCard || '').trim();
    if (!idCard) {
      wx.showToast({ title: '请填写身份证号', icon: 'none' });
      return;
    }

    const reason = String(this.data.reason || '').trim();
    if (!reason) {
      wx.showToast({ title: '请填写申请理由', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });
    wx.showLoading({ title: '提交中...' });

    try {
      await app.request({
        url: '/policy/applications',
        method: 'POST',
        data: {
          policyId: this.data.policyId,
          name,
          phone,
          idCard,
          reason,
        },
      });

      wx.hideLoading();
      wx.showToast({ title: '提交成功', icon: 'success' });

      setTimeout(() => {
        wx.navigateBack({ delta: 2 });
      }, 1500);
    } catch (err) {
      wx.hideLoading();
      this.setData({ submitting: false });
      console.error('提交失败:', err);

      // Mock模式：API未实现时也显示成功
      if (err.message && err.message.includes('暂未支持接口')) {
        wx.showToast({ title: '提交成功（演示模式）', icon: 'success' });
        setTimeout(() => {
          wx.navigateBack({ delta: 2 });
        }, 1500);
      } else {
        wx.showToast({ title: err.message || '提交失败', icon: 'none' });
      }
    }
  },

  goBack() {
    wx.navigateBack();
  },
});
