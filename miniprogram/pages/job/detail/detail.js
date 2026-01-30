// pages/job/detail/detail.js
const app = getApp();

Page({
  data: {
    jobId: null,
    baseId: null,
    jobInfo: null,
    loading: true,
  },

  onLoad(options) {
    if (options.id) {
      this.setData({
        jobId: parseInt(options.id),
        baseId: options.baseId ? parseInt(options.baseId) : null,
      });
      this.loadJobDetail();
    }
  },

  async loadJobDetail() {
    try {
      const res = await app.request({
        url: `/base/jobs/${this.data.jobId}`,
        method: 'GET',
      });

      this.setData({
        jobInfo: res,
        loading: false,
      });
    } catch (err) {
      console.error('加载岗位详情失败:', err);
      wx.showToast({
        title: '加载失败',
        icon: 'none',
      });
      this.setData({ loading: false });
    }
  },

  async handleApply() {
    const token = wx.getStorageSync('token');
    if (!token) {
      wx.showModal({
        title: '提示',
        content: '请先登录',
        showCancel: false,
        success: () => {
          wx.navigateTo({
            url: '/pages/login/login'
          });
        }
      });
      return;
    }

    if (!this.data.baseId) {
      wx.showToast({
        title: '基地ID缺失',
        icon: 'none',
      });
      return;
    }

    wx.showModal({
      title: '确认申请',
      content: '确定要申请这个岗位吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            await app.request({
              url: `/base/jobs/${this.data.jobId}/apply`,
              method: 'POST',
              data: {
                baseId: this.data.baseId,
                note: '我想申请这个岗位',
              },
            });

            wx.showToast({
              title: '申请成功',
              icon: 'success',
            });

            setTimeout(() => {
              wx.navigateBack();
            }, 1500);
          } catch (err) {
            wx.showToast({
              title: err.message || '申请失败',
              icon: 'none',
            });
          }
        }
      }
    });
  },
});
