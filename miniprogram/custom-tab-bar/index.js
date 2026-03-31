/**
 * Layer: Mini Program Component
 * Responsibility: Coordinates custom tab bar rendering, selection state, and shared navigation behavior across mini program pages.
 * Notes: Keep comments focused on intent, invariants, side effects, and cross-module contracts.
 */
// custom-tab-bar/index.js
const app = getApp();

Component({
  data: {
    selected: 0,
    role: 'worker',
    workerList: [
      { pagePath: '/pages/index/index', text: '广场', icon: '🏠' },
      { pagePath: '/pages/applications/applications', text: '我的报名', icon: '📋' },
      { pagePath: '/pages/qrcode/qrcode', text: '签到码', icon: '🔳' },
      { pagePath: '/pages/profile/profile', text: '我的', icon: '👤' },
    ],
    fieldList: [
      { pagePath: '/pages/field/home/home', text: '工作台', icon: '📊' },
      { pagePath: '/pages/field/scan/scan', text: '扫码签到', icon: '📲' },
      { pagePath: '/pages/field/records/records', text: '考勤记录', icon: '🗂' },
      { pagePath: '/pages/field/profile/profile', text: '我的', icon: '👤' },
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
      if (this.data.role !== role) {
        this.setData({ role });
      }
    },

    switchTab(e) {
      const data = e.currentTarget.dataset;
      const url = data.path;
      wx.switchTab({ url });
    },
  },
});
