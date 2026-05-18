/**
 * Register page for worker and boss accounts.
 */
const app = getApp();
const BOSS_BANK_OPTIONS = [
  { label: '请选择开户银行', value: '' },
  { label: '中国工商银行', value: '中国工商银行' },
  { label: '中国农业银行', value: '中国农业银行' },
  { label: '中国银行', value: '中国银行' },
  { label: '中国建设银行', value: '中国建设银行' },
  { label: '交通银行', value: '交通银行' },
  { label: '招商银行', value: '招商银行' },
  { label: '中国邮政储蓄银行', value: '中国邮政储蓄银行' },
];
const GENDER_OPTIONS = [
  { label: '请选择性别', value: '' },
  { label: '男', value: 'male' },
  { label: '女', value: 'female' },
];
const POVERTY_OPTIONS = [
  { label: '请选择是否贫困户', value: '' },
  { label: '是', value: 'yes' },
  { label: '否', value: 'no' },
];

function normalizeRegisterRole(role) {
  return role === 'boss' ? 'boss' : 'worker';
}

function normalizeRegisterMode(mode, role) {
  if (role !== 'worker') return 'self';
  return mode === 'proxy' ? 'proxy' : 'self';
}

function normalizeText(value) {
  return String(value || '').trim();
}

function cleanPhone(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 11);
}

function cleanBankCardNo(value, maxLength = 30) {
  return String(value || '').replace(/\D/g, '').slice(0, maxLength);
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

  if (/代注册|审核|接管|代理|家人/i.test(raw)) {
    return raw;
  }

  if (err.statusCode === 409 || /Conflict|already\s+exists|已被注册|已被使用/i.test(raw)) {
    return '手机号、身份证号或银行卡已被使用，请检查后重试';
  }

  if (/ERR_ADDRESS_UNREACHABLE|request:fail|Network request failed/i.test(raw)) {
    const urlMatch = raw.match(/\((https?:\/\/[^)]+)\)/i);
    const target = urlMatch ? urlMatch[1] : '当前后端地址';
    return `无法连接后端：${target}。请确认后端服务和网络连通。`;
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
    bossBankOptions: BOSS_BANK_OPTIONS,
    bossBankIndex: 0,
    genderOptions: GENDER_OPTIONS,
    genderIndex: 0,
    povertyOptions: POVERTY_OPTIONS,
    povertyIndex: 0,
    registerMode: 'self',
    name: '',
    idCard: '',
    phone: '',
    homeAddress: '',
    bankName: '',
    bankCardNo: '',
    emergencyContact: '',
    emergencyPhone: '',
    proxyName: '',
    proxyPhone: '',
    relationToWorker: '',
    consentStatement: '',

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
    const registerRole = normalizeRegisterRole(options?.role);
    this.setData({
      registerRole,
      registerMode: normalizeRegisterMode(options?.mode, registerRole),
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

  onGenderChange(e) {
    this.setData({
      genderIndex: Number(e.detail.value || 0),
      error: '',
    });
  },

  onPovertyChange(e) {
    this.setData({
      povertyIndex: Number(e.detail.value || 0),
      error: '',
    });
  },

  onInputHomeAddress(e) {
    this.setData({ homeAddress: e.detail.value, error: '' });
  },

  onInputBankName(e) {
    this.setData({ bankName: e.detail.value, error: '' });
  },

  onBossBankChange(e) {
    const bossBankIndex = Number(e.detail.value || 0);
    const selected = this.data.bossBankOptions[bossBankIndex] || this.data.bossBankOptions[0];
    this.setData({
      bossBankIndex,
      bankName: selected.value || '',
      error: '',
    });
  },

  onInputBankCardNo(e) {
    const maxLength = this.data.registerRole === 'boss' ? 19 : 30;
    this.setData({
      bankCardNo: cleanBankCardNo(e.detail.value, maxLength),
      error: '',
    });
  },

  onInputEmergencyContact(e) {
    this.setData({ emergencyContact: e.detail.value, error: '' });
  },

  onInputEmergencyPhone(e) {
    this.setData({ emergencyPhone: cleanPhone(e.detail.value), error: '' });
  },

  onInputProxyName(e) {
    this.setData({ proxyName: e.detail.value, error: '' });
  },

  onInputProxyPhone(e) {
    this.setData({ proxyPhone: cleanPhone(e.detail.value), error: '' });
  },

  onInputRelationToWorker(e) {
    this.setData({ relationToWorker: e.detail.value, error: '' });
  },

  onInputConsentStatement(e) {
    this.setData({ consentStatement: e.detail.value, error: '' });
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

  onSwitchRegisterMode(e) {
    const role = normalizeRegisterRole(this.data.registerRole);
    if (role !== 'worker') return;
    const mode = normalizeRegisterMode(e.currentTarget.dataset.mode, role);
    if (mode === this.data.registerMode) return;
    this.setData({
      registerMode: mode,
      error: '',
    });
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

    const saved = app.setApiBaseUrl(normalized);
    if (!saved) return;

    this.setData({
      apiBaseUrlInput: normalized,
      currentBaseUrlDisplay: formatBaseUrlForDisplay(normalized),
      showApiConfig: false,
    });

    wx.showToast({ title: '接口地址已更新', icon: 'none' });
  },

  async handleRegister() {
    const registerRole = normalizeRegisterRole(this.data.registerRole);
    const registerMode = normalizeRegisterMode(this.data.registerMode, registerRole);
    const name = normalizeText(this.data.name);
    const idCard = cleanIdCard(this.data.idCard);
    const phone = cleanPhone(this.data.phone);
    const homeAddress = normalizeText(this.data.homeAddress);
    const bankName = normalizeText(this.data.bankName);
    const bankCardNo = cleanBankCardNo(this.data.bankCardNo);
    const emergencyContact = normalizeText(this.data.emergencyContact);
    const emergencyPhone = cleanPhone(this.data.emergencyPhone);
    const proxyName = normalizeText(this.data.proxyName);
    const proxyPhone = cleanPhone(this.data.proxyPhone);
    const relationToWorker = normalizeText(this.data.relationToWorker);
    const consentStatement = normalizeText(this.data.consentStatement);
    const gender = this.data.genderOptions[this.data.genderIndex]?.value || '';
    const povertySelection = this.data.povertyOptions[this.data.povertyIndex]?.value || '';
    const isPoorHousehold = povertySelection === 'yes';

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

    if (!homeAddress || homeAddress.length < 5) {
      this.setData({ error: '请填写身份证地址（至少5个字）' });
      return;
    }

    if (registerRole === 'boss') {
      if (!bankName) {
        this.setData({ error: '请选择开户银行' });
        return;
      }

      if (!/^\d{16,19}$/.test(bankCardNo)) {
        this.setData({ error: '老板银行卡号需为16-19位数字' });
        return;
      }
    }

    if (registerRole === 'worker') {
      if (!gender) {
        this.setData({ error: '请选择性别' });
        return;
      }

      if (!povertySelection) {
        this.setData({ error: '请选择是否贫困户' });
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

      if (registerMode === 'proxy') {
        if (!proxyName) {
          this.setData({ error: '请填写代办人姓名' });
          return;
        }

        if (proxyPhone.length !== 11) {
          this.setData({ error: '请填写代办人11位手机号' });
          return;
        }

        if (!relationToWorker) {
          this.setData({ error: '请填写代办人与工人的关系' });
          return;
        }
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
      proxyName,
      proxyPhone,
      relationToWorker,
      consentStatement,
      genderIndex: this.data.genderIndex,
      povertyIndex: this.data.povertyIndex,
      loading: true,
      error: '',
    });

    try {
      if (registerRole === 'worker' && registerMode === 'proxy') {
        const proxyPayload = {
          workerName: name,
          workerIdCard: idCard,
          workerPhone: phone,
          workerGender: gender,
          workerIsPoorHousehold: isPoorHousehold,
          workerHomeAddress: homeAddress,
          workerBankName: bankName,
          workerBankCardNo: bankCardNo,
          workerEmergencyContact: emergencyContact || undefined,
          workerEmergencyPhone: emergencyPhone || undefined,
          proxyName,
          proxyPhone,
          relationToWorker,
          consentType: 'family_confirm',
          consentStatement: consentStatement || '代办人已获得工人授权并确认提交。',
        };

        const result = await app.request({
          url: '/user/register/proxy',
          method: 'POST',
          data: proxyPayload,
        });

        this.setData({ loading: false });
        wx.showModal({
          title: '代注册已提交',
          content: `已生成审核单（ID: ${result?.caseId || '-'}）。管理员审核通过后，工人本人可登录并完成账号接管。`,
          showCancel: false,
          success: () => {
            wx.navigateBack();
          },
        });
        return;
      }

      const url = registerRole === 'boss' ? '/user/register/boss' : '/user/register';
      const payload = {
        name,
        idCard,
        phone,
        roleKey: registerRole,
        homeAddress,
        emergencyContact: emergencyContact || undefined,
        emergencyPhone: emergencyPhone || undefined,
      };

      if (registerRole === 'worker') {
        payload.gender = gender;
        payload.isPoorHousehold = isPoorHousehold;
        payload.bankName = bankName;
        payload.bankCardNo = bankCardNo;
      }

      if (registerRole === 'boss') {
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
