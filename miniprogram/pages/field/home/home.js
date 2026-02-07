// pages/field/home/home.js
const app = getApp();

Page({
  data: {
    userInfo: null,
    baseInfo: null,
    baseId: null,
    stats: { checkedIn: 0, pending: 0, absent: 0, rate: '0%' },
    recentRecords: [],
    loading: true,
    error: '',
  },

  onLoad() {
    this.checkLogin();
  },

  onShow() {
    const tabBar = this.getTabBar && this.getTabBar();
    if (tabBar) {
      tabBar.setData({ selected: 0 });
    }
    this.loadData();
  },

  onPullDownRefresh() {
    this.loadData();
    setTimeout(() => wx.stopPullDownRefresh(), 1500);
  },

  checkLogin() {
    const userInfo = wx.getStorageSync('userInfo');
    if (!userInfo) {
      wx.showModal({
        title: '提示',
        content: '请先登录',
        showCancel: false,
        success: () => {
          wx.reLaunch({ url: '/pages/login/login' });
        },
      });
      return;
    }
    this.setData({ userInfo });
  },

  async loadData() {
    const token = wx.getStorageSync('token');
    if (!token) {
      this.setData({ loading: false });
      return;
    }
    this.setData({ loading: true, error: '' });

    try {
      // 1. 获取用户 profile 获取 assignedBaseId
      let baseId = null;
      const userInfo = this.data.userInfo;
      if (userInfo && userInfo.assignedBaseId) {
        baseId = userInfo.assignedBaseId;
      } else {
        try {
          const profile = await app.request({ url: '/user/profile', method: 'GET' });
          if (profile && profile.assignedBaseId) {
            baseId = profile.assignedBaseId;
          }
        } catch (e) {
          console.warn('获取 profile 失败:', e);
        }
      }

      if (!baseId) {
        this.setData({
          loading: false,
          error: '未绑定基地，请联系管理员分配基地或在Web后台绑定',
        });
        return;
      }

      this.setData({ baseId });

      // 2. 并行加载基地信息和考勤数据
      var results = await Promise.all([
        app.request({ url: '/base/' + baseId, method: 'GET' }).catch(function() { return null; }),
        app.request({ url: '/attendance/stats?baseId=' + baseId, method: 'GET' }).catch(function() { return null; }),
        app.request({ url: '/attendance/records?baseId=' + baseId + '&limit=10', method: 'GET' }).catch(function() { return []; }),
      ]);
      var baseInfo = results[0];
      var attendanceStats = results[1];
      var records = results[2];

      // 处理考勤统计
      const statsData = attendanceStats || {};
      const checkedIn = statsData.checkedIn || statsData.todayCheckedIn || 0;
      const total = statsData.total || statsData.todayTotal || 0;
      const pending = total - checkedIn;
      const rate = total > 0 ? Math.round((checkedIn / total) * 100) + '%' : '0%';

      // 处理签到记录
      const recordList = Array.isArray(records) ? records : (records && records.list ? records.list : []);

      this.setData({
        baseInfo: baseInfo || null,
        stats: {
          checkedIn,
          pending: pending > 0 ? pending : 0,
          absent: statsData.absent || 0,
          rate,
        },
        recentRecords: recordList.slice(0, 5),
        loading: false,
      });

    } catch (err) {
      console.error('加载工作台数据失败:', err);
      this.setData({
        loading: false,
        error: '加载数据失败: ' + (err.message || '未知错误'),
      });
    }
  },

  goScan() {
    wx.switchTab({
      url: '/pages/field/scan/scan',
    });
  },

  goRecords() {
    wx.switchTab({
      url: '/pages/field/records/records',
    });
  },
});
