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
  },

  onInputName(e) {
    this.setData({ name: e.detail.value });
  },

  onInputIdCard(e) {
    this.setData({ idCard: e.detail.value });
  },

  onInputPhone(e) {
    this.setData({ phone: e.detail.value });
  },

  onInputEmergencyContact(e) {
    this.setData({ emergencyContact: e.detail.value });
  },

  onInputEmergencyPhone(e) {
    this.setData({ emergencyPhone: e.detail.value });
  },

  async handleRegister() {
    const { name, idCard, phone, emergencyContact, emergencyPhone } = this.data;
    
    if (!name || !idCard || !phone) {
      this.setData({ error: '请填写姓名、身份证号和手机号' });
      return;
    }

    if (idCard.length !== 18) {
      this.setData({ error: '身份证号必须是18位' });
      return;
    }

    if (phone.length !== 11) {
      this.setData({ error: '手机号必须是11位' });
      return;
    }

    this.setData({ loading: true, error: '' });

    try {
      const res = await app.request({
        url: '/user/register',
        method: 'POST',
        data: {
          name,
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
      });

      // 自动登录
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);

    } catch (err) {
      this.setData({ 
        error: err.message || '注册失败，请检查信息是否正确',
        loading: false 
      });
    }
  },
});
