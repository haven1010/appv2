const app = getApp();
const { requireAuth } = require('../../../utils/auth-guard');
const { ensureRealNameReady } = require('../../../utils/realname');

Page({
  data: {
    issueType: '',
    issueTypeIndex: -1,
    description: '',
    contactPhone: '',
    attachments: [],
    submitting: false,
    issueTypes: [
      { value: 'wage', label: '工资拖欠' },
      { value: 'contract', label: '合同纠纷' },
      { value: 'injury', label: '工伤事故' },
      { value: 'discrimination', label: '就业歧视' },
      { value: 'other', label: '其他问题' },
    ],
  },

  onLoad() {
    if (!requireAuth()) return;
  },

  onIssueTypeChange(e) {
    const index = Number(e.detail.value);
    const issueType = this.data.issueTypes[index];
    this.setData({
      issueTypeIndex: index,
      issueType: issueType.value,
    });
  },

  onDescriptionInput(e) {
    this.setData({ description: e.detail.value || '' });
  },

  onPhoneInput(e) {
    this.setData({ contactPhone: e.detail.value || '' });
  },

  chooseImage() {
    wx.chooseImage({
      count: 3 - this.data.attachments.length,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const attachments = [...this.data.attachments, ...res.tempFilePaths];
        this.setData({ attachments });
      },
    });
  },

  removeImage(e) {
    const index = Number(e.currentTarget.dataset.index);
    const attachments = this.data.attachments.filter((_, i) => i !== index);
    this.setData({ attachments });
  },

  async onSubmit() {
    const realNameReady = await ensureRealNameReady({
      title: '完成实名后提交咨询',
      content: '维权咨询涉及个人劳动权益，请先完善实名信息。',
    });
    if (!realNameReady) return;

    if (!this.data.issueType) {
      wx.showToast({ title: '请选择问题类型', icon: 'none' });
      return;
    }

    const description = String(this.data.description || '').trim();
    if (!description) {
      wx.showToast({ title: '请描述您的问题', icon: 'none' });
      return;
    }

    if (description.length < 10) {
      wx.showToast({ title: '问题描述至少10个字', icon: 'none' });
      return;
    }

    const contactPhone = String(this.data.contactPhone || '').trim();
    if (!contactPhone) {
      wx.showToast({ title: '请填写联系电话', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });
    wx.showLoading({ title: '提交中...' });

    try {
      const payload = {
        issueType: this.data.issueType,
        description,
        contactPhone,
        attachments: this.data.attachments,
      };

      await app.request({
        url: '/rights/consultations',
        method: 'POST',
        data: payload,
      });

      wx.hideLoading();
      wx.showToast({ title: '提交成功', icon: 'success' });

      setTimeout(() => {
        wx.navigateTo({
          url: '/pages/rights/list/list',
        });
      }, 1500);
    } catch (err) {
      wx.hideLoading();
      this.setData({ submitting: false });
      console.error('提交失败:', err);

      // Mock模式：API未实现时也显示成功
      if (err.message && err.message.includes('暂未支持接口')) {
        wx.showToast({ title: '提交成功（演示模式）', icon: 'success' });
        setTimeout(() => {
          wx.navigateTo({
            url: '/pages/rights/list/list',
          });
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
