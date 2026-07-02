const app = getApp();
const { requireAuth } = require('../../../utils/auth-guard');

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value).replace('T', ' ').slice(0, 19);
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

Page({
  data: {
    applicationId: 0,
    baseName: '',
    jobTitle: '',
    workDate: '',
    statusText: '',
    statusClass: '',
    checkinTime: '',
    checkoutTime: '',
    workDuration: '',
    pieceCount: '',
    notes: '',
    hasSalary: false,
    salaryAmount: '0.00',
    salaryStatusText: '',
    salaryStatusClass: '',
  },

  onLoad(options) {
    if (!requireAuth()) return;
    const applicationId = Number(options.applicationId || 0);
    if (!applicationId) {
      wx.showToast({ title: '参数错误', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }
    this.setData({ applicationId });
    this.loadAttendanceDetail();
  },

  async loadAttendanceDetail() {
    wx.showLoading({ title: '加载中...' });
    try {
      const res = await app.request({
        url: `/attendance/detail/${this.data.applicationId}`,
        method: 'GET',
      });

      const statusMap = {
        0: { text: '待签到', class: 'status-pending' },
        1: { text: '已签到', class: 'status-ok' },
        2: { text: '缺勤', class: 'status-warn' },
      };

      const salaryStatusMap = {
        0: { text: '待确认', class: 'salary-pending' },
        1: { text: '已确认', class: 'salary-confirmed' },
        2: { text: '已发放', class: 'salary-paid' },
      };

      const status = statusMap[res.status] || statusMap[0];
      const salaryStatus = res.salary ? salaryStatusMap[res.salary.status] || salaryStatusMap[0] : null;

      this.setData({
        baseName: res.baseName || '未知基地',
        jobTitle: res.jobTitle || '未命名岗位',
        workDate: formatDate(res.workDate),
        statusText: status.text,
        statusClass: status.class,
        checkinTime: formatDateTime(res.checkinTime),
        checkoutTime: formatDateTime(res.checkoutTime),
        workDuration: res.workDuration || '',
        pieceCount: res.pieceCount || '',
        notes: res.notes || '',
        hasSalary: !!res.salary,
        salaryAmount: res.salary ? Number(res.salary.totalAmount).toFixed(2) : '0.00',
        salaryStatusText: salaryStatus ? salaryStatus.text : '',
        salaryStatusClass: salaryStatus ? salaryStatus.class : '',
      });

      wx.hideLoading();
    } catch (err) {
      wx.hideLoading();
      console.error('加载考勤详情失败:', err);
      wx.showToast({ title: err.message || '加载失败', icon: 'none' });
    }
  },

  goToSalary() {
    wx.switchTab({ url: '/pages/salary/salary' });
  },

  goBack() {
    wx.navigateBack();
  },
});
