/**
 * Layer: Mini Program Cloud Config
 * Responsibility: Centralizes WeChat CloudBase environment and collection names.
 */
const CLOUD_ENV_ID = 'cloud1-7gukagm3a064dc47';
const CLOUD_ENV_ID_KEY = 'cloudEnvId';

const COLLECTIONS = {
  appConfig: 'app_config',
  feedbacks: 'feedbacks',
  notices: 'notices',
  clientLogs: 'client_logs',
  fileAssets: 'file_assets',
};

function normalizeText(value) {
  return String(value || '').trim();
}

function isPlaceholderEnvId(value) {
  return /^(your[-_ ]?)?cloud[-_ ]?env[-_ ]?id$/i.test(normalizeText(value));
}

function getSavedEnvId() {
  try {
    return normalizeText(wx.getStorageSync(CLOUD_ENV_ID_KEY));
  } catch (_) {
    return '';
  }
}

function getConfiguredEnvId() {
  const savedEnvId = getSavedEnvId();
  const envId = savedEnvId || normalizeText(CLOUD_ENV_ID);
  return isPlaceholderEnvId(envId) ? '' : envId;
}

function resolveCloudConfig() {
  const envId = getConfiguredEnvId();
  return {
    enabled: Boolean(envId),
    envId,
    traceUser: true,
    collections: COLLECTIONS,
  };
}

function setCloudEnvId(envId) {
  const normalized = normalizeText(envId);
  try {
    if (normalized) {
      wx.setStorageSync(CLOUD_ENV_ID_KEY, normalized);
    } else {
      wx.removeStorageSync(CLOUD_ENV_ID_KEY);
    }
  } catch (_) {
    // Ignore storage failures; the file-level CLOUD_ENV_ID still acts as fallback.
  }
  return resolveCloudConfig();
}

module.exports = {
  CLOUD_ENV_ID_KEY,
  collections: COLLECTIONS,
  resolveCloudConfig,
  setCloudEnvId,
};
