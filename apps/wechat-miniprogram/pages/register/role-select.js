/**
 * Layer: Mini Program Page
 * Responsibility: Role selection after first-time phone registration.
 * Asks "Are you a boss or a worker?" and sets the user's role.
 */
const app = getApp();

Page({
  data: {
    selectedRole: '',
    confirming: false,
    animClass: '',
  },

  onLoad() {
    // Auto-advance animation after page load
    setTimeout(() => {
      this.setData({ animClass: 'anim-in' });
    }, 100);
  },

  onSelectRole(e) {
    const role = e.currentTarget.dataset.role;
    this.setData({ selectedRole: role });
    this.vibrateShort('light');
  },

  async handleConfirm() {
    const role = this.data.selectedRole;
    if (!role) {
      wx.showToast({ title: '请选择你的身份', icon: 'none' });
      return;
    }

    this.setData({ confirming: true });

    try {
      // Try to update role on backend (PATCH /user/profile)
      // This may fail for new phone-only users, which is OK — use local fallback
      try {
        await app.request({
          url: '/user/profile',
          method: 'PATCH',
          data: { roleKey: role },
        });
      } catch (_) {
        // Backend may reject role change for new users — continue with local state
        console.log('[RoleSelect] Backend role update skipped, using local state');
      }

      // Update local userInfo. For phone-only new users, keep only account
      // identity fields so a dirty cache cannot carry another user's profile.
      const cachedUserInfo = wx.getStorageSync('userInfo') || {};
      const isPhoneOnly = String(cachedUserInfo.registerStage || '') === 'phone_only';
      const userInfo = isPhoneOnly
        ? {
          id: cachedUserInfo.id || '',
          uid: cachedUserInfo.uid || '',
          phone: cachedUserInfo.phone || '',
        }
        : Object.assign({}, cachedUserInfo);
      Object.assign(userInfo, {
        role: role,
        roleKey: role,
        registerStage: 'role_selected',
      });
      wx.setStorageSync('userInfo', userInfo);
      app.globalData.userInfo = userInfo;

      this.setData({ confirming: false });

      wx.showToast({
        title: role === 'boss' ? '欢迎老板' : '欢迎工人',
        icon: 'success',
        duration: 800,
      });

      setTimeout(() => {
        if (role === 'boss') {
          wx.reLaunch({ url: '/pages/base/list/list' });
        } else {
          wx.reLaunch({ url: '/pages/index/index' });
        }
      }, 800);

      // After entering the app, the auth guard or profile page will
      // detect that real-name info is incomplete and show a nudge banner.
    } catch (err) {
      this.setData({ confirming: false });
      wx.showToast({ title: '操作失败，请重试', icon: 'none' });
    }
  },

  vibrateShort(type) {
    try { wx.vibrateShort({ type }); } catch (_) {}
  },
});
