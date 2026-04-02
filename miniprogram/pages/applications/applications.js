/**
 * Layer: Mini Program Page
 * Responsibility: Provides AI assistant preview UI and placeholder interaction for future chat/recommendation features.
 * Notes: No API integration yet; state shape is prepared for future expansion.
 */
const { resolveRole, isAdminRole } = require('../../utils/role');

Page({
  data: {
    pageReady: false,
    draftInput: '',
    featureCards: [
      {
        id: 'recommend',
        icon: '🧭',
        title: '找工作推荐',
        desc: '根据你的情况推荐岗位',
      },
      {
        id: 'salary',
        icon: '🧮',
        title: '工资计算',
        desc: '自动帮你算收入',
      },
      {
        id: 'qa',
        icon: '💬',
        title: '问答助手',
        desc: '有问题随时问',
      },
    ],
    quickActions: [
      { id: 'recommend', text: '推荐岗位' },
      { id: 'ask', text: '问一问' },
    ],
    // Future extensibility:
    // 1. Append bot/user messages to chatMessages.
    // 2. Bind input for streaming chat.
    // 3. Integrate model API request in send flow.
    chatMessages: [],
    isSending: false,
  },

  onLoad() {
    if (this.redirectIfRoleNotWorker()) return;
    this.readyTimer = setTimeout(() => {
      this.setData({ pageReady: true });
    }, 30);
  },

  onShow() {
    if (this.redirectIfRoleNotWorker()) return;
    const tabBar = this.getTabBar && this.getTabBar();
    if (tabBar) {
      tabBar.setData({ selected: 3 });
    }
  },

  onPullDownRefresh() {
    wx.stopPullDownRefresh();
  },

  onUnload() {
    if (this.readyTimer) {
      clearTimeout(this.readyTimer);
      this.readyTimer = null;
    }
  },

  redirectIfRoleNotWorker() {
    const userInfo = wx.getStorageSync('userInfo');
    const role = resolveRole(userInfo);
    if (role === 'boss') {
      wx.reLaunch({ url: '/pages/base/list/list' });
      return true;
    }
    if (isAdminRole(role)) {
      wx.reLaunch({ url: '/pages/admin/home/home' });
      return true;
    }
    return false;
  },

  handleQuickAction() {
    wx.showToast({
      title: '功能开发中',
      icon: 'none',
    });
  },

  goToHome() {
    wx.switchTab({ url: '/pages/index/index' });
  },
});
