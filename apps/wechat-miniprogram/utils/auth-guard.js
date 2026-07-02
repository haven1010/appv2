/**
 * Layer: Mini Program Utility
 * Responsibility: Global authentication guard — handles auth state for the
 * new 3-phase registration flow:
 *
 *   Phase 1: Phone + SMS code → quick register & auto-login
 *   Phase 2: Role selection (boss/worker) after first login
 *   Phase 3: Real-name auth wizard inside the app
 *
 * Usage: Call `requireAuth()` at the top of each page's `onLoad`.
 *   Returns `true` if auth passes, `false` if redirected.
 *
 * Exempt pages: login, register, role-select, verify — they handle their own flow.
 */

const EXEMPT_PAGES = [
  'pages/login/login',
  'pages/register/register',
  'pages/register/role-select',
  'pages/verify/verify',
];

let storageReadFailed = false;

function safeGetStorageSync(key, fallback = '') {
  try {
    const value = wx.getStorageSync(key);
    return value === undefined ? fallback : value;
  } catch (_) {
    storageReadFailed = true;
    return fallback;
  }
}

function hasLoginSession() {
  storageReadFailed = false;
  const token = safeGetStorageSync('token', '');
  const userInfo = safeGetStorageSync('userInfo', null);
  return Boolean(token && userInfo);
}

function digits(value) {
  return String(value || '').replace(/\D/g, '');
}

function isRealNameComplete(userInfo = {}) {
  return Boolean(
    String(userInfo.name || '').trim()
    && /^\d{17}[\dX]$/i.test(String(userInfo.idCard || '').trim())
    && /^1\d{10}$/.test(digits(userInfo.phone))
    && String(userInfo.homeAddress || '').trim().length >= 5
    && Number(userInfo.infoAuditStatus || 0) !== 2
  );
}

/**
 * User just registered via SMS (phone_only) — needs to select role.
 */
function isNewPhoneUser() {
  const userInfo = safeGetStorageSync('userInfo', {}) || {};
  const stage = String(userInfo.registerStage || '').trim();
  return stage === 'phone_only';
}

/**
 * User has role selected but no real-name info yet.
 */
function needsRealNameAuth() {
  const userInfo = safeGetStorageSync('userInfo', {}) || {};
  const stage = String(userInfo.registerStage || '').trim();
  return stage !== 'phone_only' && !isNewPhoneUser() && hasLoginSession() && !isRealNameComplete(userInfo);
}

/**
 * Check auth state and redirect if needed.
 * @param {string} [pageRoute] — optional route override (defaults to current page)
 * @returns {boolean} true if auth is OK, false if redirected
 */
function requireAuth(pageRoute) {
  // Resolve current page route
  let route = pageRoute || '';
  if (!route) {
    try {
      const pages = getCurrentPages();
      const currentPage = pages[pages.length - 1];
      route = currentPage ? currentPage.route : '';
    } catch (_) {
      return true;
    }
  }

  // Skip auth check for exempt pages
  if (EXEMPT_PAGES.includes(route)) return true;

  // Not logged in → redirect to login
  if (!hasLoginSession()) {
    if (storageReadFailed) return true;
    wx.reLaunch({ url: '/pages/login/login' });
    return false;
  }

  // First-time phone user (just registered via SMS) → role selection
  if (isNewPhoneUser()) {
    wx.reLaunch({ url: '/pages/register/role-select' });
    return false;
  }

  return true;
}

module.exports = { requireAuth, needsRealNameAuth, isNewPhoneUser, hasLoginSession };
