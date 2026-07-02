const app = getApp();

const WORKER_TABS = [
  { pagePath: "/pages/index/index", text: "首页", icon: "/images/icons-tab/home.svg", iconActive: "/images/icons-tab/home-active.svg" },
  { pagePath: "/pages/qrcode/qrcode", text: "签到码", icon: "/images/icons-tab/checkin.svg", iconActive: "/images/icons-tab/checkin-active.svg", isCenter: true },
  { pagePath: "/pages/profile/profile", text: "我的", icon: "/images/icons-tab/profile.svg", iconActive: "/images/icons-tab/profile-active.svg" },
];

const FIELD_TABS = [
  { pagePath: "/pages/field/home/home", text: "工作台", icon: "/images/icons-tab/workbench.png", iconActive: "/images/icons-tab/workbench-active.png" },
  { pagePath: "/pages/field/scan/scan", text: "扫码", icon: "/images/icons-tab/scan.png", iconActive: "/images/icons-tab/scan-active.png" },
  { pagePath: "/pages/field/records/records", text: "记录", icon: "/images/icons-tab/workbench.png", iconActive: "/images/icons-tab/workbench-active.png" },
  { pagePath: "/pages/field/profile/profile", text: "我的", icon: "/images/icons-tab/profile.png", iconActive: "/images/icons-tab/profile-active.png" },
];

const BOSS_TABS = [
  { pagePath: "/pages/base/list/list", text: "基地", icon: "/images/icons-tab/base.png", iconActive: "/images/icons-tab/base-active.png" },
  { pagePath: "/pages/job/list/list", text: "岗位", icon: "/images/icons-tab/job.png", iconActive: "/images/icons-tab/job-active.png" },
  { pagePath: "/pages/boss/dashboard/dashboard", text: "工作台", icon: "/images/icons-tab/workbench.png", iconActive: "/images/icons-tab/workbench-active.png" },
  { pagePath: "/pages/boss/profile/profile", text: "我的", icon: "/images/icons-tab/profile.png", iconActive: "/images/icons-tab/profile-active.png" },
];

const LOCK_ICON = "/images/icons-tab/lock.png";

function safeGetStorageSync(key, fallback = '') {
  try {
    const value = wx.getStorageSync(key);
    return value === undefined ? fallback : value;
  } catch (_) {
    return fallback;
  }
}

Component({
  data: {
    selected: 0,
    role: 'worker',
    loggedIn: false,
    hiddenForSplash: false,
    workerList: WORKER_TABS,
    fieldList: FIELD_TABS,
    bossList: BOSS_TABS,
    lockIcon: LOCK_ICON,
  },

  attached() {
    this.refreshStateSoon();
  },

  detached() {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  },

  pageLifetimes: {
    show() {
      this.refreshStateSoon();
    },
  },

  methods: {
    refreshStateSoon() {
      if (this.refreshTimer) clearTimeout(this.refreshTimer);
      this.refreshTimer = setTimeout(() => {
        this.refreshTimer = null;
        this.checkAuth();
        this.updateRole();
      }, 60);
    },

    checkAuth() {
      const token = safeGetStorageSync('token', '');
      const userInfo = safeGetStorageSync('userInfo', null);
      this.setData({ loggedIn: Boolean(token && userInfo) });
    },

    updateRole() {
      const userInfo = app.globalData.userInfo || safeGetStorageSync('userInfo', {}) || {};
      const role = userInfo.role || userInfo.roleKey || 'worker';
      // Update selected index based on current page
      const pages = getCurrentPages();
      const currentPage = pages[pages.length - 1];
      const currentRoute = currentPage ? '/' + currentPage.route : '';

      let tabs = [];
      if (role === 'field_manager') {
        tabs = FIELD_TABS;
      } else if (role === 'boss') {
        tabs = BOSS_TABS;
      } else {
        tabs = WORKER_TABS;
      }

      const selectedIndex = tabs.findIndex(t => t.pagePath === currentRoute);

      this.setData({
        role,
        selected: selectedIndex >= 0 ? selectedIndex : 0
      });
    },

    switchTab(e) {
      const { path } = e.currentTarget.dataset;
      if (!path) return;

      // Use switchTab for tab bar pages, navigateTo for others
      const tabPaths = ['/pages/index/index', '/pages/qrcode/qrcode', '/pages/profile/profile'];
      if (tabPaths.includes(path)) {
        wx.switchTab({ url: path });
        return;
      }

      wx.navigateTo({ url: path });
    },

    goToLogin() {
      wx.reLaunch({ url: '/pages/login/login' });
    },
  },
});
