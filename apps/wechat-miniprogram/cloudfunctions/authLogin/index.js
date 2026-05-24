const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');

const CURRENT_ENCRYPTION_VERSION = 'v2';
const LEGACY_DEFAULT_AES_KEY = 'CaiZhiTong2025AES32ByteKey123456';
const LEGACY_DEFAULT_AES_IV = '0123456789012345';
const ALGORITHM = 'aes-256-cbc';

let pool;

function normalizeKey(input) {
  const raw = Buffer.from(String(input || ''), 'utf8');
  if (raw.length === 32) return raw;
  if (raw.length < 32) return crypto.createHash('sha256').update(raw).digest();
  return raw.subarray(0, 32);
}

function normalizeIv(input) {
  const raw = Buffer.from(String(input || ''), 'utf8');
  if (raw.length === 16) return raw;
  if (raw.length < 16) return crypto.createHash('md5').update(raw).digest();
  return raw.subarray(0, 16);
}

function hashSensitiveValue(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function getLegacySecrets() {
  const currentKey = process.env.AES_KEY;
  const currentIv = process.env.AES_IV;
  const secrets = [];

  if (currentKey) {
    secrets.push({
      key: normalizeKey(currentKey),
      iv: normalizeIv(currentIv || LEGACY_DEFAULT_AES_IV),
    });
  }

  if (currentKey !== LEGACY_DEFAULT_AES_KEY || currentIv !== LEGACY_DEFAULT_AES_IV) {
    secrets.push({
      key: normalizeKey(LEGACY_DEFAULT_AES_KEY),
      iv: normalizeIv(LEGACY_DEFAULT_AES_IV),
    });
  }

  return secrets;
}

function decryptSensitiveValue(ciphertext) {
  const value = String(ciphertext || '');
  if (!value) return value;

  if (value.startsWith(`${CURRENT_ENCRYPTION_VERSION}:`)) {
    const [, ivHex, encryptedHex] = value.split(':');
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      normalizeKey(process.env.AES_KEY),
      Buffer.from(ivHex, 'hex'),
    );
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  for (const secret of getLegacySecrets()) {
    try {
      const decipher = crypto.createDecipheriv(ALGORITHM, secret.key, secret.iv);
      let decrypted = decipher.update(value, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (_) {
      // Try next legacy secret.
    }
  }

  return value;
}

function getRequiredEnv(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`Missing cloud function env: ${name}`);
  return value;
}

function getPool() {
  if (pool) return pool;
  pool = mysql.createPool({
    host: getRequiredEnv('DB_HOST'),
    port: Number(getRequiredEnv('DB_PORT')),
    user: getRequiredEnv('DB_USERNAME'),
    password: getRequiredEnv('DB_PASSWORD'),
    database: getRequiredEnv('DB_DATABASE'),
    waitForConnections: true,
    connectionLimit: 2,
    charset: 'utf8mb4',
  });
  return pool;
}

function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 11);
}

function normalizeIdCardLast6(value) {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, '').slice(-6);
}

function ok(data) {
  return { ok: true, data };
}

function fail(statusCode, message) {
  return { ok: false, statusCode, message };
}

async function handleWechatLogin(event) {
  let openid = null;
  try {
    const cloud = require('wx-server-sdk');
    cloud.init();
    const wxContext = cloud.getWXContext();
    if (wxContext && wxContext.OPENID) openid = wxContext.OPENID;
  } catch (_) {}

  if (!openid) openid = event._openid || event.openid || null;
  if (!openid) return fail(401, '无法获取微信身份，请重新尝试');

  const [existing] = await getPool().execute(
    `SELECT id, uid, name, role_key, face_img_url, assigned_base_id FROM sys_user WHERE openid = ? AND is_deleted = 0 LIMIT 1`,
    [openid],
  );

  let user = existing[0];
  let isNewUser = false;

  if (!user) {
    const uid = 'wx_' + crypto.randomBytes(8).toString('hex');
    await getPool().execute(
      `INSERT INTO sys_user (uid, openid, name, role_key, is_deleted, created_at, updated_at) VALUES (?, ?, '', 'worker', 0, NOW(), NOW())`,
      [uid, openid],
    );
    const [inserted] = await getPool().execute(
      `SELECT id, uid, name, role_key, face_img_url, assigned_base_id FROM sys_user WHERE uid = ? LIMIT 1`,
      [uid],
    );
    user = inserted[0];
    isNewUser = true;
  }

  const registerStage = (!user.name || isNewUser) ? 'wechat_only' : 'complete';

  const payload = {
    username: user.name || '',
    sub: user.id,
    role: user.role_key,
    uid: user.uid,
  };

  const accessToken = jwt.sign(payload, getRequiredEnv('JWT_SECRET'), {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

  return ok({
    access_token: accessToken,
    user: {
      id: user.id,
      name: user.name || '',
      role: user.role_key,
      roleKey: user.role_key,
      uid: user.uid,
      faceImgUrl: user.face_img_url || '',
      assignedBaseId: user.assigned_base_id || null,
    },
    registerStage,
    isNewUser,
  });
}

async function handleGetPhone(event) {
  const appId = 'wxbbc7edf7ce254861';
  const appSecret = process.env.WECHAT_APP_SECRET;

  if (!appSecret) {
    return fail(500, 'WECHAT_APP_SECRET 未配置，请在云函数环境变量中设置');
  }

  const sessionData = await new Promise((resolve, reject) => {
    const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${appId}&secret=${appSecret}&js_code=${event.code}&grant_type=authorization_code`;
    const req = https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
  });

  if (!sessionData.session_key) {
    return fail(401, '获取 session_key 失败: ' + (sessionData.errmsg || '未知错误'));
  }

  try {
    const sessionKey = Buffer.from(sessionData.session_key, 'base64');
    const encryptedData = Buffer.from(event.encryptedData, 'base64');
    const iv = Buffer.from(event.iv, 'base64');

    const decipher = crypto.createDecipheriv('aes-128-cbc', sessionKey, iv);
    decipher.setAutoPadding(true);
    let decoded = decipher.update(encryptedData, null, 'utf8');
    decoded += decipher.final('utf8');

    const phoneInfo = JSON.parse(decoded);
    return ok({ phone: phoneInfo.purePhoneNumber });
  } catch (err) {
    return fail(500, '解密手机号失败: ' + err.message);
  }
}

const https = require('https');

exports.main = async (event) => {
  const action = event.action || 'password_login';

  if (action === 'wechat_login') {
    return handleWechatLogin(event);
  }

  if (action === 'get_phone') {
    return handleGetPhone(event);
  }

  const phone = normalizePhone(event.phone);
  const idCardLast6 = normalizeIdCardLast6(event.idCardLast6);

  if (phone.length !== 11 || idCardLast6.length !== 6) {
    return fail(401, '请提供正确的手机号和身份证后6位');
  }

  const [rows] = await getPool().execute(
    `SELECT id, uid, name, role_key, face_img_url, assigned_base_id, id_card_enc
     FROM sys_user
     WHERE phone_hash = ? AND is_deleted = 0
     LIMIT 1`,
    [hashSensitiveValue(phone)],
  );

  const user = rows[0];
  if (!user) {
    return fail(401, '凭证无效，请检查手机号或密码是否正确。');
  }

  const idCard = decryptSensitiveValue(user.id_card_enc);
  if (!idCard || !idCard.endsWith(idCardLast6)) {
    return fail(401, '凭证无效，请检查手机号或密码是否正确。');
  }

  const payload = {
    username: user.name,
    sub: user.id,
    role: user.role_key,
    uid: user.uid,
  };

  const accessToken = jwt.sign(payload, getRequiredEnv('JWT_SECRET'), {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

  return ok({
    access_token: accessToken,
    user: {
      id: user.id,
      name: user.name,
      role: user.role_key,
      roleKey: user.role_key,
      uid: user.uid,
      faceImgUrl: user.face_img_url || '',
      assignedBaseId: user.assigned_base_id || null,
    },
  });
};
