/**
 * Layer: Mini Program Page
 * Responsibility: Step-by-step real-name authentication wizard.
 * Called after phone registration + role selection to collect
 * name, ID card, gender, address, phone, and emergency contact.
 */
const app = getApp();

function normalizeText(value) {
  return String(value || '').trim();
}
function cleanPhone(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 11);
}
function cleanIdCard(value) {
  return String(value || '').trim().toUpperCase();
}

function buildSteps(role) {
  const isWorker = role === 'worker';
  const steps = [
    { key: 'welcome',   label: '欢迎',     icon: '👋', question: '完成实名认证' },
    { key: 'name',      label: '姓名',     icon: '✍️', question: '你叫什么名字？' },
    { key: 'identity',  label: '身份',     icon: '🪪', question: '请填写身份证信息' },
  ];
  if (isWorker) {
    steps.push({ key: 'gender',  label: '性别',   icon: '👤', question: '你的性别是？' });
    steps.push({ key: 'poverty', label: '贫困户', icon: '📋', question: '是否建档立卡贫困户？' });
  }
  steps.push(
    { key: 'phone',     label: '手机号', icon: '📱', question: '你的手机号是？' },
    { key: 'confirm',   label: '确认',   icon: '✅', question: '确认信息并提交' },
  );
  return steps;
}

Page({
  data: {
    /* Step state */
    currentStep: 0,
    totalSteps: 0,
    stepClasses: [],
    stepLabels: [],
    stepIcons: [],
    stepQuestions: [],
    stepKeys: [],
    progressPercent: 0,

    /* Role */
    role: 'worker',

    /* Form fields */
    name: '',
    idCard: '',
    phone: '',
    gender: '',
    isPoorHousehold: '',
    homeAddress: '',
    emergencyContact: '',
    emergencyPhone: '',

    /* UI */
    loading: false,
    stepError: '',
  },

  onLoad() {
    const userInfo = wx.getStorageSync('userInfo') || {};
    const role = userInfo.role || userInfo.roleKey || 'worker';
    const steps = buildSteps(role);

    this.setData({
      role,
      totalSteps: steps.length,
      stepLabels: steps.map(s => s.label),
      stepIcons: steps.map(s => s.icon),
      stepQuestions: steps.map(s => s.question),
      stepKeys: steps.map(s => s.key),
    });

    this.setData({
      name: userInfo.name || '',
      idCard: cleanIdCard(userInfo.idCard || ''),
      phone: userInfo.phone ? cleanPhone(userInfo.phone) : '',
      gender: userInfo.gender || '',
      isPoorHousehold: typeof userInfo.isPoorHousehold === 'boolean'
        ? (userInfo.isPoorHousehold ? 'yes' : 'no')
        : '',
      homeAddress: userInfo.homeAddress || '',
      emergencyContact: userInfo.emergencyContact || '',
      emergencyPhone: userInfo.emergencyPhone ? cleanPhone(userInfo.emergencyPhone) : '',
    });

    this.computeStepClasses(0, steps.length);
  },

  /* ══════════════════════════════════════
     Step Navigation
     ══════════════════════════════════════ */

  nextStep() {
    const current = this.data.currentStep;
    const total = this.data.totalSteps;
    if (current >= total - 1) return;
    if (!this.validateStep(current)) return;

    this.setData({ stepError: '' });
    const next = current + 1;
    this.computeStepClasses(next, total);
    this.setData({ currentStep: next });
  },

  prevStep() {
    const current = this.data.currentStep;
    if (current <= 0) return;
    this.setData({ stepError: '' });
    this.computeStepClasses(current - 1, this.data.totalSteps);
    this.setData({ currentStep: current - 1 });
  },

  computeStepClasses(currentStep, totalSteps) {
    const classes = [];
    for (let i = 0; i < totalSteps; i++) {
      if (i === currentStep) classes.push('current');
      else if (i < currentStep) classes.push('past');
      else classes.push('future');
    }
    this.setData({
      stepClasses: classes,
      progressPercent: ((currentStep + 1) / totalSteps) * 100,
    });
  },

  validateStep(stepIndex) {
    const key = this.data.stepKeys[stepIndex];

    switch (key) {
      case 'welcome': return true;
      case 'name':
        if (!normalizeText(this.data.name)) {
          this.setData({ stepError: '请输入你的真实姓名' }); return false;
        }
        return true;
      case 'identity':
        if (!/^\d{17}[\dX]$/.test(cleanIdCard(this.data.idCard))) {
          this.setData({ stepError: '请输入正确的18位身份证号' }); return false;
        }
        if (normalizeText(this.data.homeAddress).length < 5) {
          this.setData({ stepError: '请输入身份证地址（至少5个字）' }); return false;
        }
        return true;
      case 'gender':
        if (!this.data.gender) { this.setData({ stepError: '请选择你的性别' }); return false; }
        return true;
      case 'poverty':
        if (!this.data.isPoorHousehold) { this.setData({ stepError: '请选择是否贫困户' }); return false; }
        return true;
      case 'phone':
        if (cleanPhone(this.data.phone).length !== 11) {
          this.setData({ stepError: '请输入正确的11位手机号' }); return false;
        }
        return true;
      case 'confirm': return true;
      default: return true;
    }
  },

  /* ══════════════════════════════════════
     Step-specific actions
     ══════════════════════════════════════ */

  onSelectGender(e) {
    const value = e.currentTarget.dataset.value;
    if (!value) return;
    this.setData({ gender: value, stepError: '' });
    setTimeout(() => this.nextStep(), 200);
  },

  onSelectPoverty(e) {
    const value = e.currentTarget.dataset.value;
    if (!value) return;
    this.setData({ isPoorHousehold: value, stepError: '' });
    setTimeout(() => this.nextStep(), 200);
  },

  handleOcr() {
    wx.showLoading({ title: '打开相机...' });
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['camera'],
      success: async (media) => {
        if (!media || !media.tempFiles || !media.tempFiles[0]) return;
        wx.showLoading({ title: '识别中...' });
        try {
          const uploadRes = await app.upload({
            url: '/upload',
            filePath: media.tempFiles[0].tempFilePath,
            name: 'file',
          });
          const ocrRes = await app.request({
            url: '/user/register/ocr',
            method: 'POST',
            data: { imageUrl: uploadRes.url || uploadRes.fileId },
          });
          wx.hideLoading();
          if (ocrRes) {
            const update = {};
            if (ocrRes.name) update.name = ocrRes.name;
            if (ocrRes.idCard) update.idCard = cleanIdCard(ocrRes.idCard);
            if (Object.keys(update).length > 0) {
              this.setData(update);
              wx.showToast({ title: '识别成功', icon: 'success' });
              if (update.name) setTimeout(() => this.nextStep(), 400);
            }
          }
        } catch (err) {
          wx.hideLoading();
          wx.showToast({ title: '识别失败，请手动输入', icon: 'none' });
        }
      },
      fail: () => wx.hideLoading(),
    });
  },

  /* ══════════════════════════════════════
     Input handlers
     ══════════════════════════════════════ */

  onInputName(e) { this.setData({ name: e.detail.value, stepError: '' }); },
  onInputIdCard(e) { this.setData({ idCard: cleanIdCard(e.detail.value), stepError: '' }); },
  onInputPhone(e) { this.setData({ phone: cleanPhone(e.detail.value), stepError: '' }); },
  onInputHomeAddress(e) { this.setData({ homeAddress: e.detail.value, stepError: '' }); },
  onInputEmergencyContact(e) { this.setData({ emergencyContact: e.detail.value }); },
  onInputEmergencyPhone(e) { this.setData({ emergencyPhone: cleanPhone(e.detail.value) }); },

  handleSkipEmergency() { this.nextStep(); },

  /* ══════════════════════════════════════
     Submit
     ══════════════════════════════════════ */

  async handleSubmit() {
    const role = this.data.role;
    const name = normalizeText(this.data.name);
    const idCard = cleanIdCard(this.data.idCard);
    const phone = cleanPhone(this.data.phone);
    const homeAddress = normalizeText(this.data.homeAddress);
    const emergencyContact = normalizeText(this.data.emergencyContact);
    const emergencyPhone = cleanPhone(this.data.emergencyPhone);

    // Final validation
    if (!name) { this.setData({ stepError: '请输入真实姓名' }); return; }
    if (!/^\d{17}[\dX]$/.test(idCard)) { this.setData({ stepError: '身份证格式不正确' }); return; }
    if (phone.length !== 11) { this.setData({ stepError: '请输入正确的11位手机号' }); return; }
    if (!homeAddress || homeAddress.length < 5) { this.setData({ stepError: '请填写身份证地址' }); return; }
    if (role === 'worker' && !this.data.gender) { this.setData({ stepError: '请选择性别' }); return; }
    if (role === 'worker' && !this.data.isPoorHousehold) { this.setData({ stepError: '请选择是否贫困户' }); return; }
    if (emergencyPhone && emergencyPhone.length !== 11) { this.setData({ stepError: '紧急联系人电话需为11位手机号' }); return; }

    this.setData({ loading: true, stepError: '' });

    try {
      const payload = {
        name,
        idCard,
        phone,
        homeAddress,
        emergencyContact: emergencyContact || undefined,
        emergencyPhone: emergencyPhone || undefined,
      };
      if (role === 'worker') {
        payload.gender = this.data.gender;
        payload.isPoorHousehold = this.data.isPoorHousehold === 'yes';
      }

      const profile = await app.request({
        url: '/user/profile',
        method: 'PATCH',
        data: payload,
      });

      // Update local userInfo
      const userInfo = wx.getStorageSync('userInfo') || {};
      Object.assign(userInfo, {
        name,
        idCard,
        phone,
        homeAddress,
        emergencyContact,
        emergencyPhone,
        gender: role === 'worker' ? this.data.gender : userInfo.gender,
        isPoorHousehold: role === 'worker' ? this.data.isPoorHousehold === 'yes' : userInfo.isPoorHousehold,
        infoAuditStatus: 1,
        accountOwnerVerified: profile?.accountOwnerVerified !== false,
        registerStage: 'complete',
      });
      wx.setStorageSync('userInfo', userInfo);
      app.globalData.userInfo = userInfo;

      this.setData({ loading: false });

      wx.showToast({ title: '实名信息已完善', icon: 'success', duration: 1200 });

      setTimeout(() => {
        wx.navigateBack({ fail: () => {
          // Fallback: navigate to home
          if (role === 'boss') {
            wx.switchTab({ url: '/pages/base/list/list' });
          } else {
            wx.switchTab({ url: '/pages/index/index' });
          }
        }});
      }, 1200);
    } catch (err) {
      const message = err?.message || err?.errMsg || '提交失败，请重试';
      this.setData({ stepError: message, loading: false });
    }
  },

  goToHome() {
    const role = this.data.role;
    if (role === 'boss') {
      wx.reLaunch({ url: '/pages/base/list/list' });
    } else {
      wx.reLaunch({ url: '/pages/index/index' });
    }
  },
});
