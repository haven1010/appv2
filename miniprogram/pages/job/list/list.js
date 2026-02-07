const app = getApp();

Page({
  data: {
    jobs: [],
    loading: true,
    baseId: null,
    baseName: '',
  },

  onLoad(options) {
    if (options.baseId) {
      this.setData({ baseId: parseInt(options.baseId) });
    }
    if (options.baseName) {
      this.setData({ baseName: decodeURIComponent(options.baseName) });
      wx.setNavigationBarTitle({ title: options.baseName + ' - 岗位' });
    }
    this.loadJobs();
  },

  onPullDownRefresh() {
    this.loadJobs();
    setTimeout(() => wx.stopPullDownRefresh(), 1000);
  },

  async loadJobs() {
    this.setData({ loading: true });

    try {
      if (!this.data.baseId) {
        // No baseId: load all approved bases' jobs (flatten)
        const bases = await app.request({ url: '/base', method: 'GET' });
        const allJobs = [];
        for (const base of (bases || [])) {
          try {
            const jobs = await app.request({
              url: '/base/' + base.id + '/jobs',
              method: 'GET',
            });
            if (Array.isArray(jobs)) {
              jobs.forEach(j => {
                j.baseName = base.baseName || base.name || '-';
              });
              allJobs = allJobs.concat(jobs);
            }
          } catch (_) {}
        }
        this.setData({ jobs: allJobs, loading: false });
      } else {
        const res = await app.request({
          url: '/base/' + this.data.baseId + '/jobs',
          method: 'GET',
        });
        this.setData({
          jobs: Array.isArray(res) ? res : [],
          loading: false,
        });
      }
    } catch (err) {
      console.error('加载岗位列表失败:', err);
      wx.showToast({ title: '加载失败', icon: 'none' });
      this.setData({ loading: false });
    }
  },

  goToDetail(e) {
    const jobId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: '/pages/job/detail/detail?id=' + jobId,
    });
  },

  applyJob(e) {
    const jobId = e.currentTarget.dataset.id;
    const baseId = e.currentTarget.dataset.baseid;
    wx.navigateTo({
      url: '/pages/signup/signup?jobId=' + jobId + '&baseId=' + (baseId || this.data.baseId || ''),
    });
  },
});
