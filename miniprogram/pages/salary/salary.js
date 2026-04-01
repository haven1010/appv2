/**
 * Layer: Mini Program Page
 * Responsibility: Implements the Salary page lifecycle, local interaction state, and backend integration for the WeChat client.
 */
const app = getApp();

function formatAmount(value) {
  const num = Number(value);
  if (Number.isFinite(num)) return num.toFixed(2);
  if (value == null || value === '') return '0.00';
  return String(value);
}

function buildStatusMeta(status) {
  if (status === 'paid' || status === 2 || status === '2') {
    return { statusText: '已发放', statusClass: 'paid', canConfirm: false };
  }
  if (status === 'confirmed' || status === 1 || status === '1') {
    return { statusText: '已确认', statusClass: 'confirmed', canConfirm: false };
  }
  if (status === 'draft' || status === 0 || status === '0' || status === 'pending') {
    return { statusText: '待确认', statusClass: 'pending', canConfirm: true };
  }
  return { statusText: '待确认', statusClass: 'pending', canConfirm: false };
}

function normalizeSalaryItem(item) {
  const statusMeta = buildStatusMeta(item && item.status);
  return Object.assign({}, item, {
    amountText: formatAmount((item && item.totalAmount) != null ? item.totalAmount : item && item.amount),
    statusText: statusMeta.statusText,
    statusClass: statusMeta.statusClass,
    canConfirm: statusMeta.canConfirm,
  });
}

function buildNowText() {
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const safeMinute = minute < 10 ? `0${minute}` : `${minute}`;
  return `${hour}:${safeMinute}`;
}

Page({
  data: {
    stats: null,
    pendingList: [],
    lastUpdated: '',
    loading: true,
  },

  onLoad() {
    this.loadSalaryData();
  },

  onShow() {
    const tabBar = this.getTabBar && this.getTabBar();
    if (tabBar) {
      tabBar.setData({ selected: 1 });
    }
    this.loadSalaryData();
  },

  onPullDownRefresh() {
    this.loadSalaryData();
    setTimeout(() => wx.stopPullDownRefresh(), 1000);
  },

  hasToken() {
    return Boolean(wx.getStorageSync('token'));
  },

  setEmptyState() {
    this.setData({
      stats: {
        totalDays: 0,
        totalEarned: '0.00',
        pendingAmount: '0.00',
      },
      pendingList: [],
      lastUpdated: buildNowText(),
      loading: false,
    });
  },

  async loadSalaryData() {
    if (this.loadingPromise) return this.loadingPromise;

    if (!this.hasToken()) {
      this.setEmptyState();
      return;
    }

    this.setData({ loading: true });

    this.loadingPromise = (async () => {
      try {
        const [stats, pendingList] = await Promise.all([
          app.request({ url: '/salary/worker/stats', method: 'GET' }).catch(() => null),
          app.request({ url: '/salary/worker/pending', method: 'GET' }).catch(() => []),
        ]);

        const safeStats = stats || { totalDays: 0, totalEarned: 0, pendingAmount: 0 };
        const normalizedList = Array.isArray(pendingList) ? pendingList.map(normalizeSalaryItem) : [];

        this.setData({
          stats: {
            totalDays: safeStats.totalDays || 0,
            totalEarned: formatAmount(safeStats.totalEarned),
            pendingAmount: formatAmount(safeStats.pendingAmount),
          },
          pendingList: normalizedList,
          lastUpdated: buildNowText(),
          loading: false,
        });
      } catch (err) {
        if (!(err && (err.statusCode === 401 || /Login expired/i.test(String(err.message || ''))))) {
          console.error('加载薪资数据失败:', err);
          wx.showToast({ title: '加载失败', icon: 'none' });
        }
        this.setData({ loading: false });
      } finally {
        this.loadingPromise = null;
      }
    })();

    return this.loadingPromise;
  },

  async refreshData() {
    wx.showLoading({ title: '刷新中...' });
    try {
      await this.loadSalaryData();
      wx.showToast({ title: '已更新', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  async confirmSalary(e) {
    const salaryId = e.currentTarget.dataset.id;
    if (!salaryId) return;

    wx.showModal({
      title: '确认工资',
      content: '确认后表示您认可该笔工资金额，是否继续？',
      success: async (res) => {
        if (!res.confirm) return;

        wx.showLoading({ title: '确认中...' });
        try {
          await app.request({
            url: '/salary/worker/' + salaryId + '/confirm',
            method: 'POST',
          });
          wx.hideLoading();
          wx.showToast({ title: '确认成功', icon: 'success' });
          this.loadSalaryData();
        } catch (err) {
          wx.hideLoading();
          console.error('确认工资失败:', err);
          wx.showToast({ title: err.message || '确认失败', icon: 'none' });
        }
      },
    });
  },

  goFindJobs() {
    wx.switchTab({ url: '/pages/index/index' });
  },
});
