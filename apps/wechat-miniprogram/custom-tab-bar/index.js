/**
 * Layer: Mini Program Component
 * Responsibility: Render role-aware custom tab bar and navigation.
 */
const app = getApp();

const WORKER_TABS = [
  { pagePath: '/pages/index/index', text: '首页', icon: '首' },
  { pagePath: '/pages/qrcode/qrcode', text: '签到码', icon: '码', center: true },
  { pagePath: '/pages/applications/applications', text: '服务', icon: '服' },
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
      wx.switchTab({ url: path });
    },
  },
});
