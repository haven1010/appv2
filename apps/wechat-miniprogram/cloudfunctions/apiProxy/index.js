const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');
const QRCode = require('qrcode');

const CURRENT_ENCRYPTION_VERSION = 'v2';
const LEGACY_DEFAULT_AES_KEY = 'CaiZhiTong2025AES32ByteKey123456';
const LEGACY_DEFAULT_AES_IV = '0123456789012345';
const ALGORITHM = 'aes-256-cbc';
const SIGNUP_STATUS = {
  SIGNED_UP: 0,
  CHECKED_IN: 1,
  ABSENT: 2,
  CANCELLED: 3,
};
const APPLICATION_STATUS = {
  PENDING: 0,
  APPROVED: 1,
  REJECTED: 2,
  CANCELLED: 3,
};

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

function getRequiredEncryptionKey() {
  return normalizeKey(getRequiredEnv('AES_KEY'));
}

function encryptSensitiveValue(plaintext) {
  const text = String(plaintext || '').trim();
  if (!text) return null;

  const key = getRequiredEncryptionKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${CURRENT_ENCRYPTION_VERSION}:${iv.toString('hex')}:${encrypted}`;
}

function hashSensitiveValue(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  return crypto.createHash('sha256').update(text).digest('hex');
}

function createHttpError(statusCode, message, data) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.data = data || null;
  return error;
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

function ok(data) {
  return { ok: true, data };
}

function fail(statusCode, message, data) {
  return { ok: false, statusCode, message, data: data || null };
}

function toCamelKey(key) {
  return String(key).replace(/_([a-z])/g, (_, char) => char.toUpperCase());
}

function toCamelRow(row) {
  const next = {};
  Object.keys(row || {}).forEach((key) => {
    next[toCamelKey(key)] = row[key];
  });
  return next;
}

function toCamelRows(rows) {
  return (rows || []).map(toCamelRow);
}

function parseQuery(url) {
  const [pathname, queryString = ''] = String(url || '').split('?');
  const query = {};
  queryString.split('&').filter(Boolean).forEach((part) => {
    const [rawKey, rawValue = ''] = part.split('=');
    query[decodeURIComponent(rawKey)] = decodeURIComponent(rawValue.replace(/\+/g, ' '));
  });
  return { pathname: pathname.replace(/\/+$/, '') || '/', query };
}

function safeParseJson(value) {
  if (!value || typeof value !== 'string') return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_) {
    return {};
  }
}

function safeStringifyJson(value) {
  try {
    return JSON.stringify(value);
  } catch (_) {
    return '{}';
  }
}

function normalizeMethod(method) {
  return String(method || 'GET').toUpperCase();
}

function normalizeDateString(value) {
  if (!value) return '';
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '';
    return value.toISOString().slice(0, 10);
  }

  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function hasOwn(source, key) {
  return Object.prototype.hasOwnProperty.call(source || {}, key);
}

function normalizeNullableText(value, maxLen = 0) {
  const text = String(value || '').trim();
  if (!text) return null;
  if (!maxLen || text.length <= maxLen) return text;
  return text.slice(0, maxLen);
}

function normalizePhoneForUpdate(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits || null;
}

function normalizeBankCardNo(value) {
  const cleaned = String(value || '').replace(/\s+/g, '');
  return cleaned || null;
}

function isEnabledFlag(value) {
  return value === true || Number(value) === 1;
}

function parseWorkHoursRange(workHours) {
  const text = String(workHours || '').trim();
  if (!text) return null;
  const match = text.match(/^(\d{1,2}):(\d{1,2})\s*[-~]\s*(\d{1,2}):(\d{1,2})$/);
  if (!match) return null;

  const startHour = Number(match[1]);
  const startMinute = Number(match[2]);
  const endHour = Number(match[3]);
  const endMinute = Number(match[4]);
  if (
    startHour > 23
    || endHour > 23
    || startMinute > 59
    || endMinute > 59
  ) {
    return null;
  }

  let start = startHour * 60 + startMinute;
  let end = endHour * 60 + endMinute;
  if (end <= start) end += 24 * 60;
  return { start, end };
}

function hasTimeOverlap(leftWorkHours, rightWorkHours) {
  const left = parseWorkHoursRange(leftWorkHours);
  const right = parseWorkHoursRange(rightWorkHours);
  if (!left || !right) return true;
  return left.start < right.end && right.start < left.end;
}

function isWorkDateWithinJobWindow(job, workDate) {
  const target = normalizeDateString(workDate);
  if (!target) return false;
  const start = normalizeDateString(job.workStartDate);
  const end = normalizeDateString(job.workEndDate);
  if (start && target < start) return false;
  if (end && target > end) return false;
  return true;
}

function buildConflictError(conflictRow) {
  const baseName = conflictRow.baseName || '未知基地';
  const jobTitle = conflictRow.jobTitle || '未知岗位';
  const message = `您已报名【${baseName} / ${jobTitle}】，时间冲突。如需报名此工作，请先取消原报名。`;
  const error = new Error(message);
  error.statusCode = 409;
  error.data = {
    conflictBaseId: Number(conflictRow.baseId) || 0,
    conflictBaseName: baseName,
    conflictJobId: Number(conflictRow.jobId) || 0,
    conflictJobTitle: jobTitle,
    conflictWorkDate: normalizeDateString(conflictRow.workDate),
    conflictWorkHours: conflictRow.workHours || '',
  };
  return error;
}

function getBearerToken(headers = {}) {
  const header = headers.Authorization || headers.authorization || '';
  const match = String(header).match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : '';
}

async function getCurrentUser(event) {
  const token = event.token || getBearerToken(event.headers || {});
  if (!token) throw Object.assign(new Error('Login expired, please sign in again.'), { statusCode: 401 });

  const payload = jwt.verify(token, getRequiredEnv('JWT_SECRET'));
  const [rows] = await getPool().execute(
    `SELECT id, uid, name, role_key, face_img_url, assigned_base_id, phone_enc, id_card_enc,
            home_address_enc, bank_name, bank_card_no_enc, info_audit_status, created_at, updated_at
       FROM sys_user
      WHERE id = ? AND is_deleted = 0
      LIMIT 1`,
    [payload.sub],
  );

  if (!rows[0]) throw Object.assign(new Error('Login expired, please sign in again.'), { statusCode: 401 });
  return toCamelRow(rows[0]);
}

function publicUser(user) {
  return {
    id: user.id,
    uid: user.uid,
    name: user.name,
    role: user.roleKey,
    roleKey: user.roleKey,
    faceImgUrl: user.faceImgUrl || '',
    assignedBaseId: user.assignedBaseId || null,
    gender: user.gender || '',
    isPoorHousehold: user.isPoorHousehold ?? null,
    phone: decryptSensitiveValue(user.phoneEnc),
    idCard: decryptSensitiveValue(user.idCardEnc),
    homeAddress: decryptSensitiveValue(user.homeAddressEnc),
    bankName: user.bankName || '',
    bankCardNo: decryptSensitiveValue(user.bankCardNoEnc),
    infoAuditStatus: user.infoAuditStatus,
    registerMode: user.registerMode || 'self',
    accountOwnerVerified: user.accountOwnerVerified ?? true,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

async function getProfile(user) {
  return publicUser(user);
}

async function updateProfile(user, data) {
  const payload = data && typeof data === 'object' ? data : {};
  const touchableKeys = [
    'name',
    'phone',
    'homeAddress',
    'emergencyContact',
    'emergencyPhone',
    'bankName',
    'bankCardNo',
    'faceImgUrl',
  ];

  const hasAnyChange = touchableKeys.some((key) => hasOwn(payload, key));
  if (!hasAnyChange) {
    return getProfile(user);
  }

  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();

    const [rows] = await connection.execute(
      `SELECT id, uid, name, role_key, face_img_url, assigned_base_id, phone_enc, phone_hash, id_card_enc,
              home_address_enc, emergency_contact_enc, emergency_phone_enc, emergency_phone_hash,
              bank_name, bank_card_no_enc, bank_card_no_hash, info_audit_status,
              created_at, updated_at
         FROM sys_user
        WHERE id = ? AND is_deleted = 0
        LIMIT 1
        FOR UPDATE`,
      [user.id],
    );

    if (!rows[0]) {
      throw createHttpError(404, '用户不存在');
    }

    const lockedUser = toCamelRow(rows[0]);
    const setParts = [];
    const params = [];
    let shouldResetInfoAudit = false;

    const assign = (column, value) => {
      setParts.push(`${column} = ?`);
      params.push(value);
    };

    if (hasOwn(payload, 'name')) {
      const name = normalizeNullableText(payload.name, 50);
      if (!name || name.length < 2 || name.length > 20 || /\d/.test(name)) {
        throw createHttpError(400, '姓名格式不正确');
      }
      assign('name', name);
    }

    if (hasOwn(payload, 'faceImgUrl')) {
      assign('face_img_url', normalizeNullableText(payload.faceImgUrl, 255));
    }

    if (hasOwn(payload, 'phone')) {
      const phone = normalizePhoneForUpdate(payload.phone);
      if (!phone || !/^1\d{10}$/.test(phone)) {
        throw createHttpError(400, '手机号格式不正确');
      }

      const phoneHash = hashSensitiveValue(phone);
      const [conflictRows] = await connection.execute(
        `SELECT id
           FROM sys_user
          WHERE phone_hash = ? AND id <> ? AND is_deleted = 0
          LIMIT 1`,
        [phoneHash, lockedUser.id],
      );

      if (conflictRows[0]) {
        throw createHttpError(409, '手机号已被使用');
      }

      assign('phone_enc', encryptSensitiveValue(phone));
      assign('phone_hash', phoneHash);
      shouldResetInfoAudit = true;
    }

    if (hasOwn(payload, 'homeAddress')) {
      const homeAddress = normalizeNullableText(payload.homeAddress, 512);
      assign('home_address_enc', homeAddress ? encryptSensitiveValue(homeAddress) : null);
      shouldResetInfoAudit = true;
    }

    if (hasOwn(payload, 'emergencyContact')) {
      const emergencyContact = normalizeNullableText(payload.emergencyContact, 256);
      assign('emergency_contact_enc', emergencyContact ? encryptSensitiveValue(emergencyContact) : null);
      shouldResetInfoAudit = true;
    }

    if (hasOwn(payload, 'emergencyPhone')) {
      const emergencyPhone = normalizePhoneForUpdate(payload.emergencyPhone);
      if (emergencyPhone && !/^1\d{10}$/.test(emergencyPhone)) {
        throw createHttpError(400, '紧急联系人电话格式不正确');
      }
      assign('emergency_phone_enc', emergencyPhone ? encryptSensitiveValue(emergencyPhone) : null);
      assign('emergency_phone_hash', emergencyPhone ? hashSensitiveValue(emergencyPhone) : null);
      shouldResetInfoAudit = true;
    }

    if (hasOwn(payload, 'bankName')) {
      assign('bank_name', normalizeNullableText(payload.bankName, 100));
      shouldResetInfoAudit = true;
    }

    if (hasOwn(payload, 'bankCardNo')) {
      const bankCardNo = normalizeBankCardNo(payload.bankCardNo);
      if (bankCardNo && !/^\d{8,30}$/.test(bankCardNo)) {
        throw createHttpError(400, '银行卡号格式不正确');
      }
      assign('bank_card_no_enc', bankCardNo ? encryptSensitiveValue(bankCardNo) : null);
      assign('bank_card_no_hash', bankCardNo ? hashSensitiveValue(bankCardNo) : null);
      shouldResetInfoAudit = true;
    }

    if (shouldResetInfoAudit) {
      assign('info_audit_status', 0);
    }

    if (setParts.length > 0) {
      params.push(lockedUser.id);
      await connection.execute(
        `UPDATE sys_user
            SET ${setParts.join(', ')}, updated_at = NOW()
          WHERE id = ?`,
        params,
      );
    }

    const [updatedRows] = await connection.execute(
      `SELECT id, uid, name, role_key, face_img_url, assigned_base_id, phone_enc, id_card_enc,
              home_address_enc, bank_name, bank_card_no_enc, info_audit_status,
              created_at, updated_at
         FROM sys_user
        WHERE id = ?
        LIMIT 1`,
      [lockedUser.id],
    );

    await connection.commit();
    return publicUser(toCamelRow(updatedRows[0]));
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function listBases(query) {
  if (query.withOpenJobs === '1' || query.withOpenJobs === 'true') {
    return listBasesWithOpenJobs(query);
  }

  const where = ['is_deleted = 0'];
  const params = [];

  if (!query.showAll && query.showAll !== '1' && query.showAll !== 'true') {
    where.push('audit_status = 1');
  }

  if (query.ownerId) {
    where.push('owner_id = ?');
    params.push(Number(query.ownerId));
  }

  if (query.category) {
    where.push('category = ?');
    params.push(Number(query.category));
  }

  const [rows] = await getPool().execute(
    `SELECT id, base_name, license_enc, contact_enc, category, region_code, address,
            description, audit_status, owner_id, is_deleted, created_at, updated_at
       FROM base_info
      WHERE ${where.join(' AND ')}
      ORDER BY created_at DESC
      LIMIT 100`,
    params,
  );

  return toCamelRows(rows).map((base) => ({
    ...base,
    licenseUrl: decryptSensitiveValue(base.licenseEnc),
    contactPhone: decryptSensitiveValue(base.contactEnc),
  }));
}

async function listBasesWithOpenJobs(query) {
  const where = [
    'base.is_deleted = 0',
    'base.audit_status = 1',
    'job.status = 1',
    'job.is_active = 1',
    '(job.valid_until IS NULL OR job.valid_until > NOW())',
  ];
  const params = [];

  if (query.category) {
    where.push('base.category = ?');
    params.push(Number(query.category));
  }

  const [rows] = await getPool().execute(
    `SELECT
       base.id, base.base_name, base.license_enc, base.contact_enc, base.category, base.region_code,
       base.address, base.description, base.audit_status, base.owner_id, base.is_deleted,
       base.created_at, base.updated_at,
       job.id AS open_job_id, job.job_title AS open_job_title, job.requirements AS open_job_requirements,
       job.work_content AS open_job_work_content, job.benefits AS open_job_benefits,
       job.valid_until AS open_job_valid_until, job.created_at AS open_job_created_at,
       job.work_hours AS open_job_work_hours
     FROM base_info base
     JOIN recruitment_job job ON job.base_id = base.id
     WHERE ${where.join(' AND ')}
     ORDER BY job.created_at DESC, base.created_at DESC
     LIMIT 100`,
    params,
  );

  return toCamelRows(rows).map((base) => ({
    ...base,
    licenseUrl: decryptSensitiveValue(base.licenseEnc),
    contactPhone: decryptSensitiveValue(base.contactEnc),
  }));
}

async function getBaseById(baseId) {
  const [rows] = await getPool().execute(
    `SELECT id, base_name, license_enc, contact_enc, category, region_code, address,
            description, audit_status, owner_id, is_deleted, created_at, updated_at
       FROM base_info
      WHERE id = ? AND is_deleted = 0
      LIMIT 1`,
    [baseId],
  );

  if (!rows[0]) throw Object.assign(new Error('基地不存在'), { statusCode: 404 });
  const base = toCamelRow(rows[0]);
  const jobs = await listBaseJobs(baseId, { status: '1' });
  const firstJob = jobs[0] || {};
  const meta = safeParseJson(base.description);
  const nextMeta = {
    ...meta,
    jobRequirement: meta.jobRequirement || meta.jobRequirements || firstJob.requirements || firstJob.workContent || '该基地当前暂无已开放岗位。',
    environmentSummary: meta.environmentSummary || meta.workEnvironment || firstJob.benefits || '基地环境信息待企业补充。',
  };

  return {
    ...base,
    description: safeStringifyJson(nextMeta),
    licenseUrl: decryptSensitiveValue(base.licenseEnc),
    contactPhone: decryptSensitiveValue(base.contactEnc),
  };
}

async function listBaseJobs(baseId, query) {
  const where = ['job.base_id = ?'];
  const params = [baseId];

  if (query.status !== undefined && query.status !== '') {
    where.push('job.status = ?');
    params.push(Number(query.status));
  }

  const [rows] = await getPool().execute(
    `SELECT job.*, base.base_name, base.address AS work_address
       FROM recruitment_job job
       LEFT JOIN base_info base ON base.id = job.base_id
      WHERE ${where.join(' AND ')}
      ORDER BY job.created_at DESC
      LIMIT 100`,
    params,
  );

  return toCamelRows(rows);
}

async function getJobByIdWithConnection(connection, jobId) {
  const [rows] = await connection.execute(
    `SELECT job.*, base.base_name, base.address AS work_address
       FROM recruitment_job job
       LEFT JOIN base_info base ON base.id = job.base_id
      WHERE job.id = ?
      LIMIT 1`,
    [jobId],
  );

  if (!rows[0]) throw Object.assign(new Error('岗位不存在'), { statusCode: 404 });
  return toCamelRow(rows[0]);
}

async function getJobById(jobId) {
  return getJobByIdWithConnection(getPool(), jobId);
}

function normalizePositiveInt(value, fallback = 0) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  if (num <= 0) return fallback;
  return Math.floor(num);
}

function normalizePositiveAmount(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  if (num <= 0) return null;
  return Number(num.toFixed(2));
}

function resolveWorkCycle(value) {
  const num = Number(value);
  if ([1, 2, 3, 4, 5].includes(num)) return num;
  return 1;
}

function resolvePayType(value) {
  const num = Number(value);
  if ([1, 2, 3].includes(num)) return num;
  return 1;
}

function normalizeImageList(value, limit = 3) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .slice(0, limit);
}

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

function isPersistedImageUrl(value) {
  const text = String(value || '').trim();
  if (!text) return false;
  if (isTemporaryImageUrl(text)) return false;
  return /^https?:\/\//i.test(text) || /^cloud:\/\//i.test(text);
}

function ensurePersistedImageUrl(value, fieldLabel) {
  const text = String(value || '').trim();
  if (!text) throw createHttpError(400, `${fieldLabel}不能为空`);
  if (!isPersistedImageUrl(text)) {
    throw createHttpError(400, `${fieldLabel}不能使用本地临时地址，请先上传为可访问链接`);
  }
  return text;
}

function normalizeBaseDescription(description, licenseUrlFallback) {
  const raw = String(description || '').trim();
  if (!raw) return '';

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (_) {
    return raw;
  }

  if (!parsed || typeof parsed !== 'object') return raw;
  const next = { ...parsed };

  if (next.licenseUrl) {
    next.licenseUrl = ensurePersistedImageUrl(next.licenseUrl, '营业执照图片');
  } else if (licenseUrlFallback) {
    next.licenseUrl = ensurePersistedImageUrl(licenseUrlFallback, '营业执照图片');
  }

  if (Array.isArray(next.workEnvImages)) {
    next.workEnvImages = next.workEnvImages
      .map((item) => String(item || '').trim())
      .filter(Boolean)
      .map((url) => ensurePersistedImageUrl(url, '工作环境图片'))
      .slice(0, 3);
  }

  return safeStringifyJson(next);
}

function normalizeBasePayload(data, { partial = false } = {}) {
  const payload = data && typeof data === 'object' ? data : {};
  const normalized = {};
  let changed = false;

  const setIfProvided = (key, value) => {
    if (!partial || hasOwn(payload, key)) {
      normalized[key] = value;
      changed = true;
    }
  };

  if (!partial || hasOwn(payload, 'baseName')) {
    const baseName = normalizeNullableText(payload.baseName, 100);
    if (!baseName) throw createHttpError(400, '基地名称不能为空');
    setIfProvided('baseName', baseName);
  }

  if (!partial || hasOwn(payload, 'licenseUrl')) {
    const licenseUrl = ensurePersistedImageUrl(payload.licenseUrl, '营业执照图片');
    setIfProvided('licenseUrl', licenseUrl);
  }

  if (!partial || hasOwn(payload, 'contactPhone')) {
    const contactPhone = normalizePhoneForUpdate(payload.contactPhone);
    if (!contactPhone || !/^1\d{10}$/.test(contactPhone)) {
      throw createHttpError(400, '联系人手机号格式不正确');
    }
    setIfProvided('contactPhone', contactPhone);
  }

  if (!partial || hasOwn(payload, 'category')) {
    const category = Number(payload.category);
    if (![1, 2, 3].includes(category)) {
      throw createHttpError(400, '基地类别无效');
    }
    setIfProvided('category', category);
  }

  if (!partial || hasOwn(payload, 'regionCode')) {
    const regionCode = Number(payload.regionCode);
    if (!Number.isInteger(regionCode) || regionCode <= 0) {
      throw createHttpError(400, '区域编码无效');
    }
    setIfProvided('regionCode', regionCode);
  }

  if (!partial || hasOwn(payload, 'address')) {
    setIfProvided('address', normalizeNullableText(payload.address, 500));
  }

  if (!partial || hasOwn(payload, 'description')) {
    const desc = normalizeBaseDescription(payload.description, normalized.licenseUrl);
    setIfProvided('description', desc);
  }

  if (partial && !changed) {
    throw createHttpError(400, '缺少可更新字段');
  }
  return normalized;
}

async function createBase(user, data) {
  const roleKey = String(user.roleKey || '');
  if (!['boss', 'super_admin', 'region_admin'].includes(roleKey)) {
    throw createHttpError(403, '当前角色无权限创建基地');
  }

  const payload = normalizeBasePayload(data, { partial: false });
  const ownerId = roleKey === 'boss'
    ? Number(user.id)
    : Number(data?.ownerId || user.id);

  if (!ownerId) throw createHttpError(400, '缺少基地负责人');

  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();

    const [ownerRows] = await connection.execute(
      `SELECT id, role_key
         FROM sys_user
        WHERE id = ? AND is_deleted = 0
        LIMIT 1
        FOR UPDATE`,
      [ownerId],
    );
    if (!ownerRows[0]) {
      throw createHttpError(404, '基地负责人不存在');
    }
    const owner = toCamelRow(ownerRows[0]);
    if (String(owner.roleKey) !== 'boss') {
      throw createHttpError(400, '基地负责人必须是老板账号');
    }

    const [nameRows] = await connection.execute(
      `SELECT id
         FROM base_info
        WHERE base_name = ? AND is_deleted = 0
        LIMIT 1
        FOR UPDATE`,
      [payload.baseName],
    );
    if (nameRows[0]) {
      throw createHttpError(409, `基地名称“${payload.baseName}”已存在`);
    }

    const [result] = await connection.execute(
      `INSERT INTO base_info (
         base_name, license_enc, contact_enc, category, region_code, address, description,
         audit_status, owner_id, is_deleted, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, 0, NOW(), NOW())`,
      [
        payload.baseName,
        encryptSensitiveValue(payload.licenseUrl),
        encryptSensitiveValue(payload.contactPhone),
        payload.category,
        payload.regionCode,
        payload.address || null,
        payload.description || null,
        ownerId,
      ],
    );

    await connection.commit();
    return getBaseById(result.insertId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function updateBase(user, baseId, data) {
  const roleKey = String(user.roleKey || '');
  if (!['boss', 'super_admin', 'region_admin'].includes(roleKey)) {
    throw createHttpError(403, '当前角色无权限修改基地');
  }

  const payload = normalizeBasePayload(data, { partial: true });
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();

    const [baseRows] = await connection.execute(
      `SELECT id, base_name, owner_id, audit_status
         FROM base_info
        WHERE id = ? AND is_deleted = 0
        LIMIT 1
        FOR UPDATE`,
      [baseId],
    );
    if (!baseRows[0]) {
      throw createHttpError(404, '基地不存在');
    }
    const base = toCamelRow(baseRows[0]);

    const isSuperRole = roleKey === 'super_admin' || roleKey === 'region_admin';
    const isOwnerBoss = roleKey === 'boss' && Number(base.ownerId) === Number(user.id);
    if (!isSuperRole && !isOwnerBoss) {
      throw createHttpError(403, '仅基地负责人可修改该基地');
    }

    if (payload.baseName && payload.baseName !== String(base.baseName || '').trim()) {
      const [nameRows] = await connection.execute(
        `SELECT id
           FROM base_info
          WHERE base_name = ? AND id <> ? AND is_deleted = 0
          LIMIT 1
          FOR UPDATE`,
        [payload.baseName, baseId],
      );
      if (nameRows[0]) {
        throw createHttpError(409, `基地名称“${payload.baseName}”已存在`);
      }
    }

    const setParts = [];
    const params = [];

    if (hasOwn(payload, 'baseName')) {
      setParts.push('base_name = ?');
      params.push(payload.baseName);
    }
    if (hasOwn(payload, 'licenseUrl')) {
      setParts.push('license_enc = ?');
      params.push(encryptSensitiveValue(payload.licenseUrl));
    }
    if (hasOwn(payload, 'contactPhone')) {
      setParts.push('contact_enc = ?');
      params.push(encryptSensitiveValue(payload.contactPhone));
    }
    if (hasOwn(payload, 'category')) {
      setParts.push('category = ?');
      params.push(payload.category);
    }
    if (hasOwn(payload, 'regionCode')) {
      setParts.push('region_code = ?');
      params.push(payload.regionCode);
    }
    if (hasOwn(payload, 'address')) {
      setParts.push('address = ?');
      params.push(payload.address || null);
    }
    if (hasOwn(payload, 'description')) {
      setParts.push('description = ?');
      params.push(payload.description || null);
    }

    // 老板修改资料后重新进入待审核
    if (!isSuperRole) {
      setParts.push('audit_status = 0');
    }

    params.push(baseId);
    await connection.execute(
      `UPDATE base_info
          SET ${setParts.join(', ')}, updated_at = NOW()
        WHERE id = ?`,
      params,
    );

    await connection.commit();
    return getBaseById(baseId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function createJob(user, baseId, data) {
  const roleKey = String(user.roleKey || '');
  if (!['super_admin', 'region_admin', 'boss', 'base_manager'].includes(roleKey)) {
    throw createHttpError(403, '当前角色无权限发布岗位');
  }

  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();

    const [baseRows] = await connection.execute(
      `SELECT id, base_name, owner_id, audit_status, address
         FROM base_info
        WHERE id = ? AND is_deleted = 0
        LIMIT 1
        FOR UPDATE`,
      [baseId],
    );
    if (!baseRows[0]) {
      throw createHttpError(404, '基地不存在');
    }

    const base = toCamelRow(baseRows[0]);
    const isSuperRole = roleKey === 'super_admin' || roleKey === 'region_admin';
    const isOwnerBoss = roleKey === 'boss' && Number(base.ownerId) === Number(user.id);
    const isBaseManager = roleKey === 'base_manager';
    if (!isSuperRole && !isOwnerBoss && !isBaseManager) {
      throw createHttpError(403, '仅基地负责人可发布岗位');
    }

    if (Number(base.auditStatus) !== 1) {
      throw createHttpError(409, '基地未审核通过，暂不可发布岗位');
    }

    const payload = data && typeof data === 'object' ? data : {};
    const jobTitle = normalizeNullableText(payload.jobTitle, 100);
    if (!jobTitle) {
      throw createHttpError(400, '请输入岗位名称');
    }

    const workAddress = normalizeNullableText(payload.workAddress, 500);
    if (!workAddress) {
      throw createHttpError(400, '请输入工作地址');
    }

    const recruitCount = normalizePositiveInt(payload.recruitCount, 1);
    const workCycle = resolveWorkCycle(payload.workCycle);
    const payType = resolvePayType(payload.payType);
    const workHours = normalizeNullableText(payload.workHours, 50);
    const workStartDate = normalizeDateString(payload.workStartDate) || null;
    const workEndDate = normalizeDateString(payload.workEndDate) || null;
    if (workStartDate && workEndDate && workStartDate > workEndDate) {
      throw createHttpError(400, '开始日期不能晚于结束日期');
    }

    const requirements = normalizeNullableText(payload.requirements, 5000);
    const workContent = normalizeNullableText(payload.workContent, 5000);
    const benefits = normalizeNullableText(payload.benefits, 5000);
    const workplaceImages = normalizeImageList(payload.workplaceImages, 3);

    let salaryAmount = null;
    let hourlyRate = null;
    let unitPrice = null;
    let targetCount = 0;

    if (payType === 1) {
      salaryAmount = normalizePositiveAmount(payload.salaryAmount ?? payload.amount);
      if (salaryAmount == null) {
        throw createHttpError(400, '请填写有效的工资金额');
      }
    } else if (payType === 2) {
      hourlyRate = normalizePositiveAmount(payload.hourlyRate ?? payload.amount);
      if (hourlyRate == null) {
        throw createHttpError(400, '请填写有效的时薪金额');
      }
    } else if (payType === 3) {
      unitPrice = normalizePositiveAmount(payload.unitPrice ?? payload.amount);
      targetCount = normalizePositiveInt(payload.targetCount, 1);
      if (unitPrice == null) {
        throw createHttpError(400, '请填写有效的计件单价');
      }
      if (targetCount <= 0) {
        throw createHttpError(400, '计件岗位请填写目标件数');
      }
    }

    const validUntilDate = normalizeDateString(payload.validUntil || workEndDate);
    const validUntil = validUntilDate ? `${validUntilDate} 23:59:59` : null;
    const mergedWorkContent = [workContent].filter(Boolean).join('\n');

    const [result] = await connection.execute(
      `INSERT INTO recruitment_job (
         base_id, pay_type, unit_price, targetCount, requirements, status, valid_until,
         recruit_count, work_cycle, work_content, work_hours, work_start_date, work_end_date,
         salary_amount, hourly_rate, benefits, workplace_images,
         is_active, auto_renew, renewal_days, applicant_count, view_count, job_title
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, 7, 0, 0, ?)`,
      [
        baseId,
        payType,
        unitPrice,
        targetCount,
        requirements || null,
        1,
        validUntil,
        recruitCount,
        workCycle,
        mergedWorkContent || null,
        workHours || null,
        workStartDate,
        workEndDate,
        salaryAmount,
        hourlyRate,
        benefits || null,
        JSON.stringify(workplaceImages),
        jobTitle,
      ],
    );

    if (workAddress !== String(base.address || '').trim()) {
      await connection.execute(
        `UPDATE base_info
            SET address = ?, updated_at = NOW()
          WHERE id = ?`,
        [workAddress, baseId],
      );
    }

    const created = await getJobByIdWithConnection(connection, result.insertId);
    await connection.commit();
    return {
      ...created,
      publishMessage: '岗位已提交并发布到广场',
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

function assertJobOpenForSignup(job, expectedBaseId, workDate) {
  if (
    !job
    || Number(job.baseId) !== Number(expectedBaseId)
    || Number(job.status) !== 1
    || !isEnabledFlag(job.isActive)
    || (job.validUntil && new Date(job.validUntil).getTime() <= Date.now())
  ) {
    throw Object.assign(new Error('该岗位尚未开放报名'), { statusCode: 400 });
  }

  if (!isWorkDateWithinJobWindow(job, workDate)) {
    throw Object.assign(new Error('报名日期不在该岗位工作日期范围内'), { statusCode: 400 });
  }
}

async function refreshApplicantCount(connection, jobId) {
  const [[row]] = await connection.execute(
    `SELECT COUNT(*) AS applicant_count
       FROM job_application
      WHERE job_id = ? AND status IN (?, ?)`,
    [jobId, APPLICATION_STATUS.PENDING, APPLICATION_STATUS.APPROVED],
  );
  const applicantCount = Number(row?.applicant_count || 0);
  await connection.execute(
    `UPDATE recruitment_job
        SET applicant_count = ?
      WHERE id = ?`,
    [applicantCount, jobId],
  );
  return applicantCount;
}

async function ensureApplicationForSignup(connection, userId, jobId, baseId, note) {
  const [rows] = await connection.execute(
    `SELECT id, status
       FROM job_application
      WHERE user_id = ? AND job_id = ? AND base_id = ?
      ORDER BY created_at DESC, id DESC
      LIMIT 1
      FOR UPDATE`,
    [userId, jobId, baseId],
  );

  const existing = rows[0] ? toCamelRow(rows[0]) : null;
  if (existing && [APPLICATION_STATUS.PENDING, APPLICATION_STATUS.APPROVED].includes(Number(existing.status))) {
    return existing;
  }

  if (existing && Number(existing.status) === APPLICATION_STATUS.CANCELLED) {
    await connection.execute(
      `UPDATE job_application
          SET status = ?, note = ?, rejectReason = NULL, reviewed_by = NULL, reviewed_at = NULL, updated_at = NOW()
        WHERE id = ?`,
      [APPLICATION_STATUS.PENDING, note || '', existing.id],
    );
    return { ...existing, status: APPLICATION_STATUS.PENDING };
  }

  const [result] = await connection.execute(
    `INSERT INTO job_application (user_id, job_id, base_id, status, note, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
    [userId, jobId, baseId, APPLICATION_STATUS.PENDING, note || ''],
  );
  return {
    id: result.insertId,
    userId,
    jobId,
    baseId,
    status: APPLICATION_STATUS.PENDING,
  };
}

async function applyJob(user, data) {
  const jobId = Number(data.jobId || data.id || 0);
  if (!jobId) throw Object.assign(new Error('请选择岗位'), { statusCode: 400 });

  const job = await getJobById(jobId);
  assertJobOpenForSignup(job, Number(job.baseId), normalizeDateString(data.workDate) || today());
  const baseId = Number(job.baseId);

  const [existing] = await getPool().execute(
    `SELECT id, status FROM job_application WHERE user_id = ? AND job_id = ? LIMIT 1`,
    [user.id, jobId],
  );
  if (existing[0]) return toCamelRow(existing[0]);

  const [result] = await getPool().execute(
    `INSERT INTO job_application (user_id, job_id, base_id, status, note, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
    [user.id, jobId, baseId, APPLICATION_STATUS.PENDING, data.note || ''],
  );

  await refreshApplicantCount(getPool(), jobId);

  return {
    id: result.insertId,
    userId: user.id,
    jobId,
    baseId,
    status: APPLICATION_STATUS.PENDING,
  };
}

async function signup(user, data) {
  const baseId = Number(data.baseId || 0);
  const jobId = Number(data.jobId || 0);
  const workDate = normalizeDateString(data.workDate) || today();
  if (!baseId || !jobId) throw Object.assign(new Error('请选择基地和岗位'), { statusCode: 400 });

  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();

    const job = await getJobByIdWithConnection(connection, jobId);
    assertJobOpenForSignup(job, baseId, workDate);

    const [sameJobRows] = await connection.execute(
      `SELECT signup.*, base.base_name, job.job_title, job.work_hours
         FROM daily_signup signup
         LEFT JOIN base_info base ON base.id = signup.base_id
         LEFT JOIN recruitment_job job ON job.id = signup.job_id
        WHERE signup.user_id = ? AND signup.base_id = ? AND signup.job_id = ? AND signup.work_date = ?
          AND signup.status IN (?, ?)
        ORDER BY signup.id DESC
        LIMIT 1
        FOR UPDATE`,
      [user.id, baseId, jobId, workDate, SIGNUP_STATUS.SIGNED_UP, SIGNUP_STATUS.CHECKED_IN],
    );

    if (sameJobRows[0]) {
      const existingSignup = toCamelRow(sameJobRows[0]);
      const application = await ensureApplicationForSignup(connection, user.id, jobId, baseId, data.note || '');
      await refreshApplicantCount(connection, jobId);
      await connection.commit();
      return {
        ...existingSignup,
        duplicate: true,
        applicationId: application.id,
      };
    }

    const [existingRows] = await connection.execute(
      `SELECT signup.id, signup.user_id, signup.base_id, signup.job_id, signup.work_date, signup.status,
              base.base_name, job.job_title, job.work_hours
         FROM daily_signup signup
         LEFT JOIN base_info base ON base.id = signup.base_id
         LEFT JOIN recruitment_job job ON job.id = signup.job_id
        WHERE signup.user_id = ? AND signup.work_date = ? AND signup.status IN (?, ?)
        ORDER BY signup.created_at DESC, signup.id DESC
        FOR UPDATE`,
      [user.id, workDate, SIGNUP_STATUS.SIGNED_UP, SIGNUP_STATUS.CHECKED_IN],
    );

    const conflictingSignup = toCamelRows(existingRows).find((row) => hasTimeOverlap(job.workHours, row.workHours));
    if (conflictingSignup) {
      throw buildConflictError(conflictingSignup);
    }

    const application = await ensureApplicationForSignup(connection, user.id, jobId, baseId, data.note || '');
    const [result] = await connection.execute(
      `INSERT INTO daily_signup (user_id, base_id, job_id, work_date, status, is_proxy, is_offline_sync, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 0, 0, NOW(), NOW())`,
      [user.id, baseId, jobId, workDate, SIGNUP_STATUS.SIGNED_UP],
    );

    await refreshApplicantCount(connection, jobId);
    await connection.commit();

    return {
      id: result.insertId,
      userId: user.id,
      baseId,
      jobId,
      workDate,
      status: SIGNUP_STATUS.SIGNED_UP,
      duplicate: false,
      applicationId: application.id,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function cancelSignup(user, data) {
  const signupId = Number(data.signupId || 0);
  const baseId = Number(data.baseId || 0);
  const jobId = Number(data.jobId || 0);
  const workDate = normalizeDateString(data.workDate) || today();
  if (!signupId && !baseId) {
    throw Object.assign(new Error('缺少报名定位参数'), { statusCode: 400 });
  }

  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();

    const whereSql = signupId
      ? 'signup.id = ? AND signup.user_id = ?'
      : (jobId
        ? 'signup.user_id = ? AND signup.base_id = ? AND signup.job_id = ? AND signup.work_date = ?'
        : 'signup.user_id = ? AND signup.base_id = ? AND signup.work_date = ?');
    const params = signupId
      ? [signupId, user.id]
      : (jobId ? [user.id, baseId, jobId, workDate] : [user.id, baseId, workDate]);
    const [signupRows] = await connection.execute(
      `SELECT signup.*
         FROM daily_signup signup
        WHERE ${whereSql}
        LIMIT 1
        FOR UPDATE`,
      params,
    );

    if (!signupRows[0]) {
      throw Object.assign(new Error('未找到可取消的报名记录'), { statusCode: 404 });
    }

    const signupRecord = toCamelRow(signupRows[0]);
    if (Number(signupRecord.status) === SIGNUP_STATUS.CHECKED_IN) {
      throw Object.assign(new Error('已签到记录不可取消'), { statusCode: 400 });
    }
    if (Number(signupRecord.status) === SIGNUP_STATUS.ABSENT) {
      throw Object.assign(new Error('缺勤记录不可取消'), { statusCode: 400 });
    }

    await connection.execute('DELETE FROM daily_signup WHERE id = ?', [signupRecord.id]);

    const [applicationRows] = await connection.execute(
      `SELECT id, status
         FROM job_application
        WHERE user_id = ? AND job_id = ? AND base_id = ? AND status IN (?, ?)
        ORDER BY created_at DESC, id DESC
        LIMIT 1
        FOR UPDATE`,
      [
        user.id,
        signupRecord.jobId,
        signupRecord.baseId,
        APPLICATION_STATUS.PENDING,
        APPLICATION_STATUS.APPROVED,
      ],
    );

    let applicationCancelled = false;
    if (applicationRows[0]) {
      await connection.execute(
        `UPDATE job_application
            SET status = ?, updated_at = NOW()
          WHERE id = ?`,
        [APPLICATION_STATUS.CANCELLED, applicationRows[0].id],
      );
      applicationCancelled = true;
    }

    await refreshApplicantCount(connection, signupRecord.jobId);
    await connection.commit();

    return {
      success: true,
      deleted: true,
      signupId: signupRecord.id,
      applicationCancelled,
      jobId: signupRecord.jobId,
      baseId: signupRecord.baseId,
      workDate: signupRecord.workDate,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function listBaseApplications(baseId) {
  const [rows] = await getPool().execute(
    `SELECT app.*, user.name AS worker_name, user.uid AS worker_uid
       FROM job_application app
       LEFT JOIN sys_user user ON user.id = app.user_id
      WHERE app.base_id = ?
      ORDER BY app.created_at DESC
      LIMIT 300`,
    [baseId],
  );
  return toCamelRows(rows);
}

async function salaryList(user, query) {
  const roleKey = String(user.roleKey || '');
  if (!['super_admin', 'region_admin', 'boss', 'base_manager', 'field_manager'].includes(roleKey)) {
    throw createHttpError(403, '当前角色无权限查看工资列表');
  }

  const baseId = query.baseId ? Number(query.baseId) : 0;
  const dateFrom = normalizeDateString(query.dateFrom);
  const dateTo = normalizeDateString(query.dateTo);
  const status = query.status !== undefined && query.status !== '' ? Number(query.status) : null;

  const where = ['1=1'];
  const params = [];

  if (baseId > 0) {
    where.push('signup.base_id = ?');
    params.push(baseId);
  }
  if (dateFrom) {
    where.push('signup.work_date >= ?');
    params.push(dateFrom);
  }
  if (dateTo) {
    where.push('signup.work_date <= ?');
    params.push(dateTo);
  }
  if (status !== null && Number.isFinite(status)) {
    where.push('salary.status = ?');
    params.push(status);
  }

  if (roleKey === 'boss') {
    where.push('base.owner_id = ?');
    params.push(user.id);
  } else if ((roleKey === 'base_manager' || roleKey === 'field_manager') && user.assignedBaseId) {
    where.push('signup.base_id = ?');
    params.push(Number(user.assignedBaseId));
  }

  const [rows] = await getPool().execute(
    `SELECT
       salary.id,
       salary.signup_id,
       salary.work_duration,
       salary.piece_count,
       salary.unit_price_snapshot,
       salary.total_amount,
       salary.payout_type,
       salary.status,
       salary.created_at,
       signup.user_id,
       signup.base_id,
       signup.job_id,
       signup.work_date,
       worker.name AS worker_name,
       worker.uid AS worker_uid,
       worker.phone_enc AS worker_phone_enc,
       base.base_name,
       job.job_title
      FROM labor_salary salary
      JOIN daily_signup signup ON signup.id = salary.signup_id
      LEFT JOIN sys_user worker ON worker.id = signup.user_id
      LEFT JOIN base_info base ON base.id = signup.base_id
      LEFT JOIN recruitment_job job ON job.id = signup.job_id
     WHERE ${where.join(' AND ')}
     ORDER BY salary.created_at DESC
     LIMIT 500`,
    params,
  );

  const list = toCamelRows(rows).map((item) => ({
    ...item,
    workerPhone: decryptSensitiveValue(item.workerPhoneEnc),
  }));

  return {
    list,
    total: list.length,
  };
}

async function workerSalaryStats(user) {
  const [rows] = await getPool().execute(
    `SELECT
       COALESCE(SUM(salary.total_amount), 0) AS total_amount,
       COALESCE(SUM(CASE WHEN salary.status = 2 THEN salary.total_amount ELSE 0 END), 0) AS paid_amount,
       COALESCE(SUM(CASE WHEN salary.status <> 2 THEN salary.total_amount ELSE 0 END), 0) AS pending_amount,
       COUNT(*) AS record_count
     FROM labor_salary salary
     JOIN daily_signup signup ON signup.id = salary.signup_id
     WHERE signup.user_id = ?`,
    [user.id],
  );
  return toCamelRow(rows[0] || {});
}

async function workerSalaryList(user, paidOnly) {
  const statusSql = paidOnly ? 'salary.status = 2' : 'salary.status <> 2';
  const [rows] = await getPool().execute(
    `SELECT salary.*, signup.work_date, signup.base_id, signup.job_id, base.base_name, job.job_title
       FROM labor_salary salary
       JOIN daily_signup signup ON signup.id = salary.signup_id
       LEFT JOIN base_info base ON base.id = signup.base_id
       LEFT JOIN recruitment_job job ON job.id = signup.job_id
      WHERE signup.user_id = ? AND ${statusSql}
      ORDER BY salary.created_at DESC
      LIMIT 100`,
    [user.id],
  );
  return toCamelRows(rows);
}

async function workerAttendanceRecords(user, query) {
  const limit = Math.min(Number(query.limit || 100), 200);
  const [rows] = await getPool().execute(
    `SELECT signup.*, base.base_name, job.job_title,
            CASE WHEN signup.status = 0 THEN 1 ELSE 0 END AS can_cancel
       FROM daily_signup signup
       LEFT JOIN base_info base ON base.id = signup.base_id
       LEFT JOIN recruitment_job job ON job.id = signup.job_id
      WHERE signup.user_id = ?
      ORDER BY signup.work_date DESC, signup.created_at DESC
      LIMIT ${limit}`,
    [user.id],
  );
  return toCamelRows(rows);
}

async function getAttendanceQrCode(user) {
  const issuedAt = Date.now();
  const content = `PICKPASS|${user.uid}|${issuedAt}`;
  const qrImageBase64 = await QRCode.toDataURL(content, {
    errorCorrectionLevel: 'H',
    margin: 2,
    width: 300,
  });

  const [rows] = await getPool().execute(
    `SELECT MAX(checkin_time) AS last_checkin_time
       FROM daily_signup
      WHERE user_id = ? AND status = 1`,
    [user.id],
  );

  return {
    content,
    validDuration: '24h',
    qrImageBase64,
    lastCheckinTime: rows[0]?.last_checkin_time || null,
    checkedIn: false,
    checkinStatus: 'not_checked_in',
  };
}

async function dispatch(event, user) {
  const method = normalizeMethod(event.method);
  const { pathname, query } = parseQuery(event.url);
  const data = event.data || {};

  if (method === 'GET' && pathname === '/user/profile') return getProfile(user);
  if (method === 'PATCH' && pathname === '/user/profile') return updateProfile(user, data);
  if (method === 'GET' && pathname === '/base') return listBases(query);
  if (method === 'GET' && pathname === '/base/managed') return listBases({ showAll: 'true', ownerId: user.id });

  const baseJobsMatch = pathname.match(/^\/base\/(\d+)\/jobs$/);
  if (method === 'GET' && baseJobsMatch) return listBaseJobs(Number(baseJobsMatch[1]), query);
  if (method === 'POST' && baseJobsMatch) return createJob(user, Number(baseJobsMatch[1]), data);

  const baseApplicationsMatch = pathname.match(/^\/base\/(\d+)\/applications$/);
  if (method === 'GET' && baseApplicationsMatch) return listBaseApplications(Number(baseApplicationsMatch[1]));

  const baseMatch = pathname.match(/^\/base\/(\d+)$/);
  if (method === 'GET' && baseMatch) return getBaseById(Number(baseMatch[1]));

  const jobMatch = pathname.match(/^\/base\/jobs\/(\d+)$/);
  if (method === 'GET' && jobMatch) return getJobById(Number(jobMatch[1]));
  if (method === 'POST' && pathname.match(/^\/base\/jobs\/\d+\/apply$/)) {
    const appliedJobId = Number(pathname.match(/^\/base\/jobs\/(\d+)\/apply$/)[1]);
    return applyJob(user, { ...data, jobId: appliedJobId });
  }

  if (method === 'POST' && pathname === '/attendance/signup') return signup(user, data);
  if (method === 'POST' && pathname === '/attendance/signup/cancel') return cancelSignup(user, data);
  if (method === 'GET' && pathname === '/attendance/qrcode') return getAttendanceQrCode(user);
  if (method === 'GET' && pathname === '/attendance/worker/records') return workerAttendanceRecords(user, query);

  if (method === 'GET' && pathname === '/salary/worker/stats') return workerSalaryStats(user);
  if (method === 'GET' && pathname === '/salary/worker/pending') return workerSalaryList(user, false);
  if (method === 'GET' && pathname === '/salary/worker/paid') return workerSalaryList(user, true);
  if (method === 'GET' && pathname === '/salary/list') return salaryList(user, query);

  throw Object.assign(new Error(`apiProxy 暂未支持接口：${method} ${pathname}`), { statusCode: 404 });
}

exports.main = async (event) => {
  try {
    const user = await getCurrentUser(event);
    const data = await dispatch(event, user);
    return ok(data);
  } catch (error) {
    return fail(error.statusCode || 500, error.message || '云函数接口调用失败', error.data);
  }
};
