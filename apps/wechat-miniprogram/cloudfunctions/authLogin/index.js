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

exports.main = async (event) => {
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
