/**
 * Layer: Mini Program Component
 * Responsibility: Renders the custom tab bar and handles role-aware tab navigation.
 */
const app = getApp();

const WORKER_TABS = [
  { pagePath: '/pages/index/index', text: '广场', icon: '广' },
  { pagePath: '/pages/salary/salary', text: '收入', icon: '薪' },
  { pagePath: '/pages/qrcode/qrcode', text: '二维码', icon: '码', center: true },
  { pagePath: '/pages/applications/applications', text: 'AI', icon: 'AI' },
  { pagePath: '/pages/profile/profile', text: '我的', icon: '我' },
];

const FIELD_TABS = [
  { pagePath: '/pages/field/home/home', text: '工作台', icon: '工' },
];

const BOSS_TABS = [
  { pagePath: '/pages/base/list/list', text: '我的基地', icon: '基' },
  { pagePath: '/pages/job/list/list', text: '招聘情况', icon: '招' },
  { pagePath: '/pages/boss/dashboard/dashboard', text: '企业入驻审核', icon: '审' },
  { pagePath: '/pages/boss/profile/profile', text: '我的信息', icon: '我' },
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
