const app = getApp();
const { requireAuth } = require('../../../utils/auth-guard');
const { ensureRealNameReady } = require('../../../utils/realname');

const AUTO_HIDE_DELAY_MS = 3000;
const ANIM_RESTART_DELAY_MS = 18;

function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '');
}

function formatBankCard(cardNumber) {
  const digits = digitsOnly(cardNumber);
  if (!digits) return '';
  return digits.replace(/(.{4})(?=.)/g, '$1 ');
}

function maskBankCard(cardNumber) {
  const digits = digitsOnly(cardNumber);
  if (!digits) return '**** **** **** ****';
  return `**** **** **** ${digits.slice(-4)}`;
}

function readBankOcrResult(result = {}) {
  const data = result.data || result.result || result;
  const bankName = String(data.bankName || data.bank || data.issuer || '').trim();
  const bankCardNo = digitsOnly(data.bankCardNo || data.cardNo || data.cardNumber || data.number);
  return { bankName, bankCardNo };
}

function resolveBankTheme(bankName) {
  const name = String(bankName || '');
  if (name.includes('农业')) return 'abc';
  if (name.includes('建行') || name.includes('建设')) return 'ccb';
  return 'default';
}

function createCardView(profile) {
  const cardNumber = digitsOnly(profile?.bankCardNo);
  if (!cardNumber) return null;

  const bankName = String(profile?.bankName || '').trim() || '未命名银行卡';
  const theme = resolveBankTheme(bankName);

  return {
    id: 'primary',
    bankName,
    cardNumber,
    name: profile?.name || '用户',
    updateTime: profile?.updatedAt ? String(profile.updatedAt).slice(0, 10) : '-',
    theme,
    last4: cardNumber.slice(-4),
    formattedNumber: formatBankCard(cardNumber),
    maskedNumber: maskBankCard(cardNumber),
  };
}

function normalizePaidRecord(item) {
  const amount = Number(item?.totalAmount || 0);
  const paidAt = item?.paidAt || item?.workDate || '';
  const jobTitle = item?.jobTitle || '岗位';
  const baseName = item?.baseName || '基地';
  const date = String(paidAt).slice(0, 10) || '-';

  return {
    cardId: 'primary',
    amount: Number.isFinite(amount) ? amount.toFixed(2) : '0.00',
    date,
    job: `${baseName} · ${jobTitle}`,
    paidAt,
  };
}

function pickLatestSalary(salaryList, cardId) {
  const list = (salaryList || [])
    .filter((item) => item.cardId === cardId)
    .sort((a, b) => {
      const at = new Date(a.paidAt || a.date || 0).getTime();
      const bt = new Date(b.paidAt || b.date || 0).getTime();
      return bt - at;
    });
  return list.length ? list[0] : null;
}

function syncUserInfoCache(profile = {}) {
  const cached = wx.getStorageSync('userInfo') || {};
  const merged = Object.assign({}, cached, profile);
  wx.setStorageSync('userInfo', merged);
  app.globalData.userInfo = merged;
}

Page({
  data: {
    pageReady: false,
    loading: false,
    saving: false,
    cards: [],
    salaryList: [],
    currentIndex: 0,
    showFull: false,
    currentCard: null,
    recentSalary: null,
    amountAnimate: false,
    currentTheme: 'default',
    form: {
      bankName: '',
      bankCardNo: '',
    },
  },

  async onLoad() {
    if (!requireAuth()) return;
    if (!(await this.ensureCardAccess())) return;
    this.loadCardData();
    setTimeout(() => {
      this.setData({ pageReady: true });
    }, 20);
  },

  onPullDownRefresh() {
    this.loadCardData().finally(() => wx.stopPullDownRefresh());
  },

  onUnload() {
    this.clearTimers();
  },

  clearTimers() {
    if (this.maskTimer) {
      clearTimeout(this.maskTimer);
      this.maskTimer = null;
    }
    if (this.amountTimer) {
      clearTimeout(this.amountTimer);
      this.amountTimer = null;
    }
  },

  async loadCardData() {
    this.setData({ loading: true });

    try {
      const [profile, paidListRes] = await Promise.all([
        app.request({
          url: '/user/profile',
          method: 'GET',
        }),
        app.request({
          url: '/salary/worker/paid?limit=20',
          method: 'GET',
        }).catch(() => []),
      ]);

      syncUserInfoCache(profile);

      const card = createCardView(profile);
      const cards = card ? [card] : [];
      const salaryList = (Array.isArray(paidListRes) ? paidListRes : []).map(normalizePaidRecord);

      this.setData(
        {
          cards,
          salaryList,
          currentIndex: 0,
          showFull: false,
          form: {
            bankName: profile?.bankName || '',
            bankCardNo: card ? card.cardNumber : '',
          },
        },
        () => {
          this.syncCurrentData(false);
        },
      );
    } catch (err) {
      wx.showToast({
        title: err?.message || '加载银行卡失败',
        icon: 'none',
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  ensureCardAccess() {
    return ensureRealNameReady({
      title: '完成实名后管理银行卡',
      content: '工资卡会用于工资发放，请先完善实名信息。',
    });
  },

  syncCurrentData(animate) {
    const { cards, currentIndex, salaryList } = this.data;
    const currentCard = cards[currentIndex] || null;
    const recentSalary = currentCard ? pickLatestSalary(salaryList, currentCard.id) : null;

    this.setData({
      currentCard,
      recentSalary,
      currentTheme: currentCard ? currentCard.theme : resolveBankTheme(this.data.form.bankName),
    });

    if (animate && recentSalary) {
      this.triggerAmountAnimation();
      return;
    }

    this.setData({
      amountAnimate: Boolean(recentSalary),
    });
  },

  triggerAmountAnimation() {
    if (this.amountTimer) {
      clearTimeout(this.amountTimer);
      this.amountTimer = null;
    }

    this.setData({ amountAnimate: false });
    this.amountTimer = setTimeout(() => {
      this.setData({ amountAnimate: true });
    }, ANIM_RESTART_DELAY_MS);
  },

  onSwiperChange(e) {
    const nextIndex = e.detail.current;
    this.clearTimers();

    this.setData(
      {
        currentIndex: nextIndex,
        showFull: false,
      },
      () => {
        this.syncCurrentData(true);
      },
    );
  },

  onInputBankName(e) {
    const bankName = String(e.detail.value || '');
    this.setData({
      'form.bankName': bankName,
      currentTheme: resolveBankTheme(bankName),
    });
  },

  onInputBankCardNo(e) {
    const bankCardNo = digitsOnly(e.detail.value).slice(0, 30);
    this.setData({ 'form.bankCardNo': bankCardNo });
  },

  async scanBankCard() {
    if (this.data.loading || this.data.saving) return;

    let media;
    try {
      media = await new Promise((resolve, reject) => {
        wx.chooseMedia({
          count: 1,
          mediaType: ['image'],
          sourceType: ['camera', 'album'],
          success: resolve,
          fail: reject,
        });
      });
    } catch (_) {
      return;
    }

    const filePath = media?.tempFiles?.[0]?.tempFilePath;
    if (!filePath) return;

    wx.showLoading({ title: '识别中...' });
    try {
      const uploadRes = await app.upload({
        url: '/upload',
        filePath,
        name: 'file',
      });
      const ocrRes = await app.request({
        url: '/user/profile/bank-card/ocr',
        method: 'POST',
        data: { imageUrl: uploadRes.url || uploadRes.fileId },
      });
      const { bankName, bankCardNo } = readBankOcrResult(ocrRes);
      if (!bankName && !bankCardNo) {
        throw new Error('未识别到银行卡信息');
      }

      const update = {};
      if (bankName) update['form.bankName'] = bankName;
      if (bankCardNo) update['form.bankCardNo'] = bankCardNo.slice(0, 30);
      if (bankName) update.currentTheme = resolveBankTheme(bankName);
      this.setData(update);
      wx.hideLoading();
      wx.showToast({ title: '识别成功', icon: 'success' });
    } catch (err) {
      wx.hideLoading();
      wx.showToast({
        title: err?.message === '未识别到银行卡信息' ? '未识别到卡号' : '暂未接入识别，请手动输入',
        icon: 'none',
      });
    }
  },

  toggleCard() {
    const { cards, showFull } = this.data;
    if (!cards.length) {
      wx.showToast({
        title: '暂无银行卡',
        icon: 'none',
      });
      return;
    }

    const nextShowFull = !showFull;
    this.setData({ showFull: nextShowFull });

    if (!nextShowFull) {
      if (this.maskTimer) {
        clearTimeout(this.maskTimer);
        this.maskTimer = null;
      }
      return;
    }

    this.maskTimer = setTimeout(() => {
      this.setData({ showFull: false });
    }, AUTO_HIDE_DELAY_MS);
  },

  copyCard() {
    const { currentCard } = this.data;
    if (!currentCard) {
      wx.showToast({
        title: '暂无可复制卡号',
        icon: 'none',
      });
      return;
    }

    wx.setClipboardData({
      data: currentCard.cardNumber,
      success: () => {
        wx.showToast({
          title: '已复制',
          icon: 'success',
        });
      },
    });
  },

  async saveCard() {
    if (!(await this.ensureCardAccess())) return;

    const bankName = String(this.data.form.bankName || '').trim();
    const bankCardNo = digitsOnly(this.data.form.bankCardNo);

    if (!bankName) {
      wx.showToast({ title: '请输入开户银行', icon: 'none' });
      return;
    }

    if (bankCardNo.length < 12) {
      wx.showToast({ title: '请输入正确的银行卡号', icon: 'none' });
      return;
    }

    this.setData({ saving: true });

    try {
      let bankCardChallengeToken = '';
      const challengeResult = await app.request({
        url: '/user/profile/bank-card/challenge',
        method: 'POST',
        data: { bankCardNo },
      });

      if (challengeResult?.required) {
        const maskedCard = challengeResult?.maskedBankCardNo || maskBankCard(bankCardNo);
        const confirmRes = await new Promise((resolve) => {
          wx.showModal({
            title: '银行卡变更确认',
            content: `检测到你正在修改工资卡（${maskedCard}），确认后将进入人工复核。`,
            confirmText: '确认修改',
            cancelText: '取消',
            success: (res) => resolve(res),
            fail: () => resolve({ confirm: false }),
          });
        });

        if (!confirmRes.confirm) {
          this.setData({ saving: false });
          return;
        }

        bankCardChallengeToken = String(challengeResult?.challengeToken || '');
        if (!bankCardChallengeToken) {
          throw new Error('二次确认令牌获取失败，请稍后重试');
        }
      }

      const profile = await app.request({
        url: '/user/profile',
        method: 'PATCH',
        data: {
          bankName,
          bankCardNo,
          bankCardChallengeToken: bankCardChallengeToken || undefined,
        },
      });

      syncUserInfoCache(profile || {});

      wx.showToast({
        title: '银行卡已更新',
        icon: 'success',
      });

      await this.loadCardData();
    } catch (err) {
      wx.showToast({
        title: err?.message || '更新失败，请稍后重试',
        icon: 'none',
      });
    } finally {
      this.setData({ saving: false });
    }
  },
});
