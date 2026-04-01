/**
 * Layer: Mini Program Page
 * Responsibility: Implements the List page lifecycle, local interaction state, and backend integration for the WeChat client.
 * Notes: Keep comments focused on intent, invariants, side effects, and cross-module contracts.
 */
const app = getApp();

Page({
  data: {
    jobs: [],
    viewJobs: [],
    loading: true,
    baseId: null,
    baseName: '',
    keyword: '',
    statusFilter: 'all',
    openCount: 0,
    closedCount: 0,
  },

  onLoad(options) {
    if (options.baseId) {
      this.setData({ baseId: parseInt(options.baseId, 10) });
    }
    if (options.baseName) {
      const decodedBaseName = decodeURIComponent(options.baseName);
      this.setData({ baseName: decodedBaseName });
      wx.setNavigationBarTitle({ title: `${decodedBaseName} - 岗位` });
    }
    this.loadJobs();
  },

  onPullDownRefresh() {
    this.loadJobs();
    setTimeout(() => wx.stopPullDownRefresh(), 1000);
  },

  isOpenStatus(status) {
    return status === 1 || status === 'recruiting' || status === 'open';
  },

  applyFilters() {
    const allJobs = Array.isArray(this.data.jobs) ? this.data.jobs : [];
    const keyword = (this.data.keyword || '').trim().toLowerCase();
    const statusFilter = this.data.statusFilter;

    const viewJobs = allJobs.filter((item) => {
      const title = (item.jobTitle || item.title || '').toLowerCase();
      const base = (item.baseName || '').toLowerCase();
      const matchKeyword = !keyword || title.includes(keyword) || base.includes(keyword);
      const open = this.isOpenStatus(item.status);
      const matchStatus =
        statusFilter === 'all' ||
        (statusFilter === 'open' && open) ||
        (statusFilter === 'closed' && !open);
      return matchKeyword && matchStatus;
    });

    const openCount = allJobs.filter((item) => this.isOpenStatus(item.status)).length;
    const closedCount = Math.max(0, allJobs.length - openCount);

    this.setData({
      viewJobs,
      openCount,
      closedCount,
    });
  },

  onKeywordInput(e) {
    this.setData({ keyword: e.detail.value || '' }, () => {
      this.applyFilters();
    });
  },

  onStatusChange(e) {
    const status = e.currentTarget.dataset.status || 'all';
    if (status === this.data.statusFilter) return;
    this.setData({ statusFilter: status }, () => {
      this.applyFilters();
    });
  },

  async loadJobs() {
    this.setData({ loading: true });

    try {
      if (!this.data.baseId) {
        // No baseId: load all approved bases' jobs (flatten)
        const bases = await app.request({ url: '/base', method: 'GET' });
        let allJobs = [];
        for (const base of (bases || [])) {
          try {
            const jobs = await app.request({
              url: '/base/' + base.id + '/jobs',
              method: 'GET',
            });
            if (Array.isArray(jobs)) {
              jobs.forEach((job) => {
                job.baseName = base.baseName || base.name || '-';
              });
              allJobs = allJobs.concat(jobs);
            }
          } catch (_) {
            // Keep loading other bases.
          }
        }
        this.setData({ jobs: allJobs, loading: false }, () => {
          this.applyFilters();
        });
      } else {
        const res = await app.request({
          url: '/base/' + this.data.baseId + '/jobs',
          method: 'GET',
        });
        const list = Array.isArray(res) ? res : [];
        this.setData(
          {
            jobs: list,
            loading: false,
          },
          () => {
            this.applyFilters();
          },
        );
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