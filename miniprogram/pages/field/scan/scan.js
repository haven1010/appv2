// pages/field/scan/scan.js
const app = getApp();

Page({
  data: {
    baseId: null,
    baseName: '',
    scanResult: null,     // { success, name, message, time }
    scanning: false,
    manualInput: '',
    loading: false,
    history: [],          // 本次会话的扫码记录
  },

  onLoad() {
    this.resolveBaseId();
  },

  onShow() {
    const tabBar = this.getTabBar && this.getTabBar();
    if (tabBar) {
      tabBar.setData({ selected: 1 });
    }
  },

  async resolveBaseId() {
    const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo');
    if (userInfo && userInfo.assignedBaseId) {
      this.setData({ baseId: userInfo.assignedBaseId });
      this.loadBaseName(userInfo.assignedBaseId);
      return;
    }
    try {
      const profile = await app.request({ url: '/user/profile', method: 'GET' });
      if (profile && profile.assignedBaseId) {
        this.setData({ baseId: profile.assignedBaseId });
        this.loadBaseName(profile.assignedBaseId);
      }
    } catch (e) {
      console.warn('获取基地ID失败:', e);
    }
  },

  async loadBaseName(baseId) {
    try {
      const base = await app.request({ url: '/base/' + baseId, method: 'GET' });
      if (base && (base.baseName || base.name)) {
        this.setData({ baseName: base.baseName || base.name });
      }
    } catch (e) {
      // 忽略
    }
  },

  // 启动摄像头扫码
  startScan() {
    if (this.data.scanning) return;
    this.setData({ scanning: true, scanResult: null });

    wx.scanCode({
      onlyFromCamera: false,
      scanType: ['qrCode', 'barCode'],
      success: (res) => {
        console.log('扫码结果:', res);
        const qrContent = res.result;
        if (qrContent) {
          this.doCheckin(qrContent);
        } else {
          this.setData({
            scanning: false,
            scanResult: { success: false, message: '未获取到二维码内容' },
          });
        }
      },
      fail: (err) => {
        console.warn('扫码取消或失败:', err);
        this.setData({
          scanning: false,
          scanResult: null,
        });
      },
      complete: () => {
        this.setData({ scanning: false });
      },
    });
  },

  // 手动输入二维码内容
  onManualInput(e) {
    this.setData({ manualInput: e.detail.value });
  },

  submitManual() {
    const content = this.data.manualInput.trim();
    if (!content) {
      wx.showToast({ title: '请输入二维码内容', icon: 'none' });
      return;
    }
    this.doCheckin(content);
  },

  // 调用签到 API
  async doCheckin(qrContent) {
    if (!this.data.baseId) {
      this.setData({
        scanResult: {
          success: false,
          message: '未绑定基地，无法签到。请先在Web后台绑定基地。',
        },
      });
      return;
    }

    this.setData({ loading: true, scanResult: null });

    try {
      const res = await app.request({
        url: '/attendance/checkin',
        method: 'POST',
        data: {
          qrContent: qrContent,
          baseId: this.data.baseId,
        },
      });

      const now = new Date();
      const timeStr = now.getHours().toString().padStart(2, '0') + ':' +
                      now.getMinutes().toString().padStart(2, '0') + ':' +
                      now.getSeconds().toString().padStart(2, '0');

      const result = {
        success: true,
        name: (res && res.user && res.user.name) || (res && res.userName) || '工人',
        message: (res && res.message) || '签到成功',
        time: timeStr,
      };

      // 加入历史记录
      var history = [result].concat(this.data.history || []).slice(0, 20);

      this.setData({
        loading: false,
        scanResult: result,
        history,
        manualInput: '',
      });

      wx.vibrateShort({ type: 'heavy' });

    } catch (err) {
      const result = {
        success: false,
        message: err.message || '签到失败，请检查二维码',
        name: '',
        time: '',
      };

      this.setData({
        loading: false,
        scanResult: result,
      });

      wx.vibrateShort({ type: 'heavy' });
    }
  },

  clearResult() {
    this.setData({ scanResult: null });
  },
});
