// pages/register/register.js
const app = getApp();

Page({
  data: {
    name: '',
    idCard: '',
    phone: '',
    emergencyContact: '',
    emergencyPhone: '',
    loading: false,
    error: '',
    // 焦点状态
    nameFocus: false,
    idCardFocus: false,
    phoneFocus: false,
  },

  onInputName(e) {
    this.setData({ name: e.detail.value, error: '' });
  },
  onInputIdCard(e) {
    this.setData({ idCard: e.detail.value, error: '' });
  },
  onInputPhone(e) {
    this.setData({ phone: e.detail.value, error: '' });
  },
  onInputEmergencyContact(e) {
    this.setData({ emergencyContact: e.detail.value });
  },
  onInputEmergencyPhone(e) {
    this.setData({ emergencyPhone: e.detail.value });
  },

  // 焦点事件
  onNameFocus() { this.setData({ nameFocus: true }); },
  onNameBlur() { this.setData({ nameFocus: false }); },
  onIdCardFocus() { this.setData({ idCardFocus: true }); },
  onIdCardBlur() { this.setData({ idCardFocus: false }); },
  onPhoneFocus() { this.setData({ phoneFocus: true }); },
  onPhoneBlur() { this.setData({ phoneFocus: false }); },

  async handleRegister() {
    const { name, idCard, phone, emergencyContact, emergencyPhone } = this.data;

    if (!name.trim()) {
      this.setData({ error: '请输入真实姓名' });
      return;
    }

    if (!idCard || idCard.length !== 18) {
      this.setData({ error: '请输入完整的18位身份证号码' });
      return;
    }

    if (!phone || phone.length !== 11) {
      this.setData({ error: '请输入正确的11位手机号码' });
      return;
    }

    this.setData({ loading: true, error: '' });

    try {
      const res = await app.request({
        url: '/user/register',
        method: 'POST',
        data: {
          name: name.trim(),
          idCard,
          phone,
          roleKey: 'worker',
          emergencyContact: emergencyContact || undefined,
          emergencyPhone: emergencyPhone || undefined,
        },
      });

      wx.showToast({
        title: '注册成功',
        icon: 'success',
        duration: 1500,
      });

      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    } catch (err) {
      this.setData({
        error: err.message || '注册失败，请检查信息是否正确',
        loading: false,
      });
    }
  },

  goToLogin() {
    wx.navigateBack();
  },
});
