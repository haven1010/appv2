// pages/login/login.js
const app = getApp();

Page({
  data: {
    phone: '',
    idCardLast6: '',
    loading: false,
    error: '',
  },

  onInputPhone(e) {
    this.setData({ phone: e.detail.value });
  },

  onInputIdCard(e) {
    this.setData({ idCardLast6: e.detail.value });
  },

  async handleLogin() {
    const { phone, idCardLast6 } = this.data;
    
    if (!phone || !idCardLast6) {
      this.setData({ error: '请填写手机号和身份证后6位' });
      return;
    }

    if (idCardLast6.length !== 6) {
      this.setData({ error: '身份证后6位必须是6位数字' });
      return;
    }

    this.setData({ loading: true, error: '' });

    try {
      const res = await app.request({
        url: '/auth/login',
        method: 'POST',
        data: {
          phone,
          idCardLast6,
        },
      });

      // 保存登录信息
      wx.setStorageSync('token', res.access_token);
      wx.setStorageSync('userInfo', res.user);
      
      app.globalData.token = res.access_token;
      app.globalData.userInfo = res.user;

      wx.showToast({
        title: '登录成功',
        icon: 'success',
      });

      // 根据角色跳转不同首页
      const role = res.user && res.user.role;
      setTimeout(() => {
        if (role === 'field_manager') {
          wx.switchTab({
            url: '/pages/field/home/home'
          });
        } else {
          wx.switchTab({
            url: '/pages/index/index'
          });
        }
      }, 1500);

    } catch (err) {
      this.setData({ 
        error: err.message || '登录失败，请检查手机号和身份证后6位',
        loading: false 
      });
    }
  },

  goToRegister() {
    wx.navigateTo({
      url: '/pages/register/register'
    });
  },
});
