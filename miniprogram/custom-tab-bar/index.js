/**
 * Layer: Mini Program Component
 * Responsibility: Renders the custom tab bar and handles role-aware tab navigation.
 */
const app = getApp();

Component({
  data: {
    selected: 0,
    role: 'worker',
    workerList: [
      { pagePath: '/pages/index/index', text: '广场', icon: '广' },
      { pagePath: '/pages/salary/salary', text: '收入', icon: '收' },
      { pagePath: '/pages/qrcode/qrcode', text: '二维码', icon: '码', center: true },
      { pagePath: '/pages/applications/applications', text: 'AI', icon: 'AI' },
      { pagePath: '/pages/profile/profile', text: '我的', icon: '我' },
    ],
    fieldList: [
      { pagePath: '/pages/field/home/home', text: '工作台', icon: '工' },
      { pagePath: '/pages/field/scan/scan', text: '扫码', icon: '扫' },
      { pagePath: '/pages/field/records/records', text: '记录', icon: '记' },
      { pagePath: '/pages/field/profile/profile', text: '我的', icon: '我' },
    ],
  },

  attached() {
    this.updateRole();
  },

  pageLifetimes: {
    show() {
      this.updateRole();
    },
  },

  methods: {
    updateRole() {
      const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo');
      const role = userInfo && userInfo.role ? userInfo.role : 'worker';
      if (role !== this.data.role) {
        this.setData({ role });
      }
    },

    switchTab(e) {
      const { path } = e.currentTarget.dataset;
      if (!path) return;
      wx.switchTab({ url: path });
    },
  },
});
