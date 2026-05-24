/**
 * Layer: Mini Program Bootstrap
 * Responsibility: Initializes global state, shared helpers, and launch-time behavior for the WeChat mini program.
 * Notes: Keep comments focused on intent, invariants, side effects, and cross-module contracts.
 */
// app.js
const cloudDb = require('./utils/cloud-db');

const LAN_BASE_URL = '';
const DEVTOOLS_BASE_URL = '';
const PRODUCTION_BASE_URL = '';
const API_BASE_URL_KEY = 'apiBaseUrl';
const LOOPBACK_WARNING_KEY = 'loopbackBaseUrlWarned';
const PHASE1_CLOUD_FUNCTION = 'phase1Api';
const PHASE1_ROUTE_PATTERNS = [
  { method: 'POST', pattern: /^\/auth\/login$/ },
  { method: 'POST', pattern: /^\/auth\/wechat-login$/ },
  { method: 'POST', pattern: /^\/user\/register$/ },
  { method: 'POST', pattern: /^\/user\/register\/boss$/ },
  { method: 'POST', pattern: /^\/user\/register\/ocr$/ },
  { method: 'GET', pattern: /^\/user\/profile$/ },
  { method: 'PATCH', pattern: /^\/user\/profile$/ },
  { method: 'GET', pattern: /^\/base(?:\?.*)?$/ },
  { method: 'POST', pattern: /^\/base$/ },
  { method: 'GET', pattern: /^\/base\/\d+$/ },
  { method: 'PATCH', pattern: /^\/base\/\d+$/ },
  { method: 'PATCH', pattern: /^\/base\/\d+\/audit$/ },
  { method: 'GET', pattern: /^\/base\/\d+\/cooperations$/ },
  { method: 'GET', pattern: /^\/base\/\d+\/applications(?:\?.*)?$/ },
  { method: 'PATCH', pattern: /^\/base\/applications\/\d+\/review$/ },
  { method: 'POST', pattern: /^\/base\/\d+\/notices$/ },
  { method: 'GET', pattern: /^\/base\/\d+\/notices$/ },
  { method: 'GET', pattern: /^\/base\/\d+\/jobs(?:\?.*)?$/ },
  { method: 'GET', pattern: /^\/base\/jobs\/\d+$/ },
  { method: 'GET', pattern: /^\/base\/applications\/me$/ },
  { method: 'POST', pattern: /^\/attendance\/signup$/ },
  { method: 'POST', pattern: /^\/attendance\/signup\/cancel$/ },
  { method: 'POST', pattern: /^\/attendance\/checkin$/ },
  { method: 'GET', pattern: /^\/attendance\/qrcode$/ },
  { method: 'GET', pattern: /^\/attendance\/worker\/records(?:\?.*)?$/ },
  { method: 'GET', pattern: /^\/attendance\/records(?:\?.*)?$/ },
  { method: 'GET', pattern: /^\/attendance\/stats(?:\?.*)?$/ },
  { method: 'GET', pattern: /^\/attendance\/bases(?:\?.*)?$/ },
  { method: 'GET', pattern: /^\/attendance\/pending-workers(?:\?.*)?$/ },
  { method: 'GET', pattern: /^\/attendance\/export\/records(?:\?.*)?$/ },
  { method: 'GET', pattern: /^\/attendance\/export\/base-stats(?:\?.*)?$/ },
  { method: 'GET', pattern: /^\/base\/managed$/ },
  { method: 'GET', pattern: /^\/salary\/worker\/stats$/ },
  { method: 'GET', pattern: /^\/salary\/worker\/pending$/ },
  { method: 'GET', pattern: /^\/salary\/worker\/paid(?:\?.*)?$/ },
  { method: 'GET', pattern: /^\/salary\/worker\/\d+$/ },
  { method: 'POST', pattern: /^\/salary\/worker\/\d+\/confirm$/ },
  { method: 'POST', pattern: /^\/salary\/worker\/\d+\/appeal$/ },
  { method: 'GET', pattern: /^\/salary\/worker\/\d+\/payment$/ },
  { method: 'GET', pattern: /^\/salary\/list(?:\?.*)?$/ },
  { method: 'POST', pattern: /^\/salary\/draft$/ },
  { method: 'POST', pattern: /^\/salary\/calculate\/\d+$/ },
  { method: 'PATCH', pattern: /^\/salary\/\d+\/appeal$/ },
  { method: 'POST', pattern: /^\/salary\/\d+\/settle$/ },
  { method: 'GET', pattern: /^\/salary\/reports\/submitted(?:\?.*)?$/ },
  { method: 'GET', pattern: /^\/salary\/reports\/\d+$/ },
  { method: 'GET', pattern: /^\/salary\/reports\/\d+\/export$/ },
  { method: 'POST', pattern: /^\/salary\/reports\/submit$/ },
  { method: 'GET', pattern: /^\/policy\/list(?:\?.*)?$/ },
  { method: 'GET', pattern: /^\/policy\/\d+$/ },
  { method: 'POST', pattern: /^\/policy\/applications$/ },
  { method: 'GET', pattern: /^\/training\/courses(?:\?.*)?$/ },
  { method: 'GET', pattern: /^\/training\/courses\/\d+$/ },
  { method: 'POST', pattern: /^\/training\/courses\/\d+\/enroll$/ },
  { method: 'GET', pattern: /^\/rights\/consultations$/ },
  { method: 'POST', pattern: /^\/rights\/consultations$/ },
  { method: 'GET', pattern: /^\/rights\/consultations\/\d+$/ },
  { method: 'GET', pattern: /^\/user\/list(?:\?.*)?$/ },
  { method: 'GET', pattern: /^\/user\/stats$/ },
  { method: 'GET', pattern: /^\/operation-log\/list(?:\?.*)?$/ },
  { method: 'POST', pattern: /^\/worklog\/complete$/ },
  { method: 'GET', pattern: /^\/worklog\/archive(?:\?.*)?$/ },
];

function isTemporaryImageUrl(value) {
  const text = String(value || '').trim();
  if (!text) return false;
  return (
    /^https?:\/\/127\.0\.0\.1:\d+\/__tmp__\//i.test(text)
    || /^wxfile:\/\//i.test(text)
    || /^[a-zA-Z]:\\/.test(text)
    || /^file:\/\//i.test(text)
    || /^https?:\/\/bucket\.cos\.region\.myqcloud\.com\//i.test(text)
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

function getRuntimeInfo() {
  let platform = '';
  let envVersion = '';

  try {
    platform = wx.getSystemInfoSync().platform || '';
  } catch (_) {
    platform = '';
  }

  try {
    envVersion = wx.getAccountInfoSync().miniProgram.envVersion || '';
  } catch (_) {
    envVersion = '';
  }

  return { platform, envVersion };
}

function isPackagedRuntime(envVersion) {
  return envVersion === 'trial' || envVersion === 'release';
}

function isConfiguredProductionUrl(url) {
  const normalized = normalizeBaseUrl(url);
  return /^https:\/\//i.test(normalized) && !/your-domain\.com/i.test(normalized);
}

function isLocalNetworkUrl(url) {
  const normalized = normalizeBaseUrl(url);
  return /^http:\/\/(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[0-1])\.)/i.test(normalized);
}

function isCurrentLanUrl(url) {
  const currentLanUrl = normalizeBaseUrl(LAN_BASE_URL);
  if (!currentLanUrl) return false;
  return normalizeBaseUrl(url) === currentLanUrl;
}

function isAuthLoginRequest(options, method) {
  return method === 'POST' && options && options.url === '/auth/login';
}

function canRetryWithDevtoolsLoopback(baseUrl) {
  const normalized = normalizeBaseUrl(baseUrl);
  if (!normalized) return false;
  const { platform } = getRuntimeInfo();
  if (platform !== 'devtools') return false;
  return normalized !== normalizeBaseUrl(DEVTOOLS_BASE_URL);
}

function isConnectionRefusedError(error) {
  const message = String(error?.errMsg || error?.message || '').toLowerCase();
  return message.includes('connection refused') || message.includes('request:fail');
}

function shouldProxyWithCloud(baseUrl) {
  const { envVersion } = getRuntimeInfo();
  if (isPackagedRuntime(envVersion)) {
    return true;
  }
  return !normalizeBaseUrl(baseUrl);
}

function shouldUsePhase1CloudRoute(url, method) {
  const requestUrl = String(url || '').trim();
  const requestMethod = String(method || 'GET').toUpperCase();
  return PHASE1_ROUTE_PATTERNS.some((item) => item.method === requestMethod && item.pattern.test(requestUrl));
}

function callCloudFunction(name, data) {
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name,
      data,
      success: (res) => resolve(res),
      fail: (err) => reject(err),
    });
  });
}

function requestWithBaseUrl(context, options, method, token, baseUrl, hasRetried = false) {
  return new Promise((resolve, reject) => {
    if (!baseUrl) {
      reject(new Error('体验版尚未配置HTTPS后端地址。请先部署后端并在微信公众平台配置request合法域名。'));
      return;
    }

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
          context.globalData.token = null;
          context.globalData.userInfo = null;
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
        if (!hasRetried && canRetryWithDevtoolsLoopback(baseUrl) && isConnectionRefusedError(err)) {
          console.warn('[API] retry with devtools loopback:', method, options.url);
          requestWithBaseUrl(context, options, method, token, normalizeBaseUrl(DEVTOOLS_BASE_URL), true)
            .then(resolve)
            .catch(reject);
          return;
        }

        const message = err?.errMsg
          ? `${err.errMsg} (${requestUrl})`
          : `Network request failed (${requestUrl})`;
        console.error('[API] request failed:', method, requestUrl, err);
        reject(new Error(message));
      },
    });
  });
}

function resolveBaseUrl() {
  const { platform, envVersion } = getRuntimeInfo();
  const saved = normalizeBaseUrl(wx.getStorageSync(API_BASE_URL_KEY));

  if (isPackagedRuntime(envVersion)) {
    if (isConfiguredProductionUrl(PRODUCTION_BASE_URL)) {
      return PRODUCTION_BASE_URL;
    }

    if (isConfiguredProductionUrl(saved)) {
      return saved;
    }

    if (saved && isLocalNetworkUrl(saved)) {
      wx.removeStorageSync(API_BASE_URL_KEY);
    }

    return '';
  }

  if (platform === 'devtools') {
    if (saved) {
      return saved;
    }
    return DEVTOOLS_BASE_URL;
  }

  if (saved) {
    return saved;
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

    const cloudState = cloudDb.initCloud();
    this.globalData.cloud = cloudState;
    if (cloudState.initialized) {
      console.log('[CloudBase] initialized:', cloudState.envId);
    } else if (cloudState.enabled) {
      console.warn('[CloudBase] not initialized:', cloudState.reason);
    }
  },

  onShow() {
    sanitizeLocalStorageImages();
    this.globalData.userInfo = sanitizeTemporaryImageUrls(this.globalData.userInfo || null);
  },

  globalData: {
    userInfo: null,
    token: null,
    baseUrl: '',
    cloud: {
      enabled: false,
      initialized: false,
      envId: '',
      reason: 'CloudBase envId is not configured.',
    },
    envBaseUrls: {
      devtools: DEVTOOLS_BASE_URL,
      lan: LAN_BASE_URL,
      production: PRODUCTION_BASE_URL,
    },
  },

  setApiBaseUrl(nextBaseUrl) {
    const normalized = normalizeBaseUrl(nextBaseUrl);
    if (!normalized) return false;

    const { envVersion } = getRuntimeInfo();
    if (isPackagedRuntime(envVersion) && !isConfiguredProductionUrl(normalized)) {
      wx.showToast({
        title: '体验版需使用HTTPS后端地址',
        icon: 'none',
      });
      return false;
    }

    const { platform } = getRuntimeInfo();
    if (
      platform !== 'devtools'
      && isLocalNetworkUrl(normalized)
      && normalizeBaseUrl(LAN_BASE_URL)
      && !isCurrentLanUrl(normalized)
    ) {
      wx.showToast({
        title: '请使用当前Wi-Fi接口地址',
        icon: 'none',
      });
      return false;
    }

    this.globalData.baseUrl = normalized;
    wx.setStorageSync(API_BASE_URL_KEY, normalized);
    console.log('[API] baseUrl updated to', normalized);
    return true;
  },

  setCloudEnvId(envId) {
    const config = cloudDb.setCloudEnvId(envId);
    const cloudState = cloudDb.initCloud(config);
    this.globalData.cloud = cloudState;
    return cloudState;
  },

  getCloudDb() {
    return cloudDb;
  },

  resolveCloudFileUrl(fileId) {
    return new Promise((resolve) => {
      const target = String(fileId || '').trim();
      if (!target || !/^cloud:\/\//i.test(target)) {
        resolve(target);
        return;
      }

      const cloudState = this.globalData.cloud?.initialized
        ? this.globalData.cloud
        : cloudDb.initCloud();
      this.globalData.cloud = cloudState;
      if (!cloudState.initialized || !wx.cloud || typeof wx.cloud.getTempFileURL !== 'function') {
        resolve(target);
        return;
      }

      wx.cloud.getTempFileURL({
        fileList: [target],
        success: (res) => {
          const file = Array.isArray(res?.fileList) ? res.fileList[0] : null;
          resolve(file?.tempFileURL || target);
        },
        fail: () => resolve(target),
      });
    });
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
      const method = String(options.method || 'GET').toUpperCase();
      const routeToPhase1 = shouldUsePhase1CloudRoute(options.url, method);

      if (routeToPhase1) {
        const cloudState = this.globalData.cloud?.initialized
          ? this.globalData.cloud
          : cloudDb.initCloud();
        this.globalData.cloud = cloudState;

        if (!cloudState.initialized) {
          reject(new Error(cloudState.reason || '云函数登录未初始化，请检查云开发环境配置。'));
          return;
        }

        callCloudFunction(PHASE1_CLOUD_FUNCTION, {
          url: options.url,
          method,
          data: options.data || {},
          headers: {
            Authorization: token ? `Bearer ${token}` : '',
          },
          token,
        })
          .then((res) => {
            const payload = res?.result || {};
            if (payload.ok === false) {
              if (payload.statusCode === 401) {
                wx.removeStorageSync('token');
                wx.removeStorageSync('userInfo');
                this.globalData.token = null;
                this.globalData.userInfo = null;
                if (!isAuthLoginRequest(options, method)) {
                  wx.reLaunch({ url: '/pages/login/login' });
                }
              }
              const error = new Error(payload.message || '登录失败');
              error.statusCode = payload.statusCode || 500;
              error.response = payload;
              reject(error);
              return;
            }
            resolve(sanitizeTemporaryImageUrls(payload.data || payload));
          })
          .catch((err) => {
            console.error(`[CloudFunction] ${PHASE1_CLOUD_FUNCTION} failed:`, err);
            reject(new Error(err?.errMsg || '第一阶段云函数调用失败'));
          });
        return;
      }

      const baseUrl = normalizeBaseUrl(this.globalData.baseUrl || resolveBaseUrl());
      if (shouldProxyWithCloud(baseUrl)) {
        const cloudState = this.globalData.cloud?.initialized
          ? this.globalData.cloud
          : cloudDb.initCloud();
        this.globalData.cloud = cloudState;

        if (!cloudState.initialized) {
          reject(new Error(cloudState.reason || '云函数接口未初始化，请检查云开发环境配置。'));
          return;
        }

        wx.cloud.callFunction({
          name: 'apiProxy',
          data: {
            url: options.url,
            method,
            data: options.data || {},
            headers: {
              Authorization: token ? `Bearer ${token}` : '',
            },
            token,
          },
          success: (res) => {
            const payload = res?.result || {};
            if (payload.ok === false) {
              if (payload.statusCode === 401) {
                wx.removeStorageSync('token');
                wx.removeStorageSync('userInfo');
                this.globalData.token = null;
                this.globalData.userInfo = null;
                wx.reLaunch({ url: '/pages/login/login' });
              }
              const error = new Error(payload.message || '云函数接口调用失败');
              error.statusCode = payload.statusCode || 500;
              error.response = payload;
              error.data = payload.data || null;
              reject(error);
              return;
            }
            resolve(sanitizeTemporaryImageUrls(payload.data || payload));
          },
          fail: (err) => {
            console.error('[CloudFunction] apiProxy failed:', err);
            reject(new Error(err?.errMsg || '云函数接口调用失败'));
          },
        });
        return;
      }

      requestWithBaseUrl(this, options, method, token, baseUrl)
        .then(resolve)
        .catch(reject);
    });
  },

  upload(options) {
    return new Promise((resolve, reject) => {
      const token = wx.getStorageSync('token');
      const baseUrl = normalizeBaseUrl(this.globalData.baseUrl || resolveBaseUrl());
      const shouldUseCloudUpload = shouldProxyWithCloud(baseUrl);

      if (shouldUseCloudUpload) {
        const cloudState = this.globalData.cloud?.initialized
          ? this.globalData.cloud
          : cloudDb.initCloud();
        this.globalData.cloud = cloudState;

        if (!cloudState.initialized) {
          reject(new Error(cloudState.reason || '云存储未初始化，请检查云开发环境配置。'));
          return;
        }

        const filePath = String(options.filePath || '').trim();
        if (!filePath) {
          reject(new Error('上传文件路径不能为空。'));
          return;
        }

        const extMatch = filePath.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
        const ext = extMatch ? extMatch[1].toLowerCase() : 'jpg';
        const cloudPath = `base-assets/${Date.now()}_${Math.random().toString(16).slice(2)}.${ext}`;

        wx.cloud.uploadFile({
          cloudPath,
          filePath,
          success: (res) => {
            const fileId = String(res?.fileID || '').trim();
            if (!fileId) {
              reject(new Error('云存储上传成功，但未返回文件地址。'));
              return;
            }
            resolve({
              url: fileId,
              fileId,
              cloudPath,
            });
          },
          fail: (err) => {
            console.error('[CloudStorage] upload failed:', err);
            reject(new Error(err?.errMsg || '云存储上传失败'));
          },
        });
        return;
      }

      if (!baseUrl) {
        reject(new Error('请先在登录页或注册页设置手机可访问的后端地址，例如 http://你的电脑内网IP:3001/api 。'));
        return;
      }

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
