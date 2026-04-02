/**
 * Layer: Mini Program Bootstrap
 * Responsibility: Initializes global state, shared helpers, and launch-time behavior for the WeChat mini program.
 * Notes: Keep comments focused on intent, invariants, side effects, and cross-module contracts.
 */
// app.js
const DEVTOOLS_BASE_URL = 'http://127.0.0.1:3001/api';
const LAN_BASE_URL = 'http://10.31.199.229:3001/api';
const PRODUCTION_BASE_URL = 'https://your-domain.com/api';
const API_BASE_URL_KEY = 'apiBaseUrl';
const LOOPBACK_WARNING_KEY = 'loopbackBaseUrlWarned';

function isTemporaryImageUrl(value) {
  const text = String(value || '').trim();
  if (!text) return false;
  return (
    /^https?:\/\/127\.0\.0\.1:\d+\/__tmp__\//i.test(text)
    || /^wxfile:\/\//i.test(text)
    || /^[a-zA-Z]:\\/.test(text)
    || /^file:\/\//i.test(text)
  );
}

function sanitizeTemporaryImageUrls(target, visited = new Set()) {
  if (typeof target === 'string') {
    return isTemporaryImageUrl(target) ? '' : target;
  }

  if (!target || typeof target !== 'object') return target;
  if (visited.has(target)) return target;
  visited.add(target);

  if (Array.isArray(target)) {
    for (let i = 0; i < target.length; i += 1) {
      target[i] = sanitizeTemporaryImageUrls(target[i], visited);
    }
    return target;
  }

  const keys = Object.keys(target);
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    target[key] = sanitizeTemporaryImageUrls(target[key], visited);
  }
  return target;
}

function safeSerialize(value) {
  try {
    return JSON.stringify(value);
  } catch (_) {
    return '';
  }
}

function sanitizeStorageEntry(key) {
  const raw = wx.getStorageSync(key);
  if (raw === undefined) return;
  const before = safeSerialize(raw);
  const cleaned = sanitizeTemporaryImageUrls(raw);
  const after = safeSerialize(cleaned);
  if (before !== after) {
    wx.setStorageSync(key, cleaned);
  }
}

function sanitizeLocalStorageImages() {
  try {
    const info = wx.getStorageInfoSync();
    const keys = Array.isArray(info?.keys) ? info.keys : [];
    for (let i = 0; i < keys.length; i += 1) {
      sanitizeStorageEntry(keys[i]);
    }
  } catch (_) {
    // Ignore storage clean failures and continue bootstrap.
  }
}

function normalizeBaseUrl(url) {
  return String(url || '').trim().replace(/\/+$/, '');
}

function resolveBaseUrl() {
  const saved = normalizeBaseUrl(wx.getStorageSync(API_BASE_URL_KEY));
  if (saved) return saved;

  try {
    const { platform } = wx.getSystemInfoSync();
    if (platform === 'devtools') {
      return DEVTOOLS_BASE_URL;
    }
  } catch (_) {
    // Ignore and fallback to LAN URL.
  }

  return LAN_BASE_URL;
}

App({
  onLaunch() {
    sanitizeLocalStorageImages();

    const token = wx.getStorageSync('token');
    const userInfo = sanitizeTemporaryImageUrls(wx.getStorageSync('userInfo'));
    if (userInfo) wx.setStorageSync('userInfo', userInfo);

    if (token && userInfo) {
      this.globalData.userInfo = userInfo;
      this.globalData.token = token;
    }

    const resolvedBaseUrl = resolveBaseUrl();
    this.globalData.baseUrl = resolvedBaseUrl;
    console.log('[API] baseUrl =', resolvedBaseUrl);
    this.warnIfLoopbackOnRealDevice(resolvedBaseUrl);
  },

  onShow() {
    sanitizeLocalStorageImages();
    this.globalData.userInfo = sanitizeTemporaryImageUrls(this.globalData.userInfo || null);
  },

  globalData: {
    userInfo: null,
    token: null,
    baseUrl: '',
    envBaseUrls: {
      devtools: DEVTOOLS_BASE_URL,
      lan: LAN_BASE_URL,
      production: PRODUCTION_BASE_URL,
    },
  },

  setApiBaseUrl(nextBaseUrl) {
    const normalized = normalizeBaseUrl(nextBaseUrl);
    if (!normalized) return;

    this.globalData.baseUrl = normalized;
    wx.setStorageSync(API_BASE_URL_KEY, normalized);
    console.log('[API] baseUrl updated to', normalized);
  },

  getCurrentUser() {
    return this.globalData.userInfo || wx.getStorageSync('userInfo') || null;
  },

  getCurrentRole() {
    const user = this.getCurrentUser();
    return user?.role || user?.roleKey || 'worker';
  },

  isAdminRole(role) {
    const roleValue = role || this.getCurrentRole();
    return ['super_admin', 'region_admin', 'base_manager', 'field_manager'].includes(roleValue);
  },

  isSuperAdminRole(role) {
    const roleValue = role || this.getCurrentRole();
    return ['super_admin', 'region_admin'].includes(roleValue);
  },

  warnIfLoopbackOnRealDevice(baseUrl) {
    const warned = wx.getStorageSync(LOOPBACK_WARNING_KEY);
    if (warned) return;

    let platform = '';
    try {
      platform = wx.getSystemInfoSync().platform;
    } catch (_) {
      platform = '';
    }

    if (platform === 'devtools') return;
    if (!/(127\.0\.0\.1|localhost)/i.test(baseUrl)) return;

    wx.setStorageSync(LOOPBACK_WARNING_KEY, true);
    wx.showModal({
      title: 'Network Setup Notice',
      content: 'Current API uses localhost/127.0.0.1. Real devices cannot access your computer backend via loopback.',
      showCancel: false,
    });
  },

  // Unified request helper
  request(options) {
    return new Promise((resolve, reject) => {
      const token = wx.getStorageSync('token');
      const method = options.method || 'GET';
      const baseUrl = normalizeBaseUrl(this.globalData.baseUrl || resolveBaseUrl());
      const requestUrl = `${baseUrl}${options.url}`;

      wx.request({
        url: requestUrl,
        method,
        data: options.data || {},
        timeout: options.timeout || 15000,
        header: Object.assign(
          {
            'Content-Type': 'application/json',
            Authorization: token ? `Bearer ${token}` : '',
          },
          options.header || {},
        ),
        success: (res) => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(sanitizeTemporaryImageUrls(res.data));
            return;
          }

          if (res.statusCode === 401) {
            wx.removeStorageSync('token');
            wx.removeStorageSync('userInfo');
            this.globalData.token = null;
            this.globalData.userInfo = null;
            wx.reLaunch({ url: '/pages/login/login' });
            reject(new Error('Login expired, please sign in again.'));
            return;
          }

          const serverMessage = Array.isArray(res.data?.message)
            ? res.data.message.join(' / ')
            : res.data?.message || res.data?.msg;
          const message = serverMessage || `Request failed (HTTP ${res.statusCode})`;
          const error = new Error(message);
          error.statusCode = res.statusCode;
          error.response = res.data;
          reject(error);
        },
        fail: (err) => {
          const message = err?.errMsg
            ? `${err.errMsg} (${requestUrl})`
            : `Network request failed (${requestUrl})`;
          console.error('[API] request failed:', method, requestUrl, err);
          reject(new Error(message));
        },
      });
    });
  },

  upload(options) {
    return new Promise((resolve, reject) => {
      const token = wx.getStorageSync('token');
      const baseUrl = normalizeBaseUrl(this.globalData.baseUrl || resolveBaseUrl());
      const requestUrl = `${baseUrl}${options.url}`;

      wx.uploadFile({
        url: requestUrl,
        filePath: options.filePath,
        name: options.name || 'file',
        formData: options.formData || {},
        timeout: options.timeout || 20000,
        header: Object.assign(
          {
            Authorization: token ? `Bearer ${token}` : '',
          },
          options.header || {},
        ),
        success: (res) => {
          let payload = res.data;
          if (typeof payload === 'string') {
            try {
              payload = JSON.parse(payload);
            } catch (_) {
              // Keep raw string payload.
            }
          }

          payload = sanitizeTemporaryImageUrls(payload);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(payload);
            return;
          }

          if (res.statusCode === 401) {
            wx.removeStorageSync('token');
            wx.removeStorageSync('userInfo');
            this.globalData.token = null;
            this.globalData.userInfo = null;
            wx.reLaunch({ url: '/pages/login/login' });
            reject(new Error('Login expired, please sign in again.'));
            return;
          }

          const message = Array.isArray(payload?.message)
            ? payload.message.join(' / ')
            : payload?.message || payload?.msg || `Upload failed (HTTP ${res.statusCode})`;
          reject(new Error(message));
        },
        fail: (err) => {
          reject(new Error(err?.errMsg || 'Upload failed'));
        },
      });
    });
  },

  saveBase64File(options = {}) {
    return new Promise((resolve, reject) => {
      const base64Data = String(options.base64 || '').trim();
      const fallbackName = `导出文件-${Date.now()}.xlsx`;
      let fileName = String(options.fileName || fallbackName).trim() || fallbackName;
      if (!/\.xlsx$/i.test(fileName)) {
        fileName = `${fileName}.xlsx`;
      }
      fileName = fileName.replace(/[\\/:*?"<>|]/g, '_');

      if (!base64Data) {
        reject(new Error('Export file content is empty.'));
        return;
      }

      const filePath = `${wx.env.USER_DATA_PATH}/${fileName}`;
      const fs = wx.getFileSystemManager();
      fs.writeFile({
        filePath,
        data: base64Data,
        encoding: 'base64',
        success: () => {
          wx.openDocument({
            filePath,
            fileType: 'xlsx',
            showMenu: true,
            success: () => resolve({ filePath, fileName }),
            fail: () => resolve({ filePath, fileName }),
          });
        },
        fail: (err) => {
          reject(new Error(err?.errMsg || 'Write file failed'));
        },
      });
    });
  },

  async exportXlsx(options = {}) {
    const payload = await this.request({
      url: options.url,
      method: options.method || 'GET',
      data: options.data || {},
    });

    const fileBase64 = String(payload?.fileBase64 || '').trim();
    const fileName = payload?.fileName || options.fileName || `导出文件-${Date.now()}.xlsx`;
    if (!fileBase64) {
      throw new Error('Server did not return xlsx content.');
    }
    return this.saveBase64File({ base64: fileBase64, fileName });
  },
});
