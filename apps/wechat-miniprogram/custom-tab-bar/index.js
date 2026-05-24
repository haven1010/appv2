const app = getApp();

const WORKER_TABS = [
  { pagePath: '/pages/index/index', text: '广场', icon: '场' },
  { pagePath: '/pages/profile/salaryCard/salaryCard', text: '收入', icon: '收' },
  { pagePath: '/pages/qrcode/qrcode', text: '二维码', icon: '码', center: true },
  { pagePath: '/pages/profile/workHistory/workHistory', text: '途程', icon: '途' },
  { pagePath: '/pages/profile/profile', text: '我的', icon: '我' },
];

const FIELD_TABS = [
  { pagePath: '/pages/field/home/home', text: '工作台', icon: '工' },
];

const BOSS_TABS = [
  { pagePath: '/pages/base/list/list', text: '基地', icon: '基' },
  { pagePath: '/pages/job/list/list', text: '岗位', icon: '岗' },
  { pagePath: '/pages/boss/dashboard/dashboard', text: '工作台', icon: '台' },
  { pagePath: '/pages/boss/profile/profile', text: '我的', icon: '我' },
];

Component({
  data: {
    selected: 0,
    role: 'worker',
    workerList: WORKER_TABS,
    fieldList: FIELD_TABS,
    bossList: BOSS_TABS,
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
      const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo') || {};
      const role = userInfo.role || userInfo.roleKey || 'worker';
      if (role !== this.data.role) {
        this.setData({ role });
      }
    },

    switchTab(e) {
      const { path } = e.currentTarget.dataset;
      if (!path) return;

      if (path === '/pages/index/index' || path === '/pages/qrcode/qrcode' || path === '/pages/profile/profile') {
        wx.switchTab({ url: path });
        return;
      }

      wx.navigateTo({ url: path });
    },
  },
});
