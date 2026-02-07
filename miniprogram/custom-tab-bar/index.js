// custom-tab-bar/index.js
const app = getApp();

Component({
  data: {
    selected: 0,
    role: 'worker',
    // 采摘工导航
    workerList: [
      { pagePath: '/pages/index/index', text: '广场', icon: '🏠', iconOutline: '🏘' },
      { pagePath: '/pages/applications/applications', text: '我的报名', icon: '📋', iconOutline: '📄' },
      { pagePath: '/pages/qrcode/qrcode', text: '签到码', icon: '📱', iconOutline: '📱' },
      { pagePath: '/pages/profile/profile', text: '我的', icon: '👤', iconOutline: '👤' },
    ],
    // 现场管理员导航
    fieldList: [
      { pagePath: '/pages/field/home/home', text: '工作台', icon: '📊', iconOutline: '📊' },
      { pagePath: '/pages/field/scan/scan', text: '扫码签到', icon: '📷', iconOutline: '📷' },
      { pagePath: '/pages/field/records/records', text: '考勤记录', icon: '📋', iconOutline: '📄' },
      { pagePath: '/pages/field/profile/profile', text: '我的', icon: '👤', iconOutline: '👤' },
    ],
  },

  attached() {
    this.updateRole();
  },

  // 每次所在页面显示时重新读取角色
  pageLifetimes: {
    show() {
      this.updateRole();
    },
  },

  methods: {
    updateRole() {
      const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo');
      const role = (userInfo && userInfo.role) ? userInfo.role : 'worker';
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
