// app.js
App({
  onLaunch() {
    // 检查登录状态
    const token = wx.getStorageSync('token');
    const userInfo = wx.getStorageSync('userInfo');
    
    if (token && userInfo) {
      // 已登录，设置全局用户信息
      this.globalData.userInfo = userInfo;
      this.globalData.token = token;
    }
  },
  
  globalData: {
    userInfo: null,
    token: null,
    baseUrl: 'http://localhost:3001/api', // 开发环境API地址
    // baseUrl: 'https://your-domain.com/api', // 生产环境API地址
  },
  
  // 统一请求方法
  request(options) {
    return new Promise((resolve, reject) => {
      const token = wx.getStorageSync('token');
      
      wx.request({
        url: this.globalData.baseUrl + options.url,
        method: options.method || 'GET',
        data: options.data || {},
        header: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
          ...options.header,
        },
        success: (res) => {
          // 把所有 2xx 状态都当作成功（例如：POST 默认是 201）
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(res.data);
          } else if (res.statusCode === 401) {
            // token过期，清除登录信息
            wx.removeStorageSync('token');
            wx.removeStorageSync('userInfo');
            wx.reLaunch({
              url: '/pages/login/login'
            });
            reject(new Error('登录已过期，请重新登录'));
          } else {
            reject(new Error(res.data.message || '请求失败'));
          }
        },
        fail: (err) => {
          reject(err);
        }
      });
    });
  }
});
