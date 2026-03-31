/**
 * Layer: Mini Program Page
 * Responsibility: Implements the Salary Card page lifecycle, local interaction state, and backend integration for the WeChat client.
 * Notes: Keep comments focused on intent, invariants, side effects, and cross-module contracts.
 */
// pages/profile/salaryCard/salaryCard.js
const app = getApp();

const AUTO_MASK_DELAY_MS = 12000;

function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '');
}

function formatBankCard(cardNo) {
  const digits = digitsOnly(cardNo);
  if (!digits) return '';
  return digits.replace(/(.{4})(?=.)/g, '$1 ');
}

function maskBankCard(cardNo) {
  const digits = digitsOnly(cardNo);
  if (!digits) return '**** **** **** ****';
  if (digits.length <= 8) {
    return formatBankCard(digits.replace(/.(?=.{2})/g, '*'));
  }
  const head = digits.slice(0, 4);
  const tail = digits.slice(-4);
  const middle = '*'.repeat(digits.length - 8);
  return formatBankCard(head + middle + tail);
}

function formatDate(dateValue) {
  if (!dateValue) return '-';
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return '-';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return year + '-' + month + '-' + day;
}

function pickFirst(obj, keys) {
  for (let i = 0; i < keys.length; i += 1) {
    const value = obj[keys[i]];
    if (value) return value;
  }
  return '';
}

Page({
  data: {
    pageReady: false,
    topShadeOpacity: 0,
    scrollTop: 0,
    loading: true,
    cardInfo: {
      bankName: '',
      cardNo: '',
      holderName: '',
      updateTimeText: '-',
    },
    hasCard: false,
    visible: false,
    displayCardNo: '**** **** **** ****',
    copySuccess: false,
    cardLifted: false,
  },

  onLoad() {
    this.loadCardInfo();
    setTimeout(() => {
      this.setData({ pageReady: true });
    }, 30);
  },

  onShow() {
    this.startAutoMaskTimer();
  },

  onHide() {
    this.clearAutoMaskTimer();
  },

  onUnload() {
    this.clearAutoMaskTimer();
    if (this.copyFeedbackTimer) {
      clearTimeout(this.copyFeedbackTimer);
      this.copyFeedbackTimer = null;
    }
    if (this.cardLiftTimer) {
      clearTimeout(this.cardLiftTimer);
      this.cardLiftTimer = null;
    }
  },

  onPullDownRefresh() {
    this.loadCardInfo().finally(() => wx.stopPullDownRefresh());
  },

  onScroll(e) {
    const scrollTop = (e.detail && e.detail.scrollTop) || 0;
    if (Math.abs(scrollTop - this.data.scrollTop) < 8) return;
    this.setData({
      scrollTop,
      topShadeOpacity: Math.min(1, scrollTop / 150),
    });
    this.startAutoMaskTimer();
  },

  noop() {},

  handleBlankTap() {
    if (!this.data.visible) return;
    this.hideCardNumber(false);
  },

  onTapCard() {
    this.setData({ cardLifted: true });
    if (this.cardLiftTimer) clearTimeout(this.cardLiftTimer);
    this.cardLiftTimer = setTimeout(() => {
      this.setData({ cardLifted: false });
    }, 260);
    this.startAutoMaskTimer();
  },

  getDisplayCardNo(cardNo, visible) {
    return visible ? formatBankCard(cardNo) : maskBankCard(cardNo);
  },

  hideCardNumber(isAuto) {
    const cardNo = this.data.cardInfo.cardNo;
    this.setData({
      visible: false,
      displayCardNo: this.getDisplayCardNo(cardNo, false),
    });
    this.clearAutoMaskTimer();
    if (isAuto) {
      wx.showToast({ title: '已自动隐藏卡号', icon: 'none' });
    }
  },

  toggleVisible() {
    if (!this.data.hasCard) {
      wx.showToast({ title: '暂未绑定银行卡', icon: 'none' });
      return;
    }

    const nextVisible = !this.data.visible;
    const cardNo = this.data.cardInfo.cardNo;
    this.setData({
      visible: nextVisible,
      displayCardNo: this.getDisplayCardNo(cardNo, nextVisible),
    });
    this.startAutoMaskTimer();
  },

  copyCardNo() {
    if (!this.data.hasCard) {
      wx.showToast({ title: '暂无可复制卡号', icon: 'none' });
      return;
    }

    wx.setClipboardData({
      data: this.data.cardInfo.cardNo,
      success: () => {
        this.setData({ copySuccess: true });
        wx.showToast({ title: '卡号已复制', icon: 'none' });
        if (this.copyFeedbackTimer) clearTimeout(this.copyFeedbackTimer);
        this.copyFeedbackTimer = setTimeout(() => {
          this.setData({ copySuccess: false });
        }, 1000);
        this.startAutoMaskTimer();
      },
    });
  },

  startAutoMaskTimer() {
    this.clearAutoMaskTimer();
    if (!this.data.visible) return;
    this.autoMaskTimer = setTimeout(() => {
      if (!this.data.visible) return;
      this.hideCardNumber(true);
    }, AUTO_MASK_DELAY_MS);
  },

  clearAutoMaskTimer() {
    if (!this.autoMaskTimer) return;
    clearTimeout(this.autoMaskTimer);
    this.autoMaskTimer = null;
  },

  async loadCardInfo() {
    this.setData({ loading: true });
    try {
      const profile = await app.request({ url: '/user/profile', method: 'GET' });
      const cardNo = pickFirst(profile || {}, [
        'bankCardNo',
        'bankCard',
        'cardNo',
        'salaryCardNo',
        'accountNo',
      ]);
      const bankName = pickFirst(profile || {}, [
        'bankName',
        'bank',
        'bankBranchName',
        'depositBank',
        'salaryBankName',
      ]);

      const cardInfo = {
        bankName: bankName || '未设置开户行',
        cardNo: digitsOnly(cardNo),
        holderName: (profile && profile.name) || '',
        updateTimeText: formatDate(profile && profile.updatedAt),
      };
      const hasCard = Boolean(cardInfo.cardNo);

      this.setData({
        loading: false,
        cardInfo,
        hasCard,
        visible: false,
        copySuccess: false,
        displayCardNo: this.getDisplayCardNo(cardInfo.cardNo, false),
      });
    } catch (err) {
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败，请稍后重试', icon: 'none' });
    }
  },
});
