// pages/profile/userInfo/userInfo.js
const app = getApp();

function maskPhone(phone) {
  if (!phone || phone.length < 7) return phone || '';
  return phone.slice(0, 3) + '****' + phone.slice(-4);
}

Page({
  data: {
    profile: null,
    form: {
      name: '',
      phone: '',
      emergencyContact: '',
      emergencyPhone: '',
    },
    saving: false,
    auditStatusText: '-',
  },

  onLoad() {
    this.loadData();
  },

  async loadData() {
    try {
      const res = await app.request({ url: '/user/profile', method: 'GET' });
      if (res) {
        const auditStatusText = res.infoAuditStatus === 1 ? '已认证' : res.infoAuditStatus === 0 ? '待审核' : '未认证';
        const idCardMasked = res.idCard ? res.idCard.replace(/^(.{6})(?:\d+)(.{4})$/, '$1********$2') : '';
        this.setData({
          profile: {
            ...res,
            phoneMasked: maskPhone(res.phone),
            emergencyPhoneMasked: maskPhone(res.emergencyPhone),
            idCardMasked,
          },
          form: {
            name: res.name || '',
            phone: res.phone || '',
            emergencyContact: res.emergencyContact || '',
            emergencyPhone: res.emergencyPhone || '',
          },
          auditStatusText,
        });
      }
    } catch (err) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  onInputName(e) {
    this.setData({ 'form.name': e.detail.value });
  },

  onInputPhone(e) {
    this.setData({ 'form.phone': e.detail.value });
  },

  onInputEmergencyContact(e) {
    this.setData({ 'form.emergencyContact': e.detail.value });
  },

  onInputEmergencyPhone(e) {
    this.setData({ 'form.emergencyPhone': e.detail.value });
  },

  async handleSave() {
    const { name, phone, emergencyContact, emergencyPhone } = this.data.form;
    if (!name || !name.trim()) {
      wx.showToast({ title: '请输入姓名', icon: 'none' });
      return;
    }
    if (phone && phone.length !== 11) {
      wx.showToast({ title: '手机号格式不正确', icon: 'none' });
      return;
    }
    if (emergencyPhone && emergencyPhone.length !== 11) {
      wx.showToast({ title: '紧急联系人电话格式不正确', icon: 'none' });
      return;
    }

    this.setData({ saving: true });
    try {
      await app.request({
        url: '/user/profile',
        method: 'PATCH',
        data: { name: name.trim(), phone: phone || undefined, emergencyContact: emergencyContact || undefined, emergencyPhone: emergencyPhone || undefined },
      });
      wx.showToast({ title: '保存成功', icon: 'success' });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    } catch (err) {
      wx.showToast({ title: err.message || '保存失败', icon: 'none' });
    } finally {
      this.setData({ saving: false });
    }
  },
});
