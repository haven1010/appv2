const app = getApp();

Page({
  data: {
    consultations: [],
    loading: true,
  },

  onLoad() {
    this.loadConsultations();
  },

  onPullDownRefresh() {
    this.loadConsultations().finally(() => wx.stopPullDownRefresh());
  },

  async loadConsultations() {
    this.setData({ loading: true });
    try {
      const res = await app.request({
        url: '/rights/consultations',
        method: 'GET',
      });

      const consultations = (Array.isArray(res) ? res : res.list || []).map((item, index) => ({
        id: item.id,
        issueType: item.issueType || 'other',
        issueTypeText: this.getIssueTypeText(item.issueType),
        description: item.description || '',
        status: item.status || 0,
        statusText: this.getStatusText(item.status),
        statusClass: this.getStatusClass(item.status),
        createdAt: item.createdAt || '',
        delay: `${index * 80}ms`,
      }));

      this.setData({ consultations, loading: false });
    } catch (err) {
      console.error('加载咨询记录失败:', err);

      // Mock数据
      const mockConsultations = [
        {
          id: 1,
          issueType: 'wage',
          description: '我在某基地工作了一个月，但是工资一直没有发放',
          status: 1,
          createdAt: '2026-04-25 10:30:00',
        },
        {
          id: 2,
          issueType: 'contract',
          description: '用工单位未签订劳动合同',
          status: 0,
          createdAt: '2026-04-28 14:20:00',
        },
      ].map((item, index) => ({
        ...item,
        issueTypeText: this.getIssueTypeText(item.issueType),
        statusText: this.getStatusText(item.status),
        statusClass: this.getStatusClass(item.status),
        delay: `${index * 80}ms`,
      }));

      this.setData({ consultations: mockConsultations, loading: false });
    }
  },

  getIssueTypeText(type) {
    const map = {
      wage: '工资拖欠',
      contract: '合同纠纷',
      injury: '工伤事故',
      discrimination: '就业歧视',
      other: '其他问题',
    };
    return map[type] || '其他问题';
  },

  getStatusText(status) {
    if (status === 1) return '处理中';
    if (status === 2) return '已完成';
    return '待受理';
  },

  getStatusClass(status) {
    if (status === 1) return 'status-processing';
    if (status === 2) return 'status-completed';
    return 'status-pending';
  },

  goToDetail(e) {
    const id = Number(e.currentTarget.dataset.id);
    wx.navigateTo({
      url: `/pages/rights/detail/detail?id=${id}`,
    });
  },

  goToConsult() {
    wx.navigateTo({
      url: '/pages/rights/consult/consult',
    });
  },
});
