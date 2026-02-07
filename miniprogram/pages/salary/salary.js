const app = getApp();

Page({
  data: {
    stats: null,
    pendingList: [],
    loading: true,
  },

  onLoad() {
    this.loadSalaryData();
  },

  onShow() {
    this.loadSalaryData();
  },

  onPullDownRefresh() {
    this.loadSalaryData();
    setTimeout(() => wx.stopPullDownRefresh(), 1000);
  },

  async loadSalaryData() {
    this.setData({ loading: true });

    try {
      var results = await Promise.all([
        app.request({ url: '/salary/worker/stats', method: 'GET' }).catch(function() { return null; }),
        app.request({ url: '/salary/worker/pending', method: 'GET' }).catch(function() { return []; }),
      ]);
      var stats = results[0];
      var pendingList = results[1];

      this.setData({
        stats: stats || { totalDays: 0, totalEarned: 0, pendingAmount: 0 },
        pendingList: Array.isArray(pendingList) ? pendingList : [],
        loading: false,
      });
    } catch (err) {
      console.error('加载薪资数据失败:', err);
      wx.showToast({ title: '加载失败', icon: 'none' });
      this.setData({ loading: false });
    }
  },

  async confirmSalary(e) {
    const salaryId = e.currentTarget.dataset.id;

    wx.showModal({
      title: '确认工资',
      content: '确认后表示您认可该笔工资金额，是否继续？',
      success: async (res) => {
        if (!res.confirm) return;

        wx.showLoading({ title: '确认中...' });
        try {
          await app.request({
            url: '/salary/' + salaryId + '/worker-confirm',
            method: 'PATCH',
          });
          wx.hideLoading();
          wx.showToast({ title: '确认成功', icon: 'success' });
          this.loadSalaryData();
        } catch (err) {
          wx.hideLoading();
          console.error('确认工资失败:', err);
          wx.showToast({ title: err.message || '确认失败', icon: 'none' });
        }
      },
    });
  },
});
