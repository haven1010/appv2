/**
 * User profile page.
 */
const app = getApp();
const PHONE_REGEX = /^1[3-9]\d{9}$/;

const ROLE_TEXT_MAP = {
  worker: '采摘工',
  boss: '企业老板',
  field_manager: '现场管理员',
  base_manager: '基地管理员',
  super_admin: '超级管理员',
  region_admin: '超级管理员',
};

function maskPhone(phone) {
  if (!phone || phone.length < 7) return phone || '';
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
}

function maskIdCard(idCard) {
  if (!idCard) return '';
  return String(idCard).replace(/^(.{6})(?:\w+)(.{4})$/, '$1********$2');
}

function formatDate(dateValue) {
  if (!dateValue) return '-';
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return '-';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toRoleText(roleKey) {
  return ROLE_TEXT_MAP[roleKey] || '务工人员';
}

function trimText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isTemporaryImageUrl(value) {
  const text = trimText(value);
  if (!text) return false;
  return (
    /^https?:\/\/127\.0\.0\.1:\d+\/__tmp__\//i.test(text)
    || /^wxfile:\/\//i.test(text)
    || /^[a-zA-Z]:\\/.test(text)
    || /^file:\/\//i.test(text)
  );
}

function normalizePhone(value) {
  return String(value || '').replace(/\s/g, '').replace(/\D/g, '').slice(0, 11);
}

function formatPhone(value) {
  const clean = normalizePhone(value);
  if (clean.length > 3 && clean.length <= 7) {
    return clean.replace(/(\d{3})(\d+)/, '$1 $2');
  }
  if (clean.length > 7) {
    return clean.replace(/(\d{3})(\d{4})(\d+)/, '$1 $2 $3');
  }
  return clean;
}

function pickAvatarUrl(profile) {
  if (!profile) return '';
  const candidates = [
    profile.avatarUrl,
    profile.faceImgUrl,
    profile.headImgUrl,
    profile.photoUrl,
  ];

  for (let i = 0; i < candidates.length; i += 1) {
    const url = trimText(candidates[i]);
    if (url && !isTemporaryImageUrl(url)) return url;
  }

  return '';
}

function sanitizeAvatarInCache() {
  const cached = wx.getStorageSync('userInfo') || {};
  if (!cached || typeof cached !== 'object') return;

  const next = Object.assign({}, cached);
  let changed = false;
  ['avatarUrl', 'faceImgUrl', 'headImgUrl', 'photoUrl'].forEach((key) => {
    if (isTemporaryImageUrl(next[key])) {
      next[key] = '';
      changed = true;
    }
  });

  if (!changed) return;
  wx.setStorageSync('userInfo', next);
  app.globalData.userInfo = next;
}

function syncUserInfoCache(profile = {}) {
  const cached = wx.getStorageSync('userInfo') || {};
  const merged = Object.assign({}, cached, profile);
  const avatar = pickAvatarUrl(profile);

  if (avatar) {
    merged.avatarUrl = avatar;
    merged.faceImgUrl = avatar;
  } else {
    ['avatarUrl', 'faceImgUrl', 'headImgUrl', 'photoUrl'].forEach((key) => {
      if (isTemporaryImageUrl(merged[key])) merged[key] = '';
    });
  }

  wx.setStorageSync('userInfo', merged);
  app.globalData.userInfo = merged;
}

Page({
  data: {
    pageReady: false,
    infoExpanded: true,
    profile: null,
    form: {
      name: '',
      phone: '',
      homeAddress: '',
      emergencyContact: '',
      emergencyPhone: '',
    },
    errors: {
      name: '',
      phone: '',
      homeAddress: '',
      emergencyContact: '',
      emergencyPhone: '',
    },
    focusField: '',
    saving: false,
    auditStatusText: '-',
  },

  onLoad() {
    sanitizeAvatarInCache();
    this.loadData();
    setTimeout(() => {
      this.setData({ pageReady: true });
    }, 30);
  },

  onPullDownRefresh() {
    this.loadData().finally(() => wx.stopPullDownRefresh());
  },

  noop() {},

  handleBlankTap() {
    if (this.data.infoExpanded) {
      this.setData({ infoExpanded: false });
    }
  },

  toggleInfoCard() {
    this.setData({ infoExpanded: !this.data.infoExpanded });
  },

  copyByLongPress(e) {
    const value = e.currentTarget.dataset.copy;
    if (!value) return;
    const label = e.currentTarget.dataset.label || '内容';
    wx.setClipboardData({
      data: String(value),
      success: () => wx.showToast({ title: `${label}已复制`, icon: 'none' }),
    });
  },

  previewAvatar() {
    const avatarUrl = pickAvatarUrl(this.data.profile);
    if (!avatarUrl) {
      wx.showToast({ title: '暂无头像可预览', icon: 'none' });
      return;
    }
    wx.previewImage({
      current: avatarUrl,
      urls: [avatarUrl],
    });
  },


  onAvatarError() {
    sanitizeAvatarInCache();
    this.setData({ 'profile.avatarUrl': '' });
  },

  async loadData() {
    try {
      const res = await app.request({ url: '/user/profile', method: 'GET' });
      if (!res) return;

      const auditStatusText =
        Number(res.infoAuditStatus) === 1
          ? '已认证'
          : Number(res.infoAuditStatus) === 0
            ? '待审核'
            : '未认证';

      const roleText = toRoleText(res.roleKey || res.role);
      const departmentText = res.departmentName || (res.assignedBaseId ? '基地部门' : '未分配');
      const joinDateText = formatDate(res.createdAt);
      const avatarUrl = pickAvatarUrl(res);

      this.setData({
        profile: Object.assign({}, res, {
          roleText,
          departmentText,
          joinDateText,
          avatarUrl,
          phoneMasked: maskPhone(res.phone),
          emergencyPhoneMasked: maskPhone(res.emergencyPhone),
          idCardMasked: maskIdCard(res.idCard),
        }),
        form: {
          name: res.name || '',
          phone: formatPhone(res.phone || ''),
          homeAddress: res.homeAddress || '',
          emergencyContact: res.emergencyContact || '',
          emergencyPhone: formatPhone(res.emergencyPhone || ''),
        },
        errors: {
          name: '',
          phone: '',
          homeAddress: '',
          emergencyContact: '',
          emergencyPhone: '',
        },
        auditStatusText,
      });
      syncUserInfoCache(res);
    } catch (err) {
      wx.showToast({ title: '加载失败，请稍后重试', icon: 'none' });
    }
  },

  normalizeFieldValue(field, value) {
    if (field === 'phone' || field === 'emergencyPhone') {
      return formatPhone(value);
    }
    return typeof value === 'string' ? value : String(value || '');
  },

  triggerHaptic() {
    if (typeof wx.vibrateShort !== 'function') return;
    wx.vibrateShort({ type: 'light' });
  },

  validateField(field, value, options = {}) {
    const mode = options.mode || 'strict';
    const triggerHaptic = options.triggerHaptic !== false;

    const raw = typeof value === 'string' ? value : String(value || '');
    const safe = trimText(raw);
    const phoneSafe = normalizePhone(raw);
    const emergencyPhoneSafe = normalizePhone(this.data.form.emergencyPhone);
    const emergencyContactSafe = trimText(this.data.form.emergencyContact);

    let error = '';

    if (field === 'name') {
      if (!safe) {
        error = mode === 'strict' ? '请输入姓名' : '';
      } else if (safe.length < 2 || safe.length > 20) {
        error = '姓名长度需在 2-20 个字';
      } else if (/\d/.test(safe)) {
        error = '姓名不能包含数字';
      }
    }

    if (field === 'phone') {
      if (!phoneSafe) {
        error = mode === 'strict' ? '请输入手机号' : '';
      } else if ((mode === 'strict' || phoneSafe.length === 11) && !PHONE_REGEX.test(phoneSafe)) {
        error = '手机号格式不正确';
      }
    }

    if (field === 'homeAddress') {
      const roleKey = this.data.profile?.roleKey || this.data.profile?.role || '';
      const required = roleKey === 'worker';
      if (required && mode === 'strict' && !safe) {
        error = '请填写家庭地址';
      } else if (safe && safe.length < 5) {
        error = '家庭地址至少 5 个字';
      }
    }

    if (field === 'emergencyContact') {
      if (mode === 'strict' && emergencyPhoneSafe && !safe) {
        error = '请填写紧急联系人';
      }
    }

    if (field === 'emergencyPhone') {
      if (mode === 'strict' && emergencyContactSafe && !phoneSafe) {
        error = '请填写紧急联系人电话';
      } else if (phoneSafe && (mode === 'strict' || phoneSafe.length === 11) && !PHONE_REGEX.test(phoneSafe)) {
        error = '紧急联系人电话格式不正确';
      }
    }

    const oldError = this.data.errors[field];
    this.setData({ ['errors.' + field]: error });

    if (triggerHaptic && error && oldError !== error) {
      this.triggerHaptic();
    }
    return !error;
  },

  handleFocus(e) {
    const field = e.currentTarget.dataset.field;
    if (!field) return;
    this.setData({ focusField: field });
  },

  handleBlur(e) {
    const field = e.currentTarget.dataset.field;
    if (!field) return;

    const value = this.normalizeFieldValue(field, e.detail.value);
    this.setData({
      focusField: this.data.focusField === field ? '' : this.data.focusField,
      ['form.' + field]: value,
    });
    this.validateField(field, value, { mode: 'strict', triggerHaptic: true });
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field;
    if (!field) return;

    const value = this.normalizeFieldValue(field, e.detail.value);
    this.setData({ ['form.' + field]: value });
    this.validateField(field, value, { mode: 'input', triggerHaptic: true });
  },

  async handleSave() {
    const normalizedForm = {
      name: trimText(this.data.form.name),
      phone: formatPhone(this.data.form.phone),
      homeAddress: trimText(this.data.form.homeAddress),
      emergencyContact: trimText(this.data.form.emergencyContact),
      emergencyPhone: formatPhone(this.data.form.emergencyPhone),
    };

    this.setData({ form: normalizedForm });

    const fields = ['name', 'phone', 'homeAddress', 'emergencyContact', 'emergencyPhone'];
    let isValid = true;
    let firstInvalidField = '';

    fields.forEach((field) => {
      const ok = this.validateField(field, normalizedForm[field], {
        mode: 'strict',
        triggerHaptic: false,
      });
      if (!ok) {
        isValid = false;
        if (!firstInvalidField) firstInvalidField = field;
      }
    });

    if (!isValid) {
      this.setData({ focusField: firstInvalidField || '' });
      this.triggerHaptic();
      wx.showToast({ title: '请完善信息', icon: 'none' });
      return;
    }

    const submitPayload = {
      name: normalizedForm.name,
      phone: normalizePhone(normalizedForm.phone),
      homeAddress: normalizedForm.homeAddress || undefined,
      emergencyContact: normalizedForm.emergencyContact || undefined,
      emergencyPhone: normalizePhone(normalizedForm.emergencyPhone) || undefined,
    };

    this.setData({ saving: true });
    try {
      await app.request({
        url: '/user/profile',
        method: 'PATCH',
        data: submitPayload,
      });
      wx.showToast({ title: '保存成功', icon: 'success' });
      await this.loadData();
    } catch (err) {
      wx.showToast({ title: err.message || '保存失败，请稍后重试', icon: 'none' });
    } finally {
      this.setData({ saving: false });
    }
  },
});
