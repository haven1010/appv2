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

function buildAppealMeta(appealStatus, salaryStatus) {
  if (appealStatus === 1 || appealStatus === '1' || appealStatus === 'pending') {
    return {
      appealStatusText: '申诉处理中',
      appealStatusClass: 'appeal-pending',
      canAppeal: false,
      canConfirm: false,
    };
  }
  if (appealStatus === 2 || appealStatus === '2' || appealStatus === 'resolved') {
    return {
      appealStatusText: '已调整，请重新确认',
      appealStatusClass: 'appeal-resolved',
      canAppeal: salaryStatus === 0 || salaryStatus === '0' || salaryStatus === 'pending',
      canConfirm: salaryStatus === 0 || salaryStatus === '0' || salaryStatus === 'pending',
    };
  }
  if (appealStatus === 3 || appealStatus === '3' || appealStatus === 'rejected') {
    return {
      appealStatusText: '申诉已驳回',
      appealStatusClass: 'appeal-rejected',
      canAppeal: salaryStatus === 0 || salaryStatus === '0' || salaryStatus === 'pending',
      canConfirm: salaryStatus === 0 || salaryStatus === '0' || salaryStatus === 'pending',
    };
  }
  return {
    appealStatusText: '',
    appealStatusClass: '',
    canAppeal: salaryStatus === 0 || salaryStatus === '0' || salaryStatus === 'pending',
    canConfirm: salaryStatus === 0 || salaryStatus === '0' || salaryStatus === 'pending',
  };
}

function formatDateTimeText(value) {
  if (!value) return '';
  const raw = String(value).trim();
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    return raw.replace('T', ' ').slice(0, 16);
  }
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d} ${hh}:${mm}`;
}

function normalizeSalaryItem(item) {
  const statusMeta = buildStatusMeta(item && item.status);
  const appealMeta = buildAppealMeta(item && item.workerAppealStatus, item && item.status);
  return Object.assign({}, item, {
    amountText: formatAmount((item && item.totalAmount) != null ? item.totalAmount : item && item.amount),
    workDurationText: formatAmount(item && item.workDuration),
    statusText: statusMeta.statusText,
    statusClass: statusMeta.statusClass,
    canConfirm: Boolean(statusMeta.canConfirm && appealMeta.canConfirm),
    canAppeal: Boolean(appealMeta.canAppeal),
    appealStatusText: appealMeta.appealStatusText,
    appealStatusClass: appealMeta.appealStatusClass,
    appealedAtText: formatDateTimeText(item && item.workerAppealedAt),
    handledAtText: formatDateTimeText(item && item.appealHandledAt),
    expectedAmountText: item && item.workerExpectedAmount != null ? formatAmount(item.workerExpectedAmount) : '',
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
    appealDraftId: null,
    appealReasonInput: '',
    appealExpectedAmountInput: '',
    appealSubmitting: false,
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
        const currentAppealDraftId = this.data.appealDraftId;
        const keepDraft = currentAppealDraftId && normalizedList.some((item) => Number(item.id) === Number(currentAppealDraftId));

        this.setData({
          stats: {
            totalDays: safeStats.totalDays || 0,
            totalEarned: formatAmount(safeStats.totalEarned),
            pendingAmount: formatAmount(safeStats.pendingAmount),
          },
          pendingList: normalizedList,
          lastUpdated: buildNowText(),
          loading: false,
          appealDraftId: keepDraft ? currentAppealDraftId : null,
          appealReasonInput: keepDraft ? this.data.appealReasonInput : '',
          appealExpectedAmountInput: keepDraft ? this.data.appealExpectedAmountInput : '',
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

  startAppeal(e) {
    const salaryId = Number(e.currentTarget.dataset.id || 0);
    const currentAmount = e.currentTarget.dataset.amount;
    if (!salaryId) return;

    this.setData({
      appealDraftId: salaryId,
      appealReasonInput: '',
      appealExpectedAmountInput: currentAmount != null ? formatAmount(currentAmount) : '',
    });
  },

  cancelAppeal() {
    this.setData({
      appealDraftId: null,
      appealReasonInput: '',
      appealExpectedAmountInput: '',
    });
  },

  onAppealReasonInput(e) {
    this.setData({ appealReasonInput: e.detail.value || '' });
  },

  onAppealExpectedAmountInput(e) {
    this.setData({ appealExpectedAmountInput: e.detail.value || '' });
  },

  async submitAppeal(e) {
    const salaryId = Number(e.currentTarget.dataset.id || this.data.appealDraftId || 0);
    if (!salaryId) return;

    const reason = String(this.data.appealReasonInput || '').trim();
    const expectedAmountText = String(this.data.appealExpectedAmountInput || '').trim();
    if (!reason) {
      wx.showToast({ title: '请填写申诉原因', icon: 'none' });
      return;
    }

    const payload = { reason };
    if (expectedAmountText) {
      payload.expectedAmount = expectedAmountText;
    }

    this.setData({ appealSubmitting: true });
    wx.showLoading({ title: '提交申诉中...' });
    try {
      await app.request({
        url: `/salary/worker/${salaryId}/appeal`,
        method: 'POST',
        data: payload,
      });
      wx.hideLoading();
      wx.showToast({ title: '申诉已提交', icon: 'success' });
      this.setData({
        appealDraftId: null,
        appealReasonInput: '',
        appealExpectedAmountInput: '',
        appealSubmitting: false,
      });
      this.loadSalaryData();
    } catch (err) {
      wx.hideLoading();
      this.setData({ appealSubmitting: false });
      console.error('提交工资申诉失败:', err);
      wx.showToast({ title: err.message || '提交失败', icon: 'none' });
    }
  },

  goFindJobs() {
    wx.switchTab({ url: '/pages/index/index' });
  },
});
