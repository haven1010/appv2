const app = getApp();
const { requireAuth } = require('../../../utils/auth-guard');

Page({
  data: {
    consultations: [],
    loading: true,
    pendingCount: 0,
    processingCount: 0,
    completedCount: 0,
  },

  onLoad() {
    if (!requireAuth()) return;
    this.loadConsultations();
  },

  onPullDownRefresh() {
    this.loadConsultations().finally(() => wx.stopPullDownRefresh());
  },

  typeIconMap: {
    wage: '💰',
    contract: '📄',
    injury: '🏥',
    discrimination: '⚖️',
    other: '📋',
  },

  async loadConsultations() {
    this.setData({ loading: true });
    try {
      const res = await app.request({
        url: '/rights/consultations',
        method: 'GET',
      });

      const consultations = this.formatList(Array.isArray(res) ? res : res.list || []);
      this.setDataWithStats(consultations);
    } catch (err) {
      console.error('加载咨询记录失败:', err);

      // Mock数据
      const mockData = [
        {
          id: 1,
          issueType: 'wage',
          description: '我在某基地工作了一个月，但是工资一直没有发放，联系基地负责人也没有回应。',
          status: 0,
          createdAt: '2026-04-25 10:30',
        },
        {
          id: 2,
          issueType: 'contract',
          description: '用工单位未签订劳动合同，工作三个月了没有任何书面协议。',
          status: 1,
          createdAt: '2026-04-28 14:20',
        },
        {
          id: 3,
          issueType: 'other',
          description: '工作时间和之前承诺的不一致，每天要多工作2个小时。',
          status: 2,
          createdAt: '2026-05-10 09:15',
        },
      ];

      this.setDataWithStats(this.formatList(mockData));
    }
  },

  formatList(list) {
    return list.map((item, index) => ({
      id: item.id,
      issueType: item.issueType || 'other',
      issueTypeText: this.getIssueTypeText(item.issueType),
      typeIcon: this.typeIconMap[item.issueType] || '📋',
      description: item.description || '',
      status: item.status || 0,
      statusText: this.getStatusText(item.status),
      statusClass: this.getStatusClass(item.status),
      createdAt: item.createdAt || '',
      delay: `${index * 80}ms`,
    }));
  },

  setDataWithStats(list) {
    this.setData({
      consultations: list,
      loading: false,
      pendingCount: list.filter(i => i.status === 0).length,
      processingCount: list.filter(i => i.status === 1).length,
      completedCount: list.filter(i => i.status === 2).length,
    });
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
