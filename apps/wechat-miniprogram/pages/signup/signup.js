const app = getApp();

Page({
  data: {
    baseId: 0,
    jobId: 0,
    baseName: '',
    jobTitle: '',
    name: '',
    phone: '',
    idCard: '',
    workDate: '',
    note: '',
    submitting: false,
  },

  onLoad(options) {
    const baseId = Number(options.baseId || 0);
    const jobId = Number(options.jobId || 0);
    this.setData({
      baseId,
      jobId,
      baseName: decodeURIComponent(options.baseName || ''),
      jobTitle: decodeURIComponent(options.jobTitle || ''),
    });
    this.loadProfile();
  },

  async loadProfile() {
    try {
      const res = await app.request({ url: '/user/profile', method: 'GET' });
      const user = res && res.data ? res.data : res;
      if (user) {
        this.setData({
          name: user.name || '',
          phone: user.phone || '',
          idCard: user.idCard || '',
        });
      }
    } catch (_) {
      // Profile not loaded yet, user fills manually
    }
  },

  onInputName(e) { this.setData({ name: e.detail.value }); },
  onInputPhone(e) { this.setData({ phone: e.detail.value }); },
  onInputIdCard(e) { this.setData({ idCard: e.detail.value }); },
  onInputNote(e) { this.setData({ note: e.detail.value }); },

  onDateChange(e) {
    this.setData({ workDate: e.detail.value });
  },

  async onSubmit() {
    const { baseId, jobId, jobTitle, name, phone, idCard, workDate, note } = this.data;

    if (!name.trim()) return wx.showToast({ title: '请输入姓名', icon: 'none' });
    if (!phone.trim() || !/^1\d{10}$/.test(phone.trim())) return wx.showToast({ title: '请输入正确的手机号', icon: 'none' });
    if (!workDate) return wx.showToast({ title: '请选择工作日期', icon: 'none' });

    this.setData({ submitting: true });

    try {
      const res = await app.request({
        url: '/attendance/signup',
        method: 'POST',
        data: { baseId, jobId, note: note.trim(), workDate },
      });

      if (res && res.ok === false) {
        wx.showToast({ title: res.message || '报名失败', icon: 'none' });
        this.setData({ submitting: false });
        return;
      }

      const signupId = res && (res.id || res.signupId || 0);
      const isDuplicate = res && res.duplicate;

      const params = [
        `baseId=${baseId}`,
        `jobId=${jobId}`,
        `signupId=${signupId}`,
        `baseName=${encodeURIComponent(this.data.baseName)}`,
        `jobTitle=${encodeURIComponent(jobTitle)}`,
        `workDate=${workDate}`,
        isDuplicate ? 'duplicate=1' : '',
      ].filter(Boolean).join('&');

      wx.redirectTo({ url: `/pages/signup/success/success?${params}` });
    } catch (err) {
      wx.showToast({ title: err.message || '网络错误，请重试', icon: 'none' });
      this.setData({ submitting: false });
    }
  },
});
