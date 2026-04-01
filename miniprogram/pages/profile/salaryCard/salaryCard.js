const app = getApp();

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

  onLoad() {
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
      const profile = await app.request({
        url: '/user/profile',
        method: 'PATCH',
        data: {
          bankName,
          bankCardNo,
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