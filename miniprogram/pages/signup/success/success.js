const app = getApp();

function decodeText(value) {
  try {
    return decodeURIComponent(String(value || ''));
  } catch (_) {
    return String(value || '');
  }
}

function formatDateText(raw) {
  if (!raw) return '';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return String(raw).slice(0, 10);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

Page({
  data: {
    duplicate: false,
    cancelled: false,
    cancelling: false,
    canCancel: false,
    signupId: 0,
    baseId: 0,
    baseName: '基地',
    jobTitle: '岗位',
    workDate: '',
    workerName: '',
    workerUid: '',
  },

  onLoad(options = {}) {
    const userInfo = wx.getStorageSync('userInfo') || {};
    const workDate = formatDateText(decodeText(options.workDate));
    const baseId = Number(options.baseId) || 0;
    const signupId = Number(options.signupId) || 0;

    this.setData({
      duplicate: options.duplicate === '1',
      signupId,
      baseId,
      baseName: decodeText(options.baseName) || '基地',
      jobTitle: decodeText(options.jobTitle) || '岗位',
      workDate,
      workerName: userInfo.name || '采摘工',
      workerUid: userInfo.uid || '--',
      canCancel: Boolean(baseId && workDate),
    });
  },

  onCancelSignup() {
    if (!this.data.canCancel || this.data.cancelling || this.data.cancelled) return;

    wx.showModal({
      title: '取消报名',
      content: '取消后将删除本次报名记录，是否继续？',
      confirmText: '确认取消',
      cancelText: '暂不取消',
      success: (res) => {
        if (!res.confirm) return;
        this.executeCancelSignup();
      },
    });
  },

  async executeCancelSignup() {
    this.setData({ cancelling: true });
    wx.showLoading({
      title: '取消中',
      mask: true,
    });

    try {
      const payload = this.data.signupId
        ? { signupId: this.data.signupId }
        : { baseId: this.data.baseId, workDate: this.data.workDate };

      await app.request({
        url: '/attendance/signup/cancel',
        method: 'POST',
        data: payload,
      });

      this.setData({
        cancelled: true,
        canCancel: false,
      });

      wx.showToast({
        title: '报名已取消',
        icon: 'success',
      });
    } catch (error) {
      wx.showToast({
        title: error?.message || '取消失败，请稍后重试',
        icon: 'none',
      });
    } finally {
      wx.hideLoading();
      this.setData({ cancelling: false });
    }
  },

  goWorkHistory() {
    wx.navigateTo({
      url: '/pages/profile/workHistory/workHistory',
    });
  },

  backToSquare() {
    wx.switchTab({
      url: '/pages/index/index',
    });
  },
});
