/**
 * Layer: Mini Program Page
 * Responsibility: Implements scan check-in flow for field manager.
 */
const app = getApp();

function normalizeArray(res) {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.list)) return res.list;
  if (Array.isArray(res?.bases)) return res.bases;
  return [];
}

Page({
  data: {
    baseId: null,
    baseName: '',
    managedBases: [],
    baseIndex: 0,
    scanResult: null, // { success, name, message, time }
    scanning: false,
    manualInput: '',
    loading: false,
    history: [], // 当前会话扫码记录
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
    const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo') || {};
    let bases = normalizeArray(await app.request({ url: '/base/managed', method: 'GET' }).catch(() => []))
      .map((item) => ({
        id: Number(item.id),
        baseName: item.baseName || item.name || `基地 #${item.id}`,
      }));

    if (!bases.length && userInfo.assignedBaseId) {
      bases = [{ id: Number(userInfo.assignedBaseId), baseName: `基地 #${userInfo.assignedBaseId}` }];
    }

    if (!bases.length) {
      this.setData({
        managedBases: [],
        baseIndex: 0,
        baseId: null,
        baseName: '',
      });
      return;
    }

    const preferredId = Number(wx.getStorageSync('fieldActiveBaseId') || userInfo.assignedBaseId || 0);
    let index = preferredId ? bases.findIndex((item) => Number(item.id) === preferredId) : 0;
    if (index < 0) index = 0;

    const selected = bases[index] || bases[0];
    wx.setStorageSync('fieldActiveBaseId', Number(selected.id));
    this.setData({
      managedBases: bases,
      baseIndex: index,
      baseId: Number(selected.id),
      baseName: selected.baseName,
    });
    this.loadBaseName(selected.id);
  },

  async loadBaseName(baseId) {
    try {
      const base = await app.request({ url: '/base/' + baseId, method: 'GET' });
      if (base && (base.baseName || base.name)) {
        this.setData({ baseName: base.baseName || base.name });
      }
    } catch (_) {
      // 忽略名称查询失败
    }
  },

  startScan() {
    if (this.data.scanning) return;

    this.setData({
      scanning: true,
      scanResult: null,
    });

    wx.scanCode({
      onlyFromCamera: false,
      scanType: ['qrCode', 'barCode'],
      success: (res) => {
        const qrContent = res.result;
        if (qrContent) {
          this.doCheckin(qrContent);
          return;
        }

        this.setData({
          scanning: false,
          scanResult: {
            success: false,
            message: '未获取到二维码内容',
          },
        });
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

  onManualInput(e) {
    this.setData({ manualInput: e.detail.value || '' });
  },

  submitManual() {
    const content = String(this.data.manualInput || '').trim();
    if (!content) {
      wx.showToast({ title: '请输入二维码内容', icon: 'none' });
      return;
    }
    this.doCheckin(content);
  },

  async doCheckin(qrContent) {
    if (!this.data.baseId) {
      this.setData({
        scanResult: {
          success: false,
          message: '未绑定基地，无法签到。请先在后台绑定基地。',
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
          qrContent,
          baseId: this.data.baseId,
        },
      });

      const now = new Date();
      const timeStr =
        now.getHours().toString().padStart(2, '0') +
        ':' +
        now.getMinutes().toString().padStart(2, '0') +
        ':' +
        now.getSeconds().toString().padStart(2, '0');

      const result = {
        success: true,
        name: (res && res.user && res.user.name) || res?.workerName || '工人',
        message: res?.message || '签到成功',
        time: timeStr,
      };

      const history = [result].concat(this.data.history || []).slice(0, 20);

      this.setData({
        loading: false,
        scanResult: result,
        history,
        manualInput: '',
      });

      wx.vibrateShort({ type: 'heavy' });
    } catch (err) {
      this.setData({
        loading: false,
        scanResult: {
          success: false,
          message: err?.message || '签到失败，请检查二维码',
          name: '',
          time: '',
        },
      });

      wx.vibrateShort({ type: 'heavy' });
    }
  },

  clearResult() {
    this.setData({ scanResult: null });
  },

  onBaseChange(e) {
    const index = Number(e.detail.value);
    const picked = this.data.managedBases[index];
    if (!picked) return;

    wx.setStorageSync('fieldActiveBaseId', Number(picked.id));
    this.setData({
      baseIndex: index,
      baseId: Number(picked.id),
      baseName: picked.baseName,
      scanResult: null,
    });
    this.loadBaseName(picked.id);
  },
});
