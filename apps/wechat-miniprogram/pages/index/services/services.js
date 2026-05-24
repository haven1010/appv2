Page({
  data: {
    items: [
      {
        key: 'card',
        title: '银行卡',
        desc: '查看和维护工资收款银行卡',
        url: '/pages/profile/salaryCard/salaryCard',
      },
      {
        key: 'history',
        title: '工作历程',
        desc: '查看历次务工归档和工资记录',
        url: '/pages/profile/workHistory/workHistory',
      },
      {
        key: 'profile',
        title: '基本信息',
        desc: '查看姓名、电话和实名资料',
        url: '/pages/profile/userInfo/userInfo',
      },
      {
        key: 'ai',
        title: '小玉服务',
        desc: '智能问答与就业辅助',
        url: '/pages/ai/chat/chat',
      },
    ],
  },

  onItemTap(e) {
    const url = e.currentTarget.dataset.url;
    if (!url) return;
    wx.navigateTo({ url });
  },
});
