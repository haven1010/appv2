const app = getApp();
const { requireAuth } = require('../../../utils/auth-guard');

Page({
  data: {
    applicationId: 0,
    baseName: '',
    jobTitle: '',
    rating: 0,
    comment: '',
    submitting: false,
    categories: [
      { key: 'environment', label: '工作环境', desc: '现场条件、休息安排、工具情况', rating: 0 },
      { key: 'management', label: '管理态度', desc: '沟通是否清楚，安排是否合理', rating: 0 },
      { key: 'payment', label: '工资准时', desc: '工资说明和结算是否清晰', rating: 0 },
    ],
  },

  onLoad(options) {
    if (!requireAuth()) return;
    const applicationId = Number(options.applicationId || 0);
    const baseName = options.baseName || '';
    const jobTitle = options.jobTitle || '';

    if (!applicationId) {
      wx.showToast({ title: '参数错误', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }

    this.setData({
      applicationId,
      baseName,
      jobTitle,
    });
  },

  onOverallRatingTap(e) {
    const rating = Number(e.currentTarget.dataset.rating || 0);
    this.setData({ rating });
  },

  onCategoryRatingTap(e) {
    const index = Number(e.currentTarget.dataset.index);
    const rating = Number(e.currentTarget.dataset.rating || 0);
    const categories = [...this.data.categories];
    categories[index].rating = rating;
    this.setData({ categories });
  },

  onCommentInput(e) {
    this.setData({ comment: e.detail.value || '' });
  },

  async onSubmit() {
    if (this.data.rating === 0) {
      wx.showToast({ title: '请选择总体评分', icon: 'none' });
      return;
    }

    const categoryRatings = {};
    this.data.categories.forEach(cat => {
      if (cat.rating > 0) {
        categoryRatings[cat.key] = cat.rating;
      }
    });

    const payload = {
      rating: this.data.rating,
      comment: String(this.data.comment || '').trim(),
      categoryRatings,
    };

    this.setData({ submitting: true });
    wx.showLoading({ title: '提交中...' });

    try {
      await app.request({
        url: `/base/applications/${this.data.applicationId}/review`,
        method: 'POST',
        data: payload,
      });

      wx.hideLoading();
      wx.showToast({ title: '评价已提交', icon: 'success' });

      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    } catch (err) {
      wx.hideLoading();
      this.setData({ submitting: false });
      console.error('提交评价失败:', err);
      wx.showToast({ title: err.message || '提交失败', icon: 'none' });
    }
  },

  goBack() {
    wx.navigateBack();
  },
});
