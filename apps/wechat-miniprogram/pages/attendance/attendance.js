const { requireAuth } = require('../../utils/auth-guard');

function formatTodayInfo() {
  const now = new Date();
  const weekMap = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const month = now.getMonth() + 1;
  const date = now.getDate();
  const hour = now.getHours();

  let periodText = '夜间';
  if (hour >= 6 && hour < 12) periodText = '上午';
  if (hour >= 12 && hour < 18) periodText = '下午';
  if (hour >= 18 && hour < 24) periodText = '晚上';

  return {
    dateText: `${month}月${date}日`,
    weekText: weekMap[now.getDay()],
    periodText,
  };
}

Page({
  data: {
    pageReady: false,
    dateText: '',
    weekText: '',
    periodText: '',
  },

  onLoad() {
    if (!requireAuth()) return;
    const today = formatTodayInfo();
    this.setData({
      dateText: today.dateText,
      weekText: today.weekText,
      periodText: today.periodText,
    });

    setTimeout(() => {
      this.setData({ pageReady: true });
    }, 30);
  },

  goToQrcode() {
    wx.navigateTo({ url: '/pages/qrcode/qrcode' });
  },

  goToWorkHistory() {
    wx.navigateTo({ url: '/pages/profile/workHistory/workHistory' });
  },

  goToSalary() {
    wx.navigateTo({ url: '/pages/salary/salary' });
  },
});
