Page({
  data: {
    canUseContact: true,
    servicePhone: '400-800-1234',
    sessionFrom: '',
    messageTitle: '采摘工小程序在线客服',
    messagePath: '/pages/help/help',
    faqList: [
      { q: '如何报名采摘工岗位？', a: '在“广场”页面选择岗位，点击报名并填写信息即可。' },
      { q: '如何签到？', a: '在“签到码”页面出示二维码，现场管理员扫码即可签到。' },
      { q: '工资如何结算？', a: '工资结算周期和方式请咨询基地管理员，或在“我的工资”页面查看。' },
      { q: 'AI 客服能处理什么问题？', a: '可处理岗位报名、签到异常、工资进度、账号问题等常见咨询，复杂问题会自动转人工。' }
    ],
  },

  onLoad() {
    const canUseContact = wx.canIUse('button.open-type.contact');
    const userInfo = wx.getStorageSync('userInfo') || {};
    const source = this.getCurrentSource();
    const sessionPayload = {
      source,
      uid: userInfo.uid || '',
      role: userInfo.role || 'worker',
      ts: Date.now(),
    };

    this.setData({
      canUseContact,
      sessionFrom: JSON.stringify(sessionPayload),
      messagePath: source || '/pages/help/help',
    });
  },

  getCurrentSource() {
    const pages = getCurrentPages();
    if (!pages || !pages.length) return '/pages/help/help';
    const current = pages[pages.length - 1] || {};
    return current.route ? '/' + current.route : '/pages/help/help';
  },

  onContact() {
    wx.showToast({
      title: '已打开云客服会话',
      icon: 'none',
    });
  },

  onContactError() {
    wx.showModal({
      title: '云客服暂不可用',
      content: '请检查是否已在微信公众平台完成云客服接入，或改用电话客服。',
      showCancel: false,
    });
  },

  callServicePhone() {
    wx.makePhoneCall({
      phoneNumber: this.data.servicePhone,
      fail: () => {
        wx.showToast({
          title: '拨号失败，请稍后重试',
          icon: 'none',
        });
      },
    });
  }
});
