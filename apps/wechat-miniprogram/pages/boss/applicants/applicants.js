const app = getApp();

function toText(value) {
  return String(value || '').trim();
}

function toArray(value) {
  if (Array.isArray(value)) return value;
  if (value && Array.isArray(value.list)) return value.list;
  return [];
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function statusText(status) {
  const code = Number(status);
  if (code === 1) return '已录用';
  if (code === 2) return '已拒绝';
  if (code === 3) return '已取消';
  return '待处理';
}

function statusClass(status) {
  const code = Number(status);
  if (code === 1) return 'approved';
  if (code === 2) return 'rejected';
  if (code === 3) return 'cancelled';
  return 'pending';
}

Page({
  data: {
    bases: [],
    baseIndex: 0,
    baseId: '',
    jobs: [],
    jobIndex: 0,
    jobId: '',
    applicants: [],
    loading: true,
    filterStatus: 0,
    statusFilters: [
      { label: '全部', value: 0 },
      { label: '待处理', value: -1 },
      { label: '已录用', value: 1 },
      { label: '已拒绝', value: 2 },
    ],
  },

  async onLoad() {
    await this.loadBases();
    if (this.data.baseId) {
      await this.loadJobs();
      if (this.data.jobId) {
        await this.loadApplicants();
      }
    }
  },

  onPullDownRefresh() {
    this.loadApplicants().finally(() => wx.stopPullDownRefresh());
  },

  async loadBases() {
    try {
      const userInfo = wx.getStorageSync('userInfo') || {};
      const ownerId = Number(userInfo.id || userInfo.userId || 0);
      const res = await app.request({
        url: ownerId ? `/base?ownerId=${ownerId}` : '/base',
        method: 'GET',
      });

      const bases = toArray(res).map((item) => ({
        id: Number(item.id),
        baseName: item.baseName || item.name || `基地 #${item.id}`,
      }));

      if (bases.length > 0) {
        this.setData({
          bases,
          baseIndex: 0,
          baseId: String(bases[0].id),
        });
      }
    } catch (err) {
      console.error('加载基地失败:', err);

      // Mock数据
      const mockBases = [
        { id: 1, baseName: '阳光果园' },
        { id: 2, baseName: '绿野蔬菜基地' },
      ];
      this.setData({
        bases: mockBases,
        baseIndex: 0,
        baseId: String(mockBases[0].id),
      });
    }
  },

  async loadJobs() {
    if (!this.data.baseId) return;

    try {
      const res = await app.request({
        url: `/base/${this.data.baseId}/jobs`,
        method: 'GET',
      });

      const jobs = toArray(res).map((item) => ({
        id: Number(item.id),
        jobTitle: item.jobTitle || item.title || '岗位',
        status: item.status,
      }));

      if (jobs.length > 0) {
        this.setData({
          jobs,
          jobIndex: 0,
          jobId: String(jobs[0].id),
        });
      } else {
        this.setData({ jobs: [], jobIndex: 0, jobId: '' });
      }
    } catch (err) {
      console.error('加载岗位失败:', err);

      // Mock数据
      const mockJobs = [
        { id: 1, jobTitle: '采摘工', status: 1 },
        { id: 2, jobTitle: '包装工', status: 1 },
      ];
      this.setData({
        jobs: mockJobs,
        jobIndex: 0,
        jobId: String(mockJobs[0].id),
      });
    }
  },

  async loadApplicants() {
    if (!this.data.jobId) {
      this.setData({ applicants: [], loading: false });
      return;
    }

    this.setData({ loading: true });

    try {
      const res = await app.request({
        url: `/jobs/${this.data.jobId}/applicants`,
        method: 'GET',
      });

      const applicants = toArray(res).map((item, index) => ({
        id: Number(item.id),
        userId: Number(item.userId || item.user?.id || 0),
        userName: item.userName || item.user?.name || item.workerName || '未知',
        userPhone: item.userPhone || item.user?.phone || item.phone || '-',
        status: Number(item.status || 0),
        statusText: statusText(item.status),
        statusClass: statusClass(item.status),
        workDate: formatDate(item.workDate || item.createdAt),
        note: item.note || '',
        delay: `${index * 60}ms`,
      }));

      const filtered = this.filterApplicants(applicants);
      this.setData({ applicants: filtered, loading: false });
    } catch (err) {
      console.error('加载报名人员失败:', err);

      // Mock数据
      const mockApplicants = [
        {
          id: 1,
          userId: 101,
          userName: '张三',
          userPhone: '138****1234',
          status: 0,
          statusText: statusText(0),
          statusClass: statusClass(0),
          workDate: formatDate(new Date()),
          note: '有采摘经验',
          delay: '0ms',
        },
        {
          id: 2,
          userId: 102,
          userName: '李四',
          userPhone: '139****5678',
          status: 0,
          statusText: statusText(0),
          statusClass: statusClass(0),
          workDate: formatDate(new Date()),
          note: '',
          delay: '60ms',
        },
        {
          id: 3,
          userId: 103,
          userName: '王五',
          userPhone: '137****9012',
          status: 1,
          statusText: statusText(1),
          statusClass: statusClass(1),
          workDate: formatDate(new Date()),
          note: '',
          delay: '120ms',
        },
      ];

      const filtered = this.filterApplicants(mockApplicants);
      this.setData({ applicants: filtered, loading: false });
    }
  },

  filterApplicants(applicants) {
    const filterStatus = this.data.filterStatus;
    if (filterStatus === 0) return applicants;
    if (filterStatus === -1) return applicants.filter((item) => item.status === 0);
    return applicants.filter((item) => item.status === filterStatus);
  },

  onBaseChange(e) {
    const index = Number(e.detail.value);
    const base = this.data.bases[index];
    if (!base) return;

    this.setData({
      baseIndex: index,
      baseId: String(base.id),
      jobs: [],
      jobIndex: 0,
      jobId: '',
      applicants: [],
    });

    this.loadJobs().then(() => {
      if (this.data.jobId) {
        this.loadApplicants();
      }
    });
  },

  onJobChange(e) {
    const index = Number(e.detail.value);
    const job = this.data.jobs[index];
    if (!job) return;

    this.setData({
      jobIndex: index,
      jobId: String(job.id),
    });

    this.loadApplicants();
  },

  onFilterChange(e) {
    const index = Number(e.detail.value);
    const filter = this.data.statusFilters[index];
    this.setData({ filterStatus: filter.value });
    this.loadApplicants();
  },

  async approveApplicant(e) {
    const id = Number(e.currentTarget.dataset.id);
    if (!id) return;

    wx.showModal({
      title: '确认录用',
      content: '确定录用该报名人员吗？',
      success: async (res) => {
        if (!res.confirm) return;

        wx.showLoading({ title: '处理中...' });
        try {
          await app.request({
            url: `/applicants/${id}/approve`,
            method: 'POST',
          });

          wx.showToast({ title: '已录用', icon: 'success' });
          this.loadApplicants();
        } catch (err) {
          console.error('录用失败:', err);

          // Mock模式
          if (err.message && err.message.includes('暂未支持接口')) {
            wx.showToast({ title: '已录用（演示模式）', icon: 'success' });
            setTimeout(() => this.loadApplicants(), 1500);
          } else {
            wx.showToast({ title: err.message || '操作失败', icon: 'none' });
          }
        } finally {
          wx.hideLoading();
        }
      },
    });
  },

  async rejectApplicant(e) {
    const id = Number(e.currentTarget.dataset.id);
    if (!id) return;

    wx.showModal({
      title: '拒绝报名',
      content: '确定拒绝该报名人员吗？',
      success: async (res) => {
        if (!res.confirm) return;

        wx.showLoading({ title: '处理中...' });
        try {
          await app.request({
            url: `/applicants/${id}/reject`,
            method: 'POST',
          });

          wx.showToast({ title: '已拒绝', icon: 'success' });
          this.loadApplicants();
        } catch (err) {
          console.error('拒绝失败:', err);

          // Mock模式
          if (err.message && err.message.includes('暂未支持接口')) {
            wx.showToast({ title: '已拒绝（演示模式）', icon: 'success' });
            setTimeout(() => this.loadApplicants(), 1500);
          } else {
            wx.showToast({ title: err.message || '操作失败', icon: 'none' });
          }
        } finally {
          wx.hideLoading();
        }
      },
    });
  },

  callApplicant(e) {
    const phone = toText(e.currentTarget.dataset.phone);
    if (!phone || phone === '-') {
      wx.showToast({ title: '电话号码无效', icon: 'none' });
      return;
    }

    wx.makePhoneCall({ phoneNumber: phone });
  },
});
