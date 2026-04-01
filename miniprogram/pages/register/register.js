/**
 * Register page for worker and boss accounts.
 */
const app = getApp();

function normalizeRegisterRole(role) {
  return role === 'boss' ? 'boss' : 'worker';
}

function normalizeText(value) {
  return String(value || '').trim();
}

function cleanPhone(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 11);
}

function cleanBankCardNo(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 30);
}

function cleanIdCard(value) {
  return String(value || '').trim().toUpperCase();
}

function normalizeBaseUrl(value) {
  let url = String(value || '').trim();
  if (!url) return '';
  if (!/^https?:\/\//i.test(url)) {
    url = `http://${url}`;
  }
  if (!/\/api(?:\/)?$/i.test(url)) {
    url = `${url.replace(/\/+$/, '')}/api`;
  }
  return url.replace(/\/+$/, '');
}

function extractRawError(err) {
  const messageFromResponse = Array.isArray(err?.response?.message)
    ? err.response.message.join(' / ')
    : (err?.response?.message || err?.response?.msg || '');

  return [err?.message, err?.errMsg, messageFromResponse]
    .filter(Boolean)
    .map((item) => String(item))
    .join(' / ');
}

function toErrorMessage(err) {
  if (!err) return '注册失败，请稍后重试';
  const raw = extractRawError(err);

  if (err.statusCode === 409 || /Conflict|already\s+exists|已被注册|已被使用/i.test(raw)) {
    return '手机号、身份证号或银行卡已被使用，请检查后重试';
  }

  if (/ERR_ADDRESS_UNREACHABLE|request:fail|Network request failed/i.test(raw)) {
    const urlMatch = raw.match(/\((https?:\/\/[^)]+)\)/i);
    const target = urlMatch ? urlMatch[1] : '当前后端地址';
    return `无法连接后端：${target}。请在“网络设置”中更新接口地址。`;
  }

  return raw || '注册失败，请稍后重试';
}

function formatBaseUrlForDisplay(value) {
  const text = String(value || '').trim();
  if (!text) return '未设置';
  if (text.length <= 40) return text;
  return `${text.slice(0, 18)}...${text.slice(-14)}`;
}

Page({
  data: {
    registerRole: 'worker',
    name: '',
    idCard: '',
    phone: '',
    homeAddress: '',
    bankName: '',
    bankCardNo: '',
    emergencyContact: '',
    emergencyPhone: '',

    loading: false,
    error: '',

    nameFocus: false,
    idCardFocus: false,
    phoneFocus: false,

    showApiConfig: false,
    apiBaseUrlInput: '',
    currentBaseUrlDisplay: '未设置',
    devtoolsBaseUrl: '',
    lanBaseUrl: '',
  },

  onLoad(options) {
    this.setData({
      registerRole: normalizeRegisterRole(options?.role),
    });
    this.refreshApiConfig();
  },

  onShow() {
    this.refreshApiConfig();
  },

  refreshApiConfig() {
    const current = app.globalData.baseUrl || wx.getStorageSync('apiBaseUrl') || '';
    const envUrls = app.globalData.envBaseUrls || {};
    this.setData({
      apiBaseUrlInput: current,
      currentBaseUrlDisplay: formatBaseUrlForDisplay(current),
      devtoolsBaseUrl: envUrls.devtools || '',
      lanBaseUrl: envUrls.lan || '',
    });
  },

  onInputName(e) {
    this.setData({ name: e.detail.value, error: '' });
  },

  onInputIdCard(e) {
    this.setData({ idCard: cleanIdCard(e.detail.value), error: '' });
  },

  onInputPhone(e) {
    this.setData({ phone: cleanPhone(e.detail.value), error: '' });
  },

  onInputHomeAddress(e) {
    this.setData({ homeAddress: e.detail.value, error: '' });
  },

  onInputBankName(e) {
    this.setData({ bankName: e.detail.value, error: '' });
  },

  onInputBankCardNo(e) {
    this.setData({ bankCardNo: cleanBankCardNo(e.detail.value), error: '' });
  },

  onInputEmergencyContact(e) {
    this.setData({ emergencyContact: e.detail.value, error: '' });
  },

  onInputEmergencyPhone(e) {
    this.setData({ emergencyPhone: cleanPhone(e.detail.value), error: '' });
  },

  onNameFocus() {
    this.setData({ nameFocus: true });
  },

  onNameBlur() {
    this.setData({ nameFocus: false });
  },

  onIdCardFocus() {
    this.setData({ idCardFocus: true });
  },

  onIdCardBlur() {
    this.setData({ idCardFocus: false });
  },

  onPhoneFocus() {
    this.setData({ phoneFocus: true });
  },

  onPhoneBlur() {
    this.setData({ phoneFocus: false });
  },

  toggleApiConfig() {
    this.setData({ showApiConfig: !this.data.showApiConfig });
  },

  onInputApiBaseUrl(e) {
    this.setData({ apiBaseUrlInput: e.detail.value || '' });
  },

  useApiPreset(e) {
    const url = e.currentTarget.dataset.url || '';
    if (!url) return;
    this.setData({ apiBaseUrlInput: url });
  },

  saveApiBaseUrl() {
    const normalized = normalizeBaseUrl(this.data.apiBaseUrlInput);
    if (!normalized || !/^https?:\/\//i.test(normalized)) {
      wx.showToast({ title: '请输入正确的接口地址', icon: 'none' });
      return;
    }

    app.setApiBaseUrl(normalized);
    this.setData({
      apiBaseUrlInput: normalized,
      currentBaseUrlDisplay: formatBaseUrlForDisplay(normalized),
      showApiConfig: false,
    });

    wx.showToast({ title: '接口地址已更新', icon: 'none' });
  },

  async handleRegister() {
    const registerRole = normalizeRegisterRole(this.data.registerRole);
    const name = normalizeText(this.data.name);
    const idCard = cleanIdCard(this.data.idCard);
    const phone = cleanPhone(this.data.phone);
    const homeAddress = normalizeText(this.data.homeAddress);
    const bankName = normalizeText(this.data.bankName);
    const bankCardNo = cleanBankCardNo(this.data.bankCardNo);
    const emergencyContact = normalizeText(this.data.emergencyContact);
    const emergencyPhone = cleanPhone(this.data.emergencyPhone);

    if (!name) {
      this.setData({ error: '请输入真实姓名' });
      return;
    }

    if (!/^\d{17}[\dX]$/.test(idCard)) {
      this.setData({ error: '身份证格式不正确，请输入18位身份证号' });
      return;
    }

    if (phone.length !== 11) {
      this.setData({ error: '请输入正确的11位手机号' });
      return;
    }

    if (registerRole === 'worker') {
      if (!homeAddress || homeAddress.length < 5) {
        this.setData({ error: '请填写详细家庭地址（至少5个字）' });
        return;
      }

      if (!bankName) {
        this.setData({ error: '请输入开户银行' });
        return;
      }

      if (bankCardNo.length < 12) {
        this.setData({ error: '请输入正确的银行卡号' });
        return;
      }
    }

    if (emergencyPhone && emergencyPhone.length !== 11) {
      this.setData({ error: '紧急联系人电话需为11位手机号' });
      return;
    }

    this.setData({
      name,
      idCard,
      phone,
      homeAddress,
      bankName,
      bankCardNo,
      emergencyContact,
      emergencyPhone,
      loading: true,
      error: '',
    });

    try {
      const url = registerRole === 'boss' ? '/user/register/boss' : '/user/register';
      const payload = {
        name,
        idCard,
        phone,
        roleKey: registerRole,
        emergencyContact: emergencyContact || undefined,
        emergencyPhone: emergencyPhone || undefined,
      };

      if (registerRole === 'worker') {
        payload.homeAddress = homeAddress;
        payload.bankName = bankName;
        payload.bankCardNo = bankCardNo;
      }

      await app.request({
        url,
        method: 'POST',
        data: payload,
      });

      this.setData({ loading: false });
      wx.showToast({
        title: registerRole === 'boss' ? '老板注册成功' : '注册成功',
        icon: 'success',
        duration: 1200,
      });

      setTimeout(() => {
        wx.navigateBack();
      }, 1200);
    } catch (err) {
      const message = toErrorMessage(err);
      this.setData({ error: message, loading: false });

      if (/冲突|已被|already/i.test(message)) {
        wx.showModal({
          title: '注册冲突',
          content: message,
          confirmText: '去登录',
          cancelText: '继续填写',
          success: (res) => {
            if (res.confirm) {
              wx.navigateBack();
            }
          },
        });
      }
    }
  },

  goToLogin() {
    wx.navigateBack();
  },
});
