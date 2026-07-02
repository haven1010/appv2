/**
 * Layer: Mini Program Page
 * Responsibility: Profile completion after WeChat one-click login.
 * Collects name, phone, ID card with optional OCR auto-fill.
 */
const app = getApp();
const { requireAuth } = require('../../utils/auth-guard');

function cleanPhone(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 11);
}

function cleanIdCard(value) {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, '');
}

Page({
  data: {
    name: '',
    phone: '',
    idCard: '',
    error: '',
    submitting: false,
    canSubmit: false,
  },

  onLoad() {
    if (!requireAuth()) return;
  },

  onInputName(e) {
    const name = e.detail.value;
    this.setData({ name, error: '' });
    this.updateCanSubmit(name, this.data.phone, this.data.idCard);
  },

  onInputPhone(e) {
    const phone = cleanPhone(e.detail.value);
    this.setData({ phone, error: '' });
    this.updateCanSubmit(this.data.name, phone, this.data.idCard);
  },

  onInputIdCard(e) {
    const idCard = cleanIdCard(e.detail.value);
    this.setData({ idCard, error: '' });
    this.updateCanSubmit(this.data.name, this.data.phone, idCard);
  },

  updateCanSubmit(name, phone, idCard) {
    const canSubmit = !!(name && phone && idCard);
    if (canSubmit !== this.data.canSubmit) {
      this.setData({ canSubmit });
    }
  },

  async onGetPhoneNumber(e) {
    if (e.detail.errMsg !== 'getPhoneNumber:ok') {
      wx.showToast({ title: '需要授权才能获取手机号', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '获取手机号...' });

    try {
      const loginRes = await new Promise((resolve, reject) => {
        wx.login({
          success: resolve,
          fail: reject,
        });
      });

      if (!loginRes || !loginRes.code) {
        throw new Error('获取授权失败');
      }

      const res = await wx.cloud.callFunction({
        name: 'authLogin',
        data: {
          action: 'get_phone',
          code: loginRes.code,
          encryptedData: e.detail.encryptedData,
          iv: e.detail.iv,
        },
      });

      const result = res?.result || {};
      if (!result.ok || !result.data?.phone) {
        throw new Error(result.message || '获取手机号失败');
      }

      const phone = result.data.phone;
      this.setData({ phone, error: '' });
      this.updateCanSubmit(this.data.name, phone, this.data.idCard);
      wx.showToast({ title: '已获取手机号', icon: 'success' });
    } catch (err) {
      wx.showToast({
        title: err.message?.includes('WECHAT_APP_SECRET')
          ? '请在云函数环境配置 WECHAT_APP_SECRET'
          : '获取失败，请手动输入',
        icon: 'none',
        duration: 2500,
      });
    } finally {
      wx.hideLoading();
    }
  },

  async handleOcr() {
    try {
      const media = await new Promise((resolve, reject) => {
        wx.chooseMedia({
          count: 1,
          mediaType: ['image'],
          sourceType: ['camera'],
          success: resolve,
          fail: reject,
        });
      });

      if (!media || !media.tempFiles || !media.tempFiles[0]) return;

      wx.showLoading({ title: '识别中...' });

      const uploadRes = await app.upload({
        url: '/upload',
        filePath: media.tempFiles[0].tempFilePath,
        name: 'file',
      });

      const ocrRes = await app.request({
        url: '/user/register/ocr',
        method: 'POST',
        data: {
          imageUrl: uploadRes.url || uploadRes.fileId,
        },
      });

      wx.hideLoading();

      if (ocrRes) {
        const update = {};
        if (ocrRes.name) update.name = ocrRes.name;
        if (ocrRes.idCard) update.idCard = ocrRes.idCard;
        if (Object.keys(update).length > 0) {
          this.setData(update);
          this.updateCanSubmit(
            update.name || this.data.name,
            this.data.phone,
            update.idCard || this.data.idCard,
          );
          wx.showToast({ title: '识别成功', icon: 'success' });
        }
      }
    } catch (err) {
      wx.hideLoading();
      if (err && err.errMsg && err.errMsg.includes('cancel')) return;
      wx.showToast({ title: '识别失败，请手动输入', icon: 'none' });
    }
  },

  handleSubmit() {
    if (this.data.submitting) return;
    this._doSubmit();
  },

  async _doSubmit() {
    const { name, phone, idCard } = this.data;

    if (!name || !phone || !idCard) {
      this.setData({ error: '请填写完整信息' });
      return;
    }

    if (phone.length !== 11) {
      this.setData({ error: '请输入正确的11位手机号' });
      return;
    }

    if (idCard.length < 15) {
      this.setData({ error: '请输入正确的身份证号' });
      return;
    }

    this.setData({ submitting: true, error: '' });

    try {
      await app.request({
        url: '/user/profile',
        method: 'PATCH',
        data: { name, phone, idCard },
      });

      wx.showToast({ title: '保存成功', icon: 'success', duration: 700 });

      const userInfo = wx.getStorageSync('userInfo') || {};
      Object.assign(userInfo, { name, registerStage: 'complete' });
      wx.setStorageSync('userInfo', userInfo);
      app.globalData.userInfo = userInfo;

      setTimeout(() => {
        wx.navigateBack({ fail: () => this._goHome() });
      }, 500);
    } catch (err) {
      this.setData({
        error: err?.message || '保存失败，请重试',
        submitting: false,
      });
    }
  },

  handleSkip() {
    wx.showModal({
      title: '提示',
      content: '跳过后将无法使用完整功能，确定跳过吗？',
      success: (res) => {
        if (res.confirm) {
          wx.navigateBack({ fail: () => this._goHome() });
        }
      },
    });
  },

  _goHome() {
    const userInfo = wx.getStorageSync('userInfo') || {};
    const role = userInfo.role || userInfo.roleKey || 'worker';
    const adminRoles = ['super_admin', 'region_admin', 'base_manager', 'field_manager'];
    if (adminRoles.includes(role)) {
      wx.reLaunch({ url: '/pages/admin/home/home' });
    } else if (role === 'boss') {
      wx.switchTab({ url: '/pages/base/list/list' });
    } else {
      wx.switchTab({ url: '/pages/index/index' });
    }
  },
});
