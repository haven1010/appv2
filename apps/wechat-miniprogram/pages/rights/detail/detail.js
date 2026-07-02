const app = getApp();
const { requireAuth } = require('../../../utils/auth-guard');

Page({
  data: {
    consultationId: 0,
    consultation: null,
    loading: true,
  },

  onLoad(options) {
    if (!requireAuth()) return;
    const id = Number(options.id || 0);
    if (!id) {
      wx.showToast({ title: '参数错误', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }
    this.setData({ consultationId: id });
    this.loadDetail();
  },

  async loadDetail() {
    wx.showLoading({ title: '加载中...' });
    try {
      const res = await app.request({
        url: `/rights/consultations/${this.data.consultationId}`,
        method: 'GET',
      });

      this.setData({
        consultation: {
          id: res.id,
          issueType: this.getIssueTypeText(res.issueType),
          description: res.description || '',
          contactPhone: res.contactPhone || '',
          status: res.status || 0,
          statusText: this.getStatusText(res.status),
          statusClass: this.getStatusClass(res.status),
          createdAt: res.createdAt || '',
          reply: res.reply || '',
          repliedAt: res.repliedAt || '',
        },
        loading: false,
      });

      wx.hideLoading();
    } catch (err) {
      wx.hideLoading();
      console.error('加载详情失败:', err);

      // Mock数据
      const mockConsultation = {
        id: this.data.consultationId,
        issueType: 'wage',
        description: '我在某基地工作了一个月，但是工资一直没有发放，联系基地负责人也没有回应。',
        contactPhone: '138****5678',
        status: 1,
        statusText: this.getStatusText(1),
        statusClass: this.getStatusClass(1),
        createdAt: '2026-04-25 10:30:00',
        reply: '',
        repliedAt: '',
      };

      this.setData({
        consultation: {
          ...mockConsultation,
          issueType: this.getIssueTypeText(mockConsultation.issueType),
        },
        loading: false,
      });
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

  goBack() {
    wx.navigateBack();
  },
});
