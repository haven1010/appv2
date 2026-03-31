/**
 * Layer: Mini Program Page
 * Responsibility: Implements the User Info page lifecycle, local interaction state, and backend integration for the WeChat client.
 * Notes: Keep comments focused on intent, invariants, side effects, and cross-module contracts.
 */
// pages/profile/userInfo/userInfo.js
const app = getApp();

const ROLE_TEXT_MAP = {
  worker: '采摘工',
  field_manager: '现场管理员',
  base_manager: '基地管理员',
  super_admin: '平台管理员',
  region_admin: '平台管理员',
};

function maskPhone(phone) {
  if (!phone || phone.length < 7) return phone || '';
  return phone.slice(0, 3) + '****' + phone.slice(-4);
}

function maskIdCard(idCard) {
  if (!idCard) return '';
  return idCard.replace(/^(.{6})(?:\w+)(.{4})$/, '$1********$2');
}

function formatDate(dateValue) {
  if (!dateValue) return '-';
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return '-';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return year + '-' + month + '-' + day;
}

function toRoleText(roleKey) {
  return ROLE_TEXT_MAP[roleKey] || '务工人员';
}

function trimText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanPhone(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 11);
}

function pickAvatarUrl(profile) {
  if (!profile) return '';
  return profile.avatarUrl || profile.faceImgUrl || profile.headImgUrl || profile.photoUrl || '';
}

Page({
  data: {
    pageReady: false,
    topShadeOpacity: 0,
    scrollTop: 0,
    infoExpanded: true,
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
    setTimeout(() => {
      this.setData({ pageReady: true });
    }, 30);
  },

  onPullDownRefresh() {
    this.loadData().finally(() => wx.stopPullDownRefresh());
  },

  onScroll(e) {
    const scrollTop = (e.detail && e.detail.scrollTop) || 0;
    const topShadeOpacity = Math.min(1, scrollTop / 140);
    if (Math.abs(scrollTop - this.data.scrollTop) < 6) return;
    this.setData({ scrollTop, topShadeOpacity });
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
      success: () => wx.showToast({ title: label + '已复制', icon: 'none' }),
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

  async loadData() {
    try {
      const res = await app.request({ url: '/user/profile', method: 'GET' });
      if (!res) return;

      const auditStatusText =
        res.infoAuditStatus === 1
          ? '已认证'
          : res.infoAuditStatus === 0
          ? '待审核'
          : '未认证';

      const roleText = toRoleText(res.roleKey);
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
          phone: res.phone || '',
          emergencyContact: res.emergencyContact || '',
          emergencyPhone: res.emergencyPhone || '',
        },
        auditStatusText,
      });
    } catch (err) {
      wx.showToast({ title: '加载失败，请稍后重试', icon: 'none' });
    }
  },

  onInputName(e) {
    this.setData({ 'form.name': e.detail.value });
  },

  onInputPhone(e) {
    this.setData({ 'form.phone': cleanPhone(e.detail.value) });
  },

  onInputEmergencyContact(e) {
    this.setData({ 'form.emergencyContact': e.detail.value });
  },

  onInputEmergencyPhone(e) {
    this.setData({ 'form.emergencyPhone': cleanPhone(e.detail.value) });
  },

  async handleSave() {
    const { name, phone, emergencyContact, emergencyPhone } = this.data.form;
    const nextName = trimText(name);
    const nextPhone = cleanPhone(phone);
    const nextEmergencyPhone = cleanPhone(emergencyPhone);

    if (!nextName) {
      wx.showToast({ title: '请输入姓名', icon: 'none' });
      return;
    }

    if (nextPhone && !/^\d{11}$/.test(nextPhone)) {
      wx.showToast({ title: '手机号格式不正确', icon: 'none' });
      return;
    }

    if (nextEmergencyPhone && !/^\d{11}$/.test(nextEmergencyPhone)) {
      wx.showToast({ title: '紧急联系人电话格式不正确', icon: 'none' });
      return;
    }

    this.setData({ saving: true });
    try {
      await app.request({
        url: '/user/profile',
        method: 'PATCH',
        data: {
          name: nextName,
          phone: nextPhone || undefined,
          emergencyContact: trimText(emergencyContact) || undefined,
          emergencyPhone: nextEmergencyPhone || undefined,
        },
      });
      wx.showToast({ title: '保存成功', icon: 'none' });
      await this.loadData();
    } catch (err) {
      wx.showToast({ title: err.message || '保存失败，请稍后重试', icon: 'none' });
    } finally {
      this.setData({ saving: false });
    }
  },
});
