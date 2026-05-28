const jwt = require('jsonwebtoken');
const QRCode = require('qrcode');
const XLSX = require('xlsx');

const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

function ok(data) {
  return { ok: true, data };
}

function fail(statusCode, message, data) {
  return { ok: false, statusCode, message, data: data || null };
}

function buildXlsxBase64(columns, rows) {
  const worksheetRows = [columns].concat(rows);
  const worksheet = XLSX.utils.aoa_to_sheet(worksheetRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
  return XLSX.write(workbook, {
    type: 'base64',
    bookType: 'xlsx',
  });
}

function createHttpError(statusCode, message, data) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.data = data || null;
  return error;
}

function normalizeMethod(method) {
  return String(method || 'GET').toUpperCase();
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

function trimText(value) {
  return String(value || '').trim();
}

function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '');
}

function toNumber(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function safeParseJson(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(String(value));
  } catch (_) {
    return {};
  }
}

function isRecruitingJob(job = {}) {
  const status = Number(job.status);
  return status === 1 || job.status === 'recruiting' || job.status === 'open';
}

function isApprovedJob(job = {}) {
  const auditStatus = Number(job.auditStatus);
  if (!Number.isFinite(auditStatus)) return true;
  return auditStatus === 1;
}

function isActiveJob(job = {}) {
  if (job.isActive === false) return false;
  if (!isRecruitingJob(job)) return false;
  if (!isApprovedJob(job)) return false;

  if (job.validUntil) {
    const expiresAt = new Date(job.validUntil).getTime();
    if (Number.isFinite(expiresAt) && expiresAt <= Date.now()) return false;
  }

  return true;
}

function compareByDateDesc(left, right, keyCandidates) {
  const leftTs = keyCandidates
    .map((key) => new Date(left && left[key] ? left[key] : 0).getTime())
    .find((ts) => Number.isFinite(ts)) || 0;
  const rightTs = keyCandidates
    .map((key) => new Date(right && right[key] ? right[key] : 0).getTime())
    .find((ts) => Number.isFinite(ts)) || 0;
  return rightTs - leftTs;
}

function issueToken(user) {
  const secret = trimText(process.env.JWT_SECRET);
  if (!secret) throw new Error('JWT_SECRET environment variable is not configured');
  return jwt.sign(
    {
      username: user.name,
      sub: user.id,
      role: user.roleKey || user.role || 'worker',
      uid: user.uid || '',
    },
    secret,
    { expiresIn: '7d' },
  );
}

function decodeToken(token) {
  const secret = trimText(process.env.JWT_SECRET);
  if (!secret) throw new Error('JWT_SECRET environment variable is not configured');
  return jwt.verify(token, secret);
}

function getBearerToken(headers = {}, fallbackToken = '') {
  const authHeader = headers.Authorization || headers.authorization || '';
  const match = String(authHeader).match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : fallbackToken;
}

function getCollection(name) {
  return db.collection(name);
}

async function findOneByField(collectionName, field, value) {
  const res = await getCollection(collectionName).where({ [field]: value, isDeleted: _.neq(true) }).limit(1).get();
  if (Array.isArray(res.data) && res.data.length) return res.data[0];
  return null;
}

async function getAllDocuments(collectionName) {
  const res = await getCollection(collectionName).get();
  return Array.isArray(res.data) ? res.data : [];
}

async function getNextNumericId(collectionName, field = 'id') {
  const counterKey = `${collectionName}:${field}`;
  try {
    await getCollection('counters').doc(counterKey).update({
      data: { seq: _.inc(1) },
    });
  } catch (_) {
    const records = await getAllDocuments(collectionName);
    const maxId = records.reduce((currentMax, item) => {
      const nextValue = Number(item && item[field]);
      return Number.isFinite(nextValue) && nextValue > currentMax ? nextValue : currentMax;
    }, 0);
    try {
      await getCollection('counters').add({
        data: { _id: counterKey, name: collectionName, field, seq: maxId },
      });
      await getCollection('counters').doc(counterKey).update({
        data: { seq: _.inc(1) },
      });
    } catch (__) {
      await getCollection('counters').doc(counterKey).update({
        data: { seq: _.inc(1) },
      });
    }
  }
  const doc = await getCollection('counters').doc(counterKey).get();
  return (doc.data && doc.data.seq) || 1;
}

async function getCurrentUser(event) {
  const token = getBearerToken(event.headers || {}, event.token || '');
  if (!token) {
    throw createHttpError(401, 'Login expired, please sign in again.');
  }

  let payload;
  try {
    payload = decodeToken(token);
  } catch (_) {
    throw createHttpError(401, 'Login expired, please sign in again.');
  }

  const user = await findOneByField('users', 'id', Number(payload.sub));
  if (!user || user.isDeleted) {
    throw createHttpError(401, 'Login expired, please sign in again.');
  }

  return user;
}

function normalizePublicUser(user = {}) {
  return {
    id: Number(user.id || 0),
    uid: user.uid || '',
    name: user.name || '',
    role: user.roleKey || user.role || 'worker',
    roleKey: user.roleKey || user.role || 'worker',
    phone: user.phone || '',
    idCard: user.idCard || '',
    homeAddress: user.homeAddress || '',
    bankName: user.bankName || '',
    bankCardNo: user.bankCardNo || '',
    gender: user.gender || '',
    isPoorHousehold: typeof user.isPoorHousehold === 'boolean' ? user.isPoorHousehold : null,
    faceImgUrl: user.faceImgUrl || '',
    avatarUrl: user.avatarUrl || '',
    headImgUrl: user.headImgUrl || '',
    photoUrl: user.photoUrl || '',
    assignedBaseId: user.assignedBaseId || null,
    infoAuditStatus: Number(user.infoAuditStatus || 0),
    registerMode: user.registerMode || 'self',
    accountOwnerVerified: user.accountOwnerVerified !== false,
    emergencyContact: user.emergencyContact || '',
    emergencyPhone: user.emergencyPhone || '',
    createdAt: user.createdAt || '',
    updatedAt: user.updatedAt || '',
  };
}

async function login(data) {
  const phone = trimText(data && data.phone);
  const idCardLast6 = trimText(data && data.idCardLast6).toUpperCase();
  if (!/^1\d{10}$/.test(phone) || idCardLast6.length !== 6) {
    throw createHttpError(401, '请提供正确的手机号和身份证后6位');
  }

  const user = await findOneByField('users', 'phone', phone);
  if (!user || user.isDeleted) {
    throw createHttpError(401, '登录失败：手机号未注册，或身份证后6位不匹配。');
  }

  const idCard = trimText(user.idCard).toUpperCase();
  if (!idCard || !idCard.endsWith(idCardLast6)) {
    throw createHttpError(401, '登录失败：手机号未注册，或身份证后6位不匹配。');
  }

  if (user.loginLockReason) {
    throw createHttpError(401, user.loginLockReason);
  }

  return {
    access_token: issueToken(user),
    user: {
      id: Number(user.id || 0),
      name: user.name || '',
      role: user.roleKey || user.role || 'worker',
      roleKey: user.roleKey || user.role || 'worker',
      uid: user.uid || '',
      faceImgUrl: user.faceImgUrl || '',
      assignedBaseId: user.assignedBaseId || null,
    },
  };
}

async function wechatLogin(event) {
  // 1. 从云函数上下文获取用户的微信 OPENID
  let openid = null;
  try {
    const wxContext = cloud.getWXContext();
    if (wxContext && wxContext.OPENID) openid = wxContext.OPENID;
  } catch (_) {}
  if (!openid) openid = event && (event._openid || event.openid);
  if (!openid) throw createHttpError(401, '无法获取微信身份，请重新尝试');

  // 2. 查云数据库中有没有这个 openid
  let user = await findOneByField('users', 'openid', openid);

  // 3. 如果没有则创建新用户
  if (!user) {
    const id = Date.now();
    const uid = 'WX_' + id.toString(36).toUpperCase();
    const newUser = {
      id,
      uid,
      openid,
      name: '',
      phone: '',
      idCard: '',
      role: 'worker',
      roleKey: 'worker',
      faceImgUrl: '',
      avatarUrl: '',
      assignedBaseId: null,
      infoAuditStatus: 0,
      registerMode: 'wechat',
      isDeleted: false,
      loginLockReason: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const created = await getCollection('users').add({ data: newUser });
    user = Object.assign({}, newUser, { _id: created._id });
  }

  // 4. 检查是否被锁定
  if (user.loginLockReason) throw createHttpError(401, user.loginLockReason);

  // 5. 签发 JWT
  return {
    access_token: issueToken(user),
    user: {
      id: Number(user.id || 0) || user._id,
      name: user.name || '',
      role: user.roleKey || user.role || 'worker',
      roleKey: user.roleKey || user.role || 'worker',
      uid: user.uid || '',
      faceImgUrl: user.faceImgUrl || '',
      assignedBaseId: user.assignedBaseId || null,
    },
    registerStage: user.name ? 'complete' : 'wechat_only',
  };
}

async function ensureUniqueUserFields({ phone, idCard, bankCardNo }) {
  const users = await getAllDocuments('users');
  const phoneExists = users.some((item) => !item.isDeleted && trimText(item.phone) === trimText(phone));
  if (phoneExists) {
    throw createHttpError(409, '手机号已被使用，请检查后重试');
  }

  const idCardExists = users.some((item) => !item.isDeleted && trimText(item.idCard).toUpperCase() === trimText(idCard).toUpperCase());
  if (idCardExists) {
    throw createHttpError(409, '身份证号已被使用，请检查后重试');
  }

  if (bankCardNo) {
    const bankCardExists = users.some((item) => !item.isDeleted && digitsOnly(item.bankCardNo) === digitsOnly(bankCardNo));
    if (bankCardExists) {
      throw createHttpError(409, '银行卡号已被使用，请检查后重试');
    }
  }
}

function buildUserUid(roleKey, id) {
  const prefix = roleKey === 'boss' ? 'B' : 'U';
  return `${prefix}${String(id).padStart(3, '0')}`;
}

async function registerUser(data, roleKey) {
  const payload = data && typeof data === 'object' ? data : {};
  const name = trimText(payload.name);
  const idCard = trimText(payload.idCard).toUpperCase();
  const phone = digitsOnly(payload.phone).slice(0, 11);
  const homeAddress = trimText(payload.homeAddress);
  const emergencyContact = trimText(payload.emergencyContact);
  const emergencyPhone = digitsOnly(payload.emergencyPhone).slice(0, 11);
  const bankName = trimText(payload.bankName);
  const bankCardNo = digitsOnly(payload.bankCardNo);
  const gender = trimText(payload.gender).toLowerCase();
  const isPoorHousehold = typeof payload.isPoorHousehold === 'boolean' ? payload.isPoorHousehold : null;

  if (!name) throw createHttpError(400, '请输入真实姓名');
  if (!/^\d{17}[\dX]$/.test(idCard)) throw createHttpError(400, '身份证格式不正确，请输入18位身份证号');
  if (!/^1\d{10}$/.test(phone)) throw createHttpError(400, '请输入正确的11位手机号');
  if (!homeAddress || homeAddress.length < 5) throw createHttpError(400, '请填写身份证地址（至少5个字）');

  if (roleKey === 'boss') {
    if (!bankName) throw createHttpError(400, '请选择开户银行');
    if (!/^\d{16,19}$/.test(bankCardNo)) throw createHttpError(400, '老板银行卡号需为16-19位数字');
  } else {
    if (gender !== 'male' && gender !== 'female') throw createHttpError(400, '请选择性别');
    if (typeof isPoorHousehold !== 'boolean') throw createHttpError(400, '请选择是否贫困户');
    if (!bankName) throw createHttpError(400, '请输入开户银行');
    if (bankCardNo.length < 12) throw createHttpError(400, '请输入正确的银行卡号');
  }

  if (emergencyPhone && !/^1\d{10}$/.test(emergencyPhone)) {
    throw createHttpError(400, '紧急联系人电话需为11位手机号');
  }

  await ensureUniqueUserFields({ phone, idCard, bankCardNo });

  const id = await getNextNumericId('users');
  const now = new Date().toISOString();
  const user = {
    id,
    uid: buildUserUid(roleKey, id),
    name,
    phone,
    idCard,
    role: roleKey,
    roleKey,
    faceImgUrl: '',
    avatarUrl: '',
    headImgUrl: '',
    photoUrl: '',
    gender: roleKey === 'boss' ? '' : gender,
    isPoorHousehold,
    assignedBaseId: null,
    homeAddress,
    bankName,
    bankCardNo,
    emergencyContact,
    emergencyPhone,
    infoAuditStatus: 1,
    registerMode: 'self',
    accountOwnerVerified: true,
    loginLockReason: null,
    isDeleted: false,
    createdAt: now,
    updatedAt: now,
  };

  await getCollection('users').add({ data: user });
  return {
    id: user.id,
    uid: user.uid,
    name: user.name,
    msg: roleKey === 'boss' ? '老板注册成功' : '注册成功',
  };
}

async function getProfile(user) {
  return normalizePublicUser(user);
}

async function updateProfile(user, data) {
  const next = Object.assign({}, user);
  const payload = data && typeof data === 'object' ? data : {};

  if (Object.prototype.hasOwnProperty.call(payload, 'name')) {
    const name = trimText(payload.name);
    if (name.length < 2 || name.length > 20 || /\d/.test(name)) {
      throw createHttpError(400, '姓名格式不正确');
    }
    next.name = name;
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'phone')) {
    const phone = String(payload.phone || '').replace(/\D/g, '').slice(0, 11);
    if (!/^1\d{10}$/.test(phone)) {
      throw createHttpError(400, '手机号格式不正确');
    }
    next.phone = phone;
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'homeAddress')) {
    next.homeAddress = trimText(payload.homeAddress);
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'emergencyContact')) {
    next.emergencyContact = trimText(payload.emergencyContact);
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'emergencyPhone')) {
    const emergencyPhone = String(payload.emergencyPhone || '').replace(/\D/g, '').slice(0, 11);
    if (emergencyPhone && !/^1\d{10}$/.test(emergencyPhone)) {
      throw createHttpError(400, '紧急联系人电话格式不正确');
    }
    next.emergencyPhone = emergencyPhone;
  }

  next.updatedAt = new Date().toISOString();
  delete next._id;

  await getCollection('users').doc(user._id).update({ data: next });
  return normalizePublicUser(next);
}

function normalizeBaseRecord(base = {}) {
  return {
    id: Number(base.id || 0),
    baseName: base.baseName || '',
    licenseUrl: base.licenseUrl || '',
    contactPhone: base.contactPhone || '',
    category: Number(base.category || 0),
    regionCode: Number(base.regionCode || 0),
    address: base.address || '',
    description: typeof base.description === 'string' ? base.description : JSON.stringify(base.description || {}),
    auditStatus: Number(base.auditStatus || 0),
    ownerId: Number(base.ownerId || 0),
    isDeleted: Boolean(base.isDeleted),
    createdAt: base.createdAt || '',
    updatedAt: base.updatedAt || '',
  };
}

function normalizeBossBaseDescription(rawDescription) {
  const meta = safeParseJson(rawDescription);
  return {
    salary: trimText(meta.salary),
    jobDescription: trimText(meta.jobDescription),
    workEnvImages: Array.isArray(meta.workEnvImages) ? meta.workEnvImages.filter(Boolean) : [],
    ownerProfile: meta && typeof meta.ownerProfile === 'object' ? meta.ownerProfile : {},
    companyAdminContact: meta && typeof meta.companyAdminContact === 'object' ? meta.companyAdminContact : {},
    enterpriseExtra: meta && typeof meta.enterpriseExtra === 'object' ? meta.enterpriseExtra : {},
    enterpriseStage: trimText(meta.enterpriseStage || 'draft'),
    submittedAt: trimText(meta.submittedAt),
    approvedAt: trimText(meta.approvedAt),
    uiStyle: trimText(meta.uiStyle),
  };
}

function buildBossBaseDescription(description = {}) {
  return JSON.stringify({
    salary: trimText(description.salary),
    jobDescription: trimText(description.jobDescription),
    workEnvImages: Array.isArray(description.workEnvImages) ? description.workEnvImages.filter(Boolean) : [],
    ownerProfile: description.ownerProfile && typeof description.ownerProfile === 'object' ? description.ownerProfile : {},
    companyAdminContact: description.companyAdminContact && typeof description.companyAdminContact === 'object'
      ? description.companyAdminContact
      : {},
    enterpriseExtra: description.enterpriseExtra && typeof description.enterpriseExtra === 'object'
      ? description.enterpriseExtra
      : {},
    enterpriseStage: trimText(description.enterpriseStage || 'draft'),
    submittedAt: trimText(description.submittedAt),
    approvedAt: trimText(description.approvedAt),
    uiStyle: trimText(description.uiStyle || 'blue-white-rounded'),
  });
}

async function createBase(user, data = {}) {
  const role = user.roleKey || user.role || 'worker';
  if (role !== 'boss' && role !== 'super_admin' && role !== 'region_admin') {
    throw createHttpError(403, '当前角色无权提交企业入驻信息');
  }

  const baseName = trimText(data.baseName);
  const licenseUrl = trimText(data.licenseUrl);
  const contactPhone = digitsOnly(data.contactPhone).slice(0, 11);
  const category = Number(data.category || 0);
  const regionCode = Number(data.regionCode || 0);
  const address = trimText(data.address);
  const description = buildBossBaseDescription(normalizeBossBaseDescription(data.description));

  if (!baseName) throw createHttpError(400, '请填写企业名称');
  if (!licenseUrl) throw createHttpError(400, '请上传营业执照');
  if (!/^1\d{10}$/.test(contactPhone)) throw createHttpError(400, '请填写正确的联系电话');
  if (!category) throw createHttpError(400, '请选择企业类别');
  if (!regionCode) throw createHttpError(400, '请填写区域编码');
  // address is optional in the first-stage enterprise entry flow

  const id = await getNextNumericId('bases');
  const now = new Date().toISOString();
  const payload = {
    id,
    baseName,
    licenseUrl,
    contactPhone,
    category,
    regionCode,
    address,
    description,
    auditStatus: 0,
    ownerId: Number(user.id || 0),
    isDeleted: false,
    createdAt: now,
    updatedAt: now,
  };

  await getCollection('bases').add({ data: payload });
  return normalizeBaseRecord(payload);
}

async function updateBase(user, baseId, data = {}) {
  const base = await findOneByField('bases', 'id', Number(baseId));
  if (!base || base.isDeleted) {
    throw createHttpError(404, '基地不存在');
  }

  const role = user.roleKey || user.role || 'worker';
  const canEdit = role === 'super_admin' || role === 'region_admin' || Number(base.ownerId || 0) === Number(user.id || 0);
  if (!canEdit) {
    throw createHttpError(403, '当前角色无权修改企业入驻信息');
  }

  const next = Object.assign({}, base);
  if (Object.prototype.hasOwnProperty.call(data, 'baseName')) next.baseName = trimText(data.baseName);
  if (Object.prototype.hasOwnProperty.call(data, 'licenseUrl')) next.licenseUrl = trimText(data.licenseUrl);
  if (Object.prototype.hasOwnProperty.call(data, 'contactPhone')) next.contactPhone = digitsOnly(data.contactPhone).slice(0, 11);
  if (Object.prototype.hasOwnProperty.call(data, 'category')) next.category = Number(data.category || 0);
  if (Object.prototype.hasOwnProperty.call(data, 'regionCode')) next.regionCode = Number(data.regionCode || 0);
  if (Object.prototype.hasOwnProperty.call(data, 'address')) next.address = trimText(data.address);
  if (Object.prototype.hasOwnProperty.call(data, 'description')) {
    next.description = buildBossBaseDescription(normalizeBossBaseDescription(data.description));
  }

  next.updatedAt = new Date().toISOString();
  if (role === 'boss') {
    next.auditStatus = 0;
  }

  const docId = next._id;
  delete next._id;
  await getCollection('bases').doc(docId).update({ data: next });
  return normalizeBaseRecord(next);
}

function normalizeJobRecord(job = {}) {
  return {
    id: Number(job.id || 0),
    baseId: Number(job.baseId || 0),
    jobTitle: job.jobTitle || '',
    workAddress: job.workAddress || '',
    recruitCount: Number(job.recruitCount || 0),
    workHours: job.workHours || '',
    payType: Number(job.payType || 0),
    salaryAmount: toNumber(job.salaryAmount || job.unitPrice || job.hourlyRate || 0),
    requirements: job.requirements || '',
    workContent: job.workContent || '',
    benefits: job.benefits || '',
    workplaceImages: Array.isArray(job.workplaceImages) ? job.workplaceImages : [],
    validUntil: job.validUntil || '',
    workStartDate: job.workStartDate || '',
    workEndDate: job.workEndDate || '',
    status: Number(job.status || 0),
    auditStatus: Number(job.auditStatus || 0),
    isActive: job.isActive !== false,
    createdAt: job.createdAt || '',
    updatedAt: job.updatedAt || '',
  };
}

async function listJobsByBase(baseId, query = {}) {
  const res = await getCollection('jobs').where({ baseId: Number(baseId), isDeleted: _.neq(true) }).get();
  const jobs = (res.data || []).map(normalizeJobRecord);

  let filtered = jobs;
  if (!query.showAll && query.showAll !== '1' && query.showAll !== 'true') {
    filtered = filtered.filter((job) => isActiveJob(job));
  }
  if (query.status !== undefined && query.status !== '') {
    const targetStatus = Number(query.status);
    filtered = filtered.filter((job) => Number(job.status) === targetStatus);
  }

  return filtered.sort((left, right) => compareByDateDesc(left, right, ['createdAt', 'updatedAt']));
}

async function listBases(query = {}) {
  const res = await getCollection('bases').where({ isDeleted: _.neq(true) }).get();
  let bases = (res.data || []).map(normalizeBaseRecord);

  if (!query.showAll && query.showAll !== '1' && query.showAll !== 'true') {
    bases = bases.filter((base) => Number(base.auditStatus) === 1);
  }

  if (query.ownerId) {
    const ownerId = Number(query.ownerId);
    bases = bases.filter((base) => Number(base.ownerId) === ownerId);
  }

  if (query.category) {
    const category = Number(query.category);
    bases = bases.filter((base) => Number(base.category) === category);
  }

  if (query.regionCode) {
    const regionCode = Number(query.regionCode);
    bases = bases.filter((base) => Number(base.regionCode) === regionCode);
  }

  if (query.withOpenJobs === '1' || query.withOpenJobs === 'true') {
    const jobsRes = await getCollection('jobs').where({ isDeleted: _.neq(true) }).get();
    const jobs = (jobsRes.data || []).map(normalizeJobRecord).filter((job) => isActiveJob(job));
    const grouped = new Map();
    jobs.forEach((job) => {
      const existed = grouped.get(job.baseId);
      if (!existed || compareByDateDesc(job, existed, ['createdAt', 'updatedAt']) < 0) {
        grouped.set(job.baseId, job);
      }
    });

    bases = bases
      .map((base) => {
        const openJob = grouped.get(base.id);
        if (!openJob) return null;
        return Object.assign({}, base, {
          openJobId: openJob.id,
          openJobTitle: openJob.jobTitle,
          openJobRequirements: openJob.requirements,
          openJobWorkContent: openJob.workContent,
          openJobBenefits: openJob.benefits,
          openJobValidUntil: openJob.validUntil,
          openJobCreatedAt: openJob.createdAt,
          openJobWorkHours: openJob.workHours,
        });
      })
      .filter(Boolean);
  }

  return bases.sort((left, right) => compareByDateDesc(left, right, ['openJobCreatedAt', 'createdAt', 'updatedAt']));
}

async function getBaseById(baseId) {
  const base = await findOneByField('bases', 'id', Number(baseId));
  if (!base || base.isDeleted) {
    throw createHttpError(404, '基地不存在');
  }

  const normalized = normalizeBaseRecord(base);
  const jobs = await listJobsByBase(baseId, { status: '1' });
  const firstJob = jobs[0] || {};
  const meta = safeParseJson(normalized.description);
  const nextMeta = Object.assign({}, meta, {
    jobRequirement: meta.jobRequirement || meta.jobRequirements || firstJob.requirements || firstJob.workContent || '该基地当前暂无已开放岗位。',
    environmentSummary: meta.environmentSummary || meta.workEnvironment || firstJob.benefits || '基地环境信息待企业补充。',
  });

  normalized.description = JSON.stringify(nextMeta);
  return normalized;
}

async function getJobById(jobId) {
  const job = await findOneByField('jobs', 'id', Number(jobId));
  if (!job || job.isDeleted) {
    throw createHttpError(404, '岗位不存在');
  }
  return normalizeJobRecord(job);
}

function formatConflictMessage(baseName, jobTitle) {
  return `您已报名【${baseName} / ${jobTitle}】，时间冲突。如需报名此工作，请先取消原报名。`;
}

async function getOpenJobOrThrow(jobId, baseId) {
  const job = await getJobById(jobId);
  if (Number(job.baseId) !== Number(baseId)) {
    throw createHttpError(400, '岗位与基地不匹配');
  }
  if (!isActiveJob(job)) {
    throw createHttpError(400, '该岗位尚未开放报名');
  }
  return job;
}

async function signup(user, data) {
  const baseId = Number(data && data.baseId);
  const jobId = Number(data && data.jobId);
  const note = trimText(data && data.note);
  const roleKey = user.roleKey || user.role || 'worker';
  if (roleKey !== 'worker') {
    throw createHttpError(403, '只有工人账号可以报名');
  }
  if (!Number.isFinite(baseId) || !Number.isFinite(jobId) || baseId <= 0 || jobId <= 0) {
    throw createHttpError(400, '缺少报名定位参数');
  }

  const job = await getOpenJobOrThrow(jobId, baseId);
  const workDate = trimText(job.workStartDate || new Date().toISOString().slice(0, 10));
  const signups = await getAllDocuments('signups');
  const applications = await getAllDocuments('applications');

  const existingSignup = signups.find((item) =>
    !item.isDeleted
    && Number(item.userId) === Number(user.id)
    && Number(item.jobId) === jobId
    && trimText(item.workDate) === workDate
    && Number(item.status) !== 3);
  if (existingSignup) {
    return {
      id: Number(existingSignup.id || 0),
      userId: Number(existingSignup.userId || 0),
      baseId: Number(existingSignup.baseId || 0),
      jobId: Number(existingSignup.jobId || 0),
      workDate: existingSignup.workDate,
      status: Number(existingSignup.status || 0),
      duplicate: true,
    };
  }

  const conflictSignup = signups.find((item) =>
    !item.isDeleted
    && Number(item.userId) === Number(user.id)
    && trimText(item.workDate) === workDate
    && Number(item.status) !== 3
    && Number(item.jobId) !== jobId);
  if (conflictSignup) {
    const conflictJob = applications.find((item) => Number(item.jobId) === Number(conflictSignup.jobId))
      || await findOneByField('jobs', 'id', Number(conflictSignup.jobId));
    const conflictBase = await findOneByField('bases', 'id', Number(conflictSignup.baseId));
    throw createHttpError(409, formatConflictMessage(conflictBase?.baseName || '未知基地', conflictJob?.jobTitle || '未知岗位'), {
      conflictBaseId: Number(conflictSignup.baseId || 0),
      conflictBaseName: conflictBase?.baseName || '未知基地',
      conflictJobId: Number(conflictSignup.jobId || 0),
      conflictJobTitle: conflictJob?.jobTitle || '未知岗位',
      conflictWorkDate: conflictSignup.workDate || '',
      conflictWorkHours: conflictJob?.workHours || '',
    });
  }

  const signupId = await getNextNumericId('signups');
  const applicationId = await getNextNumericId('applications');
  const now = new Date().toISOString();

  const signupRecord = {
    id: signupId,
    userId: Number(user.id),
    baseId,
    jobId,
    workDate,
    status: 0,
    checkinTime: null,
    isProxy: false,
    proxyUserId: null,
    isOfflineSync: false,
    isDeleted: false,
    createdAt: now,
    updatedAt: now,
  };

  const applicationRecord = {
    id: applicationId,
    userId: Number(user.id),
    jobId,
    baseId,
    status: 0,
    note: note || '',
    rejectReason: '',
    reviewedBy: null,
    reviewedAt: null,
    workEndTime: null,
    workEndBy: null,
    workEndRecordedAt: null,
    isDeleted: false,
    createdAt: now,
    updatedAt: now,
  };

  await getCollection('signups').add({ data: signupRecord });
  await getCollection('applications').add({ data: applicationRecord });

  return {
    id: signupRecord.id,
    userId: signupRecord.userId,
    baseId: signupRecord.baseId,
    jobId: signupRecord.jobId,
    workDate: signupRecord.workDate,
    status: signupRecord.status,
    duplicate: false,
  };
}

async function cancelSignup(user, data) {
  const signupId = Number(data && data.signupId);
  const baseId = Number(data && data.baseId);
  const jobId = Number(data && data.jobId);
  const workDate = trimText(data && data.workDate);
  const signups = await getAllDocuments('signups');

  let target = null;
  if (signupId > 0) {
    target = signups.find((item) => Number(item.id) === signupId && Number(item.userId) === Number(user.id) && !item.isDeleted);
  } else {
    target = signups.find((item) =>
      Number(item.userId) === Number(user.id)
      && Number(item.baseId) === baseId
      && Number(item.jobId) === jobId
      && trimText(item.workDate) === workDate
      && !item.isDeleted
      && Number(item.status) !== 3);
  }

  if (!target) {
    throw createHttpError(404, '未找到可取消的报名记录');
  }

  target.status = 3;
  target.updatedAt = new Date().toISOString();
  const targetDocId = target._id;
  delete target._id;
  await getCollection('signups').doc(targetDocId).update({ data: target });

  const applications = await getAllDocuments('applications');
  const matched = applications.filter((item) =>
    Number(item.userId) === Number(user.id)
    && Number(item.baseId) === Number(target.baseId)
    && Number(item.jobId) === Number(target.jobId)
    && !item.isDeleted
    && Number(item.status) !== 3);

  for (let i = 0; i < matched.length; i += 1) {
    const application = matched[i];
    application.status = 3;
    application.updatedAt = new Date().toISOString();
    const applicationDocId = application._id;
    delete application._id;
    await getCollection('applications').doc(applicationDocId).update({ data: application });
  }

  return {
    ok: true,
    signupId: Number(target.id || 0),
    baseId: Number(target.baseId || 0),
    jobId: Number(target.jobId || 0),
    workDate: target.workDate || '',
    status: 3,
  };
}

async function getMyApplications(user) {
  const applications = await getAllDocuments('applications');
  const bases = await getAllDocuments('bases');
  const jobs = await getAllDocuments('jobs');
  const signups = await getAllDocuments('signups');

  const filtered = applications
    .filter((item) => Number(item.userId) === Number(user.id) && !item.isDeleted)
    .sort((left, right) => compareByDateDesc(left, right, ['createdAt', 'updatedAt']));

  return filtered.map((item) => {
    const base = bases.find((baseItem) => Number(baseItem.id) === Number(item.baseId)) || {};
    const job = jobs.find((jobItem) => Number(jobItem.id) === Number(item.jobId)) || {};
    const signup = signups.find((signupItem) =>
      Number(signupItem.userId) === Number(item.userId)
      && Number(signupItem.baseId) === Number(item.baseId)
      && Number(signupItem.jobId) === Number(item.jobId)
      && Number(signupItem.status) !== 3) || {};

    return {
      id: Number(item.id || 0),
      userId: Number(item.userId || 0),
      baseId: Number(item.baseId || 0),
      jobId: Number(item.jobId || 0),
      status: Number(item.status || 0),
      note: item.note || '',
      rejectReason: item.rejectReason || '',
      createdAt: item.createdAt || '',
      updatedAt: item.updatedAt || '',
      workDate: signup.workDate || job.workStartDate || '',
      checkinTime: signup.checkinTime || null,
      baseName: base.baseName || '未知基地',
      jobTitle: job.jobTitle || '未命名岗位',
    };
  });
}

async function getApplicationsByBase(baseId, query = {}) {
  const targetBaseId = Number(baseId);
  const applications = await getAllDocuments('applications');
  const bases = await getAllDocuments('bases');
  const jobs = await getAllDocuments('jobs');
  const users = await getAllDocuments('users');
  const signups = await getAllDocuments('signups');
  const statusFilter = query.status !== undefined && query.status !== '' ? Number(query.status) : null;

  return applications
    .filter((item) =>
      Number(item.baseId) === targetBaseId
      && !item.isDeleted
      && (statusFilter == null || Number(item.status) === statusFilter))
    .sort((left, right) => compareByDateDesc(left, right, ['createdAt', 'updatedAt']))
    .map((item) => {
      const base = bases.find((baseItem) => Number(baseItem.id) === Number(item.baseId)) || {};
      const job = jobs.find((jobItem) => Number(jobItem.id) === Number(item.jobId)) || {};
      const user = users.find((userItem) => Number(userItem.id) === Number(item.userId)) || {};
      const signup = signups.find((signupItem) =>
        Number(signupItem.userId) === Number(item.userId)
        && Number(signupItem.baseId) === Number(item.baseId)
        && Number(signupItem.jobId) === Number(item.jobId)
        && Number(signupItem.status) !== 3) || {};

      return {
        id: Number(item.id || 0),
        userId: Number(item.userId || 0),
        baseId: Number(item.baseId || 0),
        jobId: Number(item.jobId || 0),
        status: Number(item.status || 0),
        note: item.note || '',
        rejectReason: item.rejectReason || '',
        createdAt: item.createdAt || '',
        updatedAt: item.updatedAt || '',
        reviewedAt: item.reviewedAt || null,
        workDate: signup.workDate || job.workStartDate || '',
        checkinTime: signup.checkinTime || null,
        baseName: base.baseName || '未知基地',
        jobTitle: job.jobTitle || '未命名岗位',
        user: {
          id: Number(user.id || 0),
          uid: user.uid || '',
          name: user.name || '',
          phone: user.phone || '',
          idCard: user.idCard || '',
          faceImgUrl: user.faceImgUrl || '',
        },
      };
    });
}

async function reviewBaseApplication(applicationId, data = {}) {
  const applications = await getAllDocuments('applications');
  const target = applications.find((item) => Number(item.id) === Number(applicationId));
  if (!target || target.isDeleted) {
    throw createHttpError(404, '报名记录不存在');
  }

  const status = Number(data.status);
  if (![1, 2].includes(status)) {
    throw createHttpError(400, '审核状态无效');
  }

  target.status = status;
  target.rejectReason = status === 2 ? trimText(data.rejectReason || data.reason) : '';
  target.reviewedAt = new Date().toISOString();
  target.updatedAt = new Date().toISOString();
  const docId = target._id;
  delete target._id;
  await getCollection('applications').doc(docId).update({ data: target });
  return {
    ok: true,
    id: Number(applicationId),
    status,
  };
}

async function saveBaseNotice(baseId, data = {}) {
  const id = await getNextNumericId('baseNotices');
  const payload = {
    id,
    baseId: Number(baseId),
    date: trimText(data.date),
    time: trimText(data.time),
    location: trimText(data.location),
    contactName: trimText(data.contactName),
    contactPhone: trimText(data.contactPhone),
    remark: trimText(data.remark),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (!payload.date || !payload.time || !payload.location) {
    throw createHttpError(400, '请完整填写集合日期、时间和地点');
  }

  await getCollection('baseNotices').add({ data: payload });
  return {
    ok: true,
    id,
  };
}

async function listBaseNotices(baseId) {
  const res = await getCollection('baseNotices').where({
    baseId: Number(baseId),
    isDeleted: _.neq(true),
  }).get();
  const list = Array.isArray(res.data) ? res.data : [];
  return list.sort((left, right) => compareByDateDesc(left, right, ['createdAt', 'updatedAt']));
}

async function getWorkerAttendanceRecords(user, query = {}) {
  const signups = await getAllDocuments('signups');
  const bases = await getAllDocuments('bases');
  const jobs = await getAllDocuments('jobs');
  const limit = query.limit ? Number(query.limit) : 50;

  return signups
    .filter((item) => Number(item.userId) === Number(user.id) && !item.isDeleted)
    .sort((left, right) => compareByDateDesc(left, right, ['workDate', 'createdAt', 'updatedAt']))
    .slice(0, Number.isFinite(limit) && limit > 0 ? limit : 50)
    .map((item) => {
      const base = bases.find((baseItem) => Number(baseItem.id) === Number(item.baseId)) || {};
      const job = jobs.find((jobItem) => Number(jobItem.id) === Number(item.jobId)) || {};
      return {
        id: Number(item.id || 0),
        userId: Number(item.userId || 0),
        baseId: Number(item.baseId || 0),
        jobId: Number(item.jobId || 0),
        workDate: item.workDate || '',
        checkinTime: item.checkinTime || null,
        status: Number(item.status || 0),
        baseName: base.baseName || '未知基地',
        jobTitle: job.jobTitle || '未命名岗位',
        workHours: job.workHours || '',
        totalAmount: null,
      };
    });
}

async function getManagedBases(user) {
  const role = user.roleKey || user.role || 'worker';
  if (!['base_manager', 'field_manager', 'super_admin', 'region_admin', 'boss'].includes(role)) {
    throw createHttpError(403, '当前角色无权查看管理基地');
  }

  const bases = await listBases({ showAll: 'true' });
  if (role === 'boss') {
    return bases.filter((item) => Number(item.ownerId) === Number(user.id));
  }

  if (role === 'field_manager' && user.assignedBaseId) {
    return bases.filter((item) => Number(item.id) === Number(user.assignedBaseId));
  }

  return bases;
}

async function getAttendanceRecords(query = {}) {
  const signups = await getAllDocuments('signups');
  const bases = await getAllDocuments('bases');
  const jobs = await getAllDocuments('jobs');
  const users = await getAllDocuments('users');
  const targetBaseId = query.baseId ? Number(query.baseId) : null;
  const targetDate = trimText(query.date);

  return signups
    .filter((item) =>
      !item.isDeleted
      && (targetBaseId == null || Number(item.baseId) === targetBaseId)
      && (!targetDate || trimText(item.workDate) === targetDate))
    .sort((left, right) => compareByDateDesc(left, right, ['checkinTime', 'createdAt', 'updatedAt']))
    .map((item) => {
      const base = bases.find((baseItem) => Number(baseItem.id) === Number(item.baseId)) || {};
      const job = jobs.find((jobItem) => Number(jobItem.id) === Number(item.jobId)) || {};
      const worker = users.find((userItem) => Number(userItem.id) === Number(item.userId)) || {};
      return {
        id: Number(item.id || 0),
        signupId: Number(item.id || 0),
        userId: Number(item.userId || 0),
        baseId: Number(item.baseId || 0),
        jobId: Number(item.jobId || 0),
        workDate: item.workDate || '',
        status: Number(item.status || 0),
        checkinTime: item.checkinTime || null,
        createdAt: item.createdAt || '',
        baseName: base.baseName || '未知基地',
        jobTitle: job.jobTitle || '未命名岗位',
        workerName: worker.name || '未知工人',
        workerUid: worker.uid || '-',
        workerPhone: worker.phone || '-',
        workerIdCard: worker.idCard || '-',
        user: {
          id: Number(worker.id || 0),
          uid: worker.uid || '',
          name: worker.name || '',
          phone: worker.phone || '',
          idCard: worker.idCard || '',
        },
      };
    });
}

async function getAttendanceStats(query = {}) {
  const records = await getAttendanceRecords(query);
  const checkedIn = records.filter((item) => Number(item.status) === 1).length;
  const absent = records.filter((item) => Number(item.status) === 2).length;
  const signedUp = records.filter((item) => Number(item.status) === 0).length;
  const total = records.length;
  return {
    checkedIn,
    present: checkedIn,
    absent,
    pending: signedUp,
    total,
    attendanceRate: total > 0 ? Number(((checkedIn / total) * 100).toFixed(2)) : 0,
  };
}

async function getAttendanceBaseStats(query = {}) {
  const date = trimText(query.date);
  const records = await getAttendanceRecords({ date });
  const grouped = {};

  records.forEach((item) => {
    const key = String(item.baseId || 0);
    if (!grouped[key]) {
      grouped[key] = {
        baseId: Number(item.baseId || 0),
        baseName: item.baseName || '未知基地',
        present: 0,
        total: 0,
      };
    }
    grouped[key].total += 1;
    if (Number(item.status) === 1) grouped[key].present += 1;
  });

  const bases = Object.keys(grouped).map((key) => {
    const row = grouped[key];
    return Object.assign({}, row, {
      attendanceRate: row.total > 0 ? Number(((row.present / row.total) * 100).toFixed(2)) : 0,
    });
  });

  return { date, bases };
}

async function getPendingWorkers(query = {}) {
  const targetBaseId = query.baseId ? Number(query.baseId) : null;
  const targetDate = trimText(query.date);
  const applications = await getAllDocuments('applications');
  const users = await getAllDocuments('users');
  const jobs = await getAllDocuments('jobs');

  return applications
    .filter((item) =>
      !item.isDeleted
      && Number(item.status) === 1
      && (targetBaseId == null || Number(item.baseId) === targetBaseId))
    .map((item) => {
      const user = users.find((row) => Number(row.id) === Number(item.userId)) || {};
      const job = jobs.find((row) => Number(row.id) === Number(item.jobId)) || {};
      return {
        id: Number(item.id || 0),
        userId: Number(item.userId || 0),
        baseId: Number(item.baseId || 0),
        jobId: Number(item.jobId || 0),
        workDate: targetDate || item.workDate || job.workStartDate || '',
        workerName: user.name || '未知工人',
        workerUid: user.uid || '-',
        workerPhone: user.phone || '-',
        jobTitle: job.jobTitle || '-',
        createdAt: item.createdAt || '',
      };
    });
}

async function exportAttendanceRecords(query = {}) {
  const records = await getAttendanceRecords(query);
  return {
    fileName: `attendance-${trimText(query.date) || 'today'}.xlsx`,
    total: records.length,
    fileBase64: buildXlsxBase64(
      ['序号', '工人姓名', '工人UID', '手机号', '岗位', '基地', '工作日期', '签到状态', '签到时间'],
      records.map((item, index) => ([
        index + 1,
        item.workerName || '-',
        item.workerUid || '-',
        item.workerPhone || '-',
        item.jobTitle || '-',
        item.baseName || '-',
        item.workDate || '-',
        Number(item.status) === 1 ? '已签到' : Number(item.status) === 0 ? '待签到' : Number(item.status) === 2 ? '缺勤' : '其他',
        item.checkinTime || '',
      ])),
    ),
  };
}

async function exportAttendanceBaseStats(query = {}) {
  const stats = await getAttendanceBaseStats(query);
  const bases = Array.isArray(stats.bases) ? stats.bases : [];
  return {
    fileName: `attendance-base-stats-${trimText(query.date) || 'today'}.xlsx`,
    total: bases.length,
    fileBase64: buildXlsxBase64(
      ['序号', '基地名称', '已签到', '应到人数', '出勤率'],
      bases.map((item, index) => ([
        index + 1,
        item.baseName || '-',
        Number(item.present || 0),
        Number(item.total || 0),
        `${Number(item.attendanceRate || 0).toFixed(2)}%`,
      ])),
    ),
  };
}

async function checkin(user, data) {
  const role = user.roleKey || user.role || 'worker';
  if (!['field_manager', 'base_manager', 'super_admin', 'region_admin'].includes(role)) {
    throw createHttpError(403, '当前角色无权签到');
  }

  const qrContent = trimText(data && data.qrContent);
  const baseId = Number(data && data.baseId);
  if (!qrContent || !baseId) {
    throw createHttpError(400, '缺少签到参数');
  }

  const match = qrContent.match(/^PICKPASS\|([^|]+)\|(.+)$/);
  if (!match) {
    throw createHttpError(400, '二维码内容无效');
  }

  const uid = trimText(match[1]);
  const worker = await findOneByField('users', 'uid', uid);
  if (!worker || worker.isDeleted) {
    throw createHttpError(404, '未找到工人信息');
  }

  const signups = await getAllDocuments('signups');
  const target = signups.find((item) =>
    Number(item.userId) === Number(worker.id)
    && Number(item.baseId) === Number(baseId)
    && Number(item.status) === 0);

  if (!target) {
    throw createHttpError(404, '未找到待签到报名记录');
  }

  target.status = 1;
  target.checkinTime = new Date().toISOString();
  target.updatedAt = new Date().toISOString();
  const docId = target._id;
  delete target._id;
  await getCollection('signups').doc(docId).update({ data: target });

  return {
    user: {
      id: Number(worker.id || 0),
      uid: worker.uid || '',
      name: worker.name || '',
    },
    workerName: worker.name || '',
    checkinTime: target.checkinTime,
  };
}

async function getWorkerPendingSalaryList(user) {
  const collection = getCollection('workerSalaries');
  const res = await collection.where({
    userId: Number(user.id),
  }).get();
  const list = Array.isArray(res.data) ? res.data : [];
  return list
    .filter((item) => Number(item.status) !== 2)
    .sort((left, right) => compareByDateDesc(left, right, ['workDate', 'createdAt', 'updatedAt']));
}

async function getWorkerSalaryStats(user) {
  const list = await getWorkerPendingSalaryList(user);
  let totalEarned = 0;
  let pendingAmount = 0;

  list.forEach((item) => {
    const amount = toNumber(item.totalAmount, 0);
    totalEarned += amount;
    if (Number(item.status) === 0) pendingAmount += amount;
  });

  return {
    totalDays: list.length,
    totalEarned: Number(totalEarned.toFixed(2)),
    pendingAmount: Number(pendingAmount.toFixed(2)),
  };
}

async function getWorkerSalaryDetail(user, salaryId) {
  const res = await getCollection('workerSalaries').where({
    id: Number(salaryId),
    userId: Number(user.id),
  }).limit(1).get();
  const item = Array.isArray(res.data) && res.data.length ? res.data[0] : null;
  if (!item) {
    throw createHttpError(404, '工资记录不存在');
  }
  return item;
}

async function confirmWorkerSalary(user, salaryId) {
  const item = await getWorkerSalaryDetail(user, salaryId);
  item.status = 1;
  item.updatedAt = new Date().toISOString();
  const docId = item._id;
  delete item._id;
  await getCollection('workerSalaries').doc(docId).update({ data: item });
  return { ok: true, id: Number(salaryId), status: 1 };
}

async function appealWorkerSalary(user, salaryId, data) {
  const item = await getWorkerSalaryDetail(user, salaryId);
  const reason = trimText(data && data.reason);
  const expectedAmount = trimText(data && data.expectedAmount);
  if (!reason || reason.length < 10) {
    throw createHttpError(400, '申诉原因至少10个字');
  }

  item.workerAppealStatus = 1;
  item.workerAppealReason = reason;
  item.workerExpectedAmount = expectedAmount ? Number(expectedAmount) : null;
  item.workerAppealedAt = new Date().toISOString();
  item.updatedAt = new Date().toISOString();
  const docId = item._id;
  delete item._id;
  await getCollection('workerSalaries').doc(docId).update({ data: item });
  return { ok: true, id: Number(salaryId), appealed: true };
}

async function getWorkerSalaryPayment(user, salaryId) {
  const item = await getWorkerSalaryDetail(user, salaryId);
  return {
    status: Number(item.status || 0),
    totalAmount: Number(item.totalAmount || 0),
    confirmedTime: item.updatedAt || item.createdAt || '',
    paidTime: item.paidTime || '',
    estimatedArrival: item.estimatedArrival || '1-3个工作日',
    bankCard: item.bankCard || '',
    payoutType: item.payoutType || 0,
  };
}

async function createSalaryDraft(data = {}) {
  const id = await getNextNumericId('workerSalaries');
  const payload = {
    id,
    userId: Number(data.userId || 0),
    workerUid: trimText(data.workerUid),
    workerName: trimText(data.workerName),
    baseId: Number(data.baseId || 0),
    baseName: trimText(data.baseName),
    jobId: Number(data.jobId || 0),
    jobTitle: trimText(data.jobTitle),
    workDate: trimText(data.workDate),
    payType: Number(data.payType || 1),
    workDuration: Number(data.workDuration || 0),
    pieceCount: Number(data.pieceCount || 0),
    unitPriceSnapshot: Number(data.unitPriceSnapshot || 0),
    totalAmount: Number(data.totalAmount || 0),
    status: 0,
    payoutType: 0,
    bankCard: trimText(data.bankCard),
    paidTime: '',
    workerAppealStatus: 0,
    workerAppealReason: '',
    workerExpectedAmount: null,
    workerAppealedAt: '',
    appealReply: '',
    appealHandledAt: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await getCollection('workerSalaries').add({ data: payload });
  return { ok: true, id };
}

async function calculateSalaryFromSignup(signupId, data = {}) {
  const signup = await findOneByField('signups', 'id', Number(signupId));
  if (!signup || signup.isDeleted) {
    throw createHttpError(404, '报名记录不存在');
  }
  if (Number(signup.status) !== 1) {
    throw createHttpError(400, 'not_checked_in');
  }

  const existed = await getCollection('workerSalaries').where({
    userId: Number(signup.userId),
    baseId: Number(signup.baseId),
    jobId: Number(signup.jobId),
    workDate: trimText(signup.workDate),
  }).limit(1).get();

  if (Array.isArray(existed.data) && existed.data.length) {
    return { ok: true, id: Number(existed.data[0].id || 0), duplicate: true };
  }

  const user = await findOneByField('users', 'id', Number(signup.userId));
  const base = await findOneByField('bases', 'id', Number(signup.baseId));
  const job = await findOneByField('jobs', 'id', Number(signup.jobId));
  if (!job) {
    throw createHttpError(404, '岗位不存在');
  }

  const payType = Number(job.payType || 1);
  const duration = Number(data.duration || 0);
  const count = Number(data.count || 0);
  let unitPriceSnapshot = 0;
  let totalAmount = 0;
  let workDuration = 0;
  let pieceCount = 0;

  if (payType === 2) {
    unitPriceSnapshot = Number(job.hourlyRate || job.salaryAmount || 0);
    workDuration = duration > 0 ? duration : 8;
    totalAmount = unitPriceSnapshot * workDuration;
  } else if (payType === 3) {
    unitPriceSnapshot = Number(job.unitPrice || job.salaryAmount || 0);
    pieceCount = count > 0 ? count : Number(job.targetCount || 1);
    totalAmount = unitPriceSnapshot * pieceCount;
  } else {
    unitPriceSnapshot = Number(job.salaryAmount || 0);
    totalAmount = unitPriceSnapshot;
  }

  return createSalaryDraft({
    userId: Number(signup.userId),
    workerUid: user?.uid || '',
    workerName: user?.name || '',
    baseId: Number(signup.baseId),
    baseName: base?.baseName || '',
    jobId: Number(signup.jobId),
    jobTitle: job?.jobTitle || '',
    workDate: signup.workDate || '',
    payType,
    workDuration,
    pieceCount,
    unitPriceSnapshot,
    totalAmount: Number(totalAmount.toFixed(2)),
    bankCard: user?.bankCardNo || '',
  });
}

async function adjustSalaryAppeal(salaryId, data = {}) {
  const res = await getCollection('workerSalaries').where({
    id: Number(salaryId),
  }).limit(1).get();
  const item = Array.isArray(res.data) && res.data.length ? res.data[0] : null;
  if (!item) {
    throw createHttpError(404, '工资记录不存在');
  }

  const action = trimText(data.action || 'adjust');
  const reply = trimText(data.reply);
  if (!reply) {
    throw createHttpError(400, '请填写处理说明');
  }

  if (action === 'reject') {
    item.workerAppealStatus = 3;
    item.appealReply = reply;
  } else {
    const duration = trimText(data.duration);
    const count = trimText(data.count);
    const totalAmount = trimText(data.totalAmount);

    if (duration) item.workDuration = Number(duration);
    if (count) item.pieceCount = Number(count);
    if (totalAmount) item.totalAmount = Number(totalAmount);

    item.status = 0;
    item.workerAppealStatus = 2;
    item.appealReply = reply;
  }

  item.appealHandledAt = new Date().toISOString();
  item.updatedAt = item.appealHandledAt;
  const docId = item._id;
  delete item._id;
  await getCollection('workerSalaries').doc(docId).update({ data: item });
  return { ok: true, id: Number(salaryId), action };
}

async function settleSalary(salaryId, data = {}) {
  const res = await getCollection('workerSalaries').where({
    id: Number(salaryId),
  }).limit(1).get();
  const item = Array.isArray(res.data) && res.data.length ? res.data[0] : null;
  if (!item) {
    throw createHttpError(404, '工资记录不存在');
  }

  item.status = 2;
  item.payoutType = data.paymentMethod === 'cash' ? 1 : 2;
  item.paidTime = new Date().toISOString();
  item.updatedAt = item.paidTime;
  const docId = item._id;
  delete item._id;
  await getCollection('workerSalaries').doc(docId).update({ data: item });
  return { ok: true, id: Number(salaryId), status: 2 };
}

async function completeWorklog(data = {}) {
  const id = await getNextNumericId('workArchives');
  const payload = {
    id,
    userId: Number(data.userId || 0),
    name: trimText(data.name),
    phone: trimText(data.phone),
    baseName: trimText(data.baseName),
    jobTitle: trimText(data.jobTitle),
    idCard: trimText(data.idCard).toUpperCase(),
    workStartDate: trimText(data.workStartDate),
    workEndDate: trimText(data.workEndDate),
    totalAmount: Number(data.totalAmount || 0),
    salaryStatus: trimText(data.salaryStatus) || 'pending',
    completedAt: new Date().toISOString(),
    remark: trimText(data.remark),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await getCollection('workArchives').add({ data: payload });
  return { ok: true, id };
}

async function listWorkArchives(query = {}) {
  const userId = query.userId ? Number(query.userId) : null;
  const res = await getCollection('workArchives').get();
  let list = Array.isArray(res.data) ? res.data : [];
  if (userId != null) {
    list = list.filter((item) => Number(item.userId) === userId);
  }
  return list.sort((left, right) => compareByDateDesc(left, right, ['completedAt', 'createdAt', 'updatedAt']));
}

async function listOperationLogs() {
  const res = await getCollection('operationLogs').get();
  const list = Array.isArray(res.data) ? res.data : [];
  return {
    list: list.sort((left, right) => compareByDateDesc(left, right, ['createdAt', 'updatedAt'])).slice(0, 20),
    total: list.length,
  };
}

async function listUsers(query = {}) {
  const users = await getAllDocuments('users');
  const role = trimText(query.role);
  const status = query.status !== undefined && query.status !== '' ? Number(query.status) : null;
  const keyword = trimText(query.keyword).toLowerCase();

  let list = users.filter((item) => !item.isDeleted);
  if (role) {
    list = list.filter((item) => String(item.roleKey || item.role || '') === role);
  }
  if (status != null) {
    list = list.filter((item) => Number(item.infoAuditStatus || 0) === status);
  }
  if (keyword) {
    list = list.filter((item) =>
      String(item.name || '').toLowerCase().includes(keyword)
      || String(item.uid || '').toLowerCase().includes(keyword)
      || String(item.phone || '').toLowerCase().includes(keyword));
  }

  return {
    list: list.sort((left, right) => compareByDateDesc(left, right, ['createdAt', 'updatedAt'])),
    total: list.length,
  };
}

async function getUserStats() {
  const users = (await getAllDocuments('users')).filter((item) => !item.isDeleted);
  const stats = {
    total: users.length,
    worker: 0,
    boss: 0,
    base_manager: 0,
    field_manager: 0,
    super_admin: 0,
    pending: 0,
  };
  users.forEach((item) => {
    const roleKey = String(item.roleKey || item.role || 'worker');
    if (Object.prototype.hasOwnProperty.call(stats, roleKey)) {
      stats[roleKey] += 1;
    }
    if (Number(item.infoAuditStatus || 0) === 0) stats.pending += 1;
  });
  return stats;
}

async function auditBase(baseId, data) {
  const base = await findOneByField('bases', 'id', Number(baseId));
  if (!base || base.isDeleted) {
    throw createHttpError(404, '基地不存在');
  }
  base.auditStatus = Number(data && data.status);
  base.updatedAt = new Date().toISOString();
  const docId = base._id;
  delete base._id;
  await getCollection('bases').doc(docId).update({ data: base });
  return base;
}

async function auditUser(userId, data) {
  const user = await findOneByField('users', 'id', Number(userId));
  if (!user || user.isDeleted) {
    throw createHttpError(404, '用户不存在');
  }
  const status = Number(data && data.status);
  if (![1, 2].includes(status)) {
    throw createHttpError(400, '审核状态无效');
  }
  user.infoAuditStatus = status;
  user.updatedAt = new Date().toISOString();
  const docId = user._id;
  delete user._id;
  await getCollection('users').doc(docId).update({ data: user });
  return user;
}

async function getBaseCooperations(baseId) {
  const res = await getCollection('cooperations').where({
    baseId: Number(baseId),
    isDeleted: _.neq(true),
  }).get();
  return Array.isArray(res.data) ? res.data : [];
}

async function listSalaryRecords(query = {}) {
  const baseId = query.baseId ? Number(query.baseId) : null;
  const dateFrom = trimText(query.dateFrom);
  const dateTo = trimText(query.dateTo);
  const res = await getCollection('workerSalaries').get();
  let list = Array.isArray(res.data) ? res.data : [];

  if (baseId != null) {
    list = list.filter((item) => Number(item.baseId) === baseId);
  }
  if (dateFrom) {
    list = list.filter((item) => trimText(item.workDate) >= dateFrom);
  }
  if (dateTo) {
    list = list.filter((item) => trimText(item.workDate) <= dateTo);
  }

  return {
    list: list.sort((left, right) => compareByDateDesc(left, right, ['workDate', 'createdAt', 'updatedAt'])),
    total: list.length,
  };
}

async function listSubmittedSalaryReports(query = {}) {
  const res = await getCollection('salaryReports').get();
  let list = Array.isArray(res.data) ? res.data : [];
  const baseId = query.baseId ? String(query.baseId) : '';
  const keyword = trimText(query.keyword).toLowerCase();
  const dateFrom = trimText(query.dateFrom);
  const dateTo = trimText(query.dateTo);

  if (baseId) {
    list = list.filter((item) => String(item.baseId || '') === baseId);
  }
  if (keyword) {
    list = list.filter((item) =>
      String(item.baseName || '').toLowerCase().includes(keyword)
      || String(item.bossName || '').toLowerCase().includes(keyword)
      || String(item.fileName || '').toLowerCase().includes(keyword));
  }
  if (dateFrom) {
    list = list.filter((item) => trimText(item.dateFrom) >= dateFrom);
  }
  if (dateTo) {
    list = list.filter((item) => trimText(item.dateTo) <= dateTo);
  }

  return list.sort((left, right) => compareByDateDesc(left, right, ['createdAt', 'updatedAt']));
}

async function getSalaryReportDetail(reportId) {
  const report = await findOneByField('salaryReports', 'id', Number(reportId));
  if (!report) {
    throw createHttpError(404, '工资报表不存在');
  }
  return report;
}

async function submitSalaryReport(data = {}) {
  const baseId = Number(data.baseId || 0);
  const dateFrom = trimText(data.dateFrom);
  const dateTo = trimText(data.dateTo);
  if (!baseId) throw createHttpError(400, '缺少基地ID');
  if (!dateFrom || !dateTo) throw createHttpError(400, '缺少工资周期');

  const base = await findOneByField('bases', 'id', baseId);
  if (!base) {
    throw createHttpError(404, '基地不存在');
  }

  const salaryRes = await listSalaryRecords({ baseId, dateFrom, dateTo });
  const salaryRows = Array.isArray(salaryRes.list) ? salaryRes.list : [];
  const users = await getAllDocuments('users');
  const boss = users.find((item) => Number(item.id) === Number(base.ownerId)) || {};
  const now = new Date().toISOString();

  const rows = salaryRows.map((item, index) => {
    const worker = users.find((user) => Number(user.id) === Number(item.userId)) || {};
    return {
      serial: index + 1,
      salaryId: Number(item.id || 0),
      userId: Number(item.userId || 0),
      name: worker.name || item.workerName || '-',
      gender: worker.gender || '-',
      idCard: worker.idCard || '-',
      address: worker.homeAddress || '-',
      poorHousehold: worker.isPoorHousehold ? '是' : '否',
      totalIncome: Number(item.totalAmount || 0),
      signature: '',
      workDate: item.workDate || '',
      jobTitle: item.jobTitle || '',
    };
  });

  const totalIncome = rows.reduce((sum, item) => sum + Number(item.totalIncome || 0), 0);
  const workerCount = new Set(rows.map((item) => Number(item.userId || 0)).filter((id) => id > 0)).size;
  const fileName = `salary-report-${baseId}-${dateFrom}-${dateTo}.xlsx`;

  const reportCollection = getCollection('salaryReports');
  const existed = await reportCollection.where({
    baseId,
    dateFrom,
    dateTo,
  }).limit(1).get();

  const payload = {
    baseId,
    baseName: base.baseName || '',
    bossName: boss.name || boss.companyName || '-',
    fileName,
    dateFrom,
    dateTo,
    workerCount,
    salaryRecordCount: rows.length,
    totalIncome: Number(totalIncome.toFixed(2)),
    rows,
    updatedAt: now,
  };

  if (Array.isArray(existed.data) && existed.data.length) {
    const doc = existed.data[0];
    payload.id = Number(doc.id || 0);
    payload.createdAt = doc.createdAt || now;
    await reportCollection.doc(doc._id).update({ data: payload });
    return payload;
  }

  const id = await getNextNumericId('salaryReports');
  payload.id = id;
  payload.createdAt = now;
  await reportCollection.add({ data: payload });
  return payload;
}

async function exportSalaryReport(reportId) {
  const report = await getSalaryReportDetail(reportId);
  const rows = Array.isArray(report.rows) ? report.rows : [];
  return {
    fileName: report.fileName || `salary-report-${reportId}.xlsx`,
    total: rows.length,
    fileBase64: buildXlsxBase64(
      ['序号', '姓名', '性别', '身份证号', '家庭住址', '是否脱贫户', '本次工资', '岗位', '工作日期', '签字'],
      rows.map((item) => ([
        Number(item.serial || 0),
        item.name || '-',
        item.gender || '-',
        item.idCard || '-',
        item.address || '-',
        item.poorHousehold || '-',
        Number(item.totalIncome || 0).toFixed(2),
        item.jobTitle || '-',
        item.workDate || '-',
        item.signature || '',
      ])),
    ),
  };
}

async function getAttendanceQrCode(user) {
  const issuedAt = new Date().toISOString();
  const content = `PICKPASS|${user.uid}|${issuedAt}`;
  const qrImageBase64 = await QRCode.toDataURL(content, {
    errorCorrectionLevel: 'H',
    margin: 2,
    width: 300,
  });

  return {
    content,
    validDuration: '24h',
    qrImageBase64,
    lastCheckinTime: null,
    checkedIn: false,
    checkinStatus: 'not_checked_in',
  };
}

// Policies are now stored in CloudBase collection 'policies'
// Use listPolicies() and getPolicyDetail() to read from the database

// Training courses are now stored in CloudBase collection 'trainingCourses'
// Use listTrainingCourses() and getTrainingCourseDetail() to read from the database

async function listPolicies(query = {}) {
  const collection = getCollection('policies');
  let dbQuery = collection.where({ isDeleted: { $ne: true } });

  const category = Number(query.category || 0);
  if (category > 0) {
    const categoryMap = {
      1: '就业补贴',
      2: '培训补贴',
      3: '创业扶持',
      4: '社保政策',
    };
    const catName = categoryMap[category];
    if (catName) {
      dbQuery = dbQuery.where({ category: catName });
    }
  }

  const keyword = trimText(query.keyword).toLowerCase();
  if (keyword) {
    const res = await dbQuery.get();
    const list = Array.isArray(res.data) ? res.data : [];
    return list.filter((item) =>
      String(item.title).toLowerCase().includes(keyword)
      || String(item.summary).toLowerCase().includes(keyword)
      || String(item.content).toLowerCase().includes(keyword));
  }

  const res = await dbQuery.orderBy('publishDate', 'desc').get();
  return Array.isArray(res.data) ? res.data : [];
}

async function getPolicyDetail(policyId) {
  if (!policyId) return null;
  try {
    const res = await getCollection('policies').where({ _id: policyId, isDeleted: _.neq(true) }).limit(1).get();
    if (Array.isArray(res.data) && res.data.length) return res.data[0];
  } catch (e) {
    console.error('getPolicyDetail error:', e);
  }
  try {
    const res = await getCollection('policies').where({ id: Number(policyId), isDeleted: _.neq(true) }).limit(1).get();
    if (Array.isArray(res.data) && res.data.length) return res.data[0];
  } catch (e) {
    console.error('getPolicyDetail fallback error:', e);
  }
  return null;
}

async function listTrainingCourses(query = {}) {
  const collection = getCollection('trainingCourses');
  let dbQuery = collection.where({ isDeleted: { $ne: true } });

  const category = Number(query.category || 0);
  if (category > 0) {
    const categoryMap = {
      1: '采摘技能',
      2: '安全培训',
      3: '职业素养',
    };
    const catName = categoryMap[category];
    if (catName) {
      dbQuery = dbQuery.where({ category: catName });
    }
  }

  const res = await dbQuery.orderBy('startTime', 'desc').get();
  return Array.isArray(res.data) ? res.data : [];
}

async function enrollTrainingCourse(user, courseId) {
  const collection = getCollection('trainingEnrollments');
  const existing = await collection.where({
    userId: Number(user.id),
    courseId: Number(courseId),
  }).limit(1).get();

  if (Array.isArray(existing.data) && existing.data.length) {
    return { ok: true, enrolled: true, duplicate: true };
  }

  await collection.add({
    data: {
      userId: Number(user.id),
      courseId: Number(courseId),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  });

  return { ok: true, enrolled: true };
}

async function getTrainingCourseDetail(user, courseId) {
  if (!courseId) throw createHttpError(400, '课程ID不能为空');

  let course = null;
  try {
    const res = await getCollection('trainingCourses').where({ _id: courseId, isDeleted: _.neq(true) }).limit(1).get();
    if (Array.isArray(res.data) && res.data.length) course = res.data[0];
  } catch (e) {
    console.error('getTrainingCourseDetail error:', e);
  }
  if (!course) {
    try {
      const res = await getCollection('trainingCourses').where({ id: Number(courseId), isDeleted: _.neq(true) }).limit(1).get();
      if (Array.isArray(res.data) && res.data.length) course = res.data[0];
    } catch (e) {
      console.error('getTrainingCourseDetail fallback error:', e);
    }
  }
  if (!course) {
    throw createHttpError(404, '课程不存在');
  }

  const existing = await getCollection('trainingEnrollments').where({
    userId: Number(user.id),
    courseId: Number(courseId),
  }).limit(1).get();

  return Object.assign({}, course, {
    enrolled: Array.isArray(existing.data) && existing.data.length > 0,
  });
}

async function submitPolicyApplication(user, data) {
  const name = trimText(data && data.name);
  const phone = digitsOnly(data && data.phone).slice(0, 11);
  const idCard = trimText(data && data.idCard).toUpperCase();
  const reason = trimText(data && data.reason);
  const policyId = Number(data && data.policyId);

  if (!policyId) throw createHttpError(400, '缺少政策ID');
  if (!name) throw createHttpError(400, '请填写姓名');
  if (!/^1\d{10}$/.test(phone)) throw createHttpError(400, '请填写联系电话');
  if (!idCard) throw createHttpError(400, '请填写身份证号');
  if (!reason) throw createHttpError(400, '请填写申请理由');

  await getCollection('policyApplications').add({
    data: {
      userId: Number(user.id),
      policyId,
      name,
      phone,
      idCard,
      reason,
      status: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  });

  return { ok: true, submitted: true };
}

async function listRightsConsultations(user) {
  const res = await getCollection('rightsConsultations').where({
    userId: Number(user.id),
    isDeleted: _.neq(true),
  }).get();
  const list = Array.isArray(res.data) ? res.data : [];
  return list.sort((left, right) => compareByDateDesc(left, right, ['createdAt', 'updatedAt']));
}

async function createRightsConsultation(user, data) {
  const issueType = trimText(data && data.issueType) || 'other';
  const description = trimText(data && data.description);
  const contactPhone = trimText(data && data.contactPhone);
  const attachments = Array.isArray(data && data.attachments) ? data.attachments : [];

  if (!description || description.length < 10) {
    throw createHttpError(400, '问题描述至少10个字');
  }
  if (!contactPhone) {
    throw createHttpError(400, '请填写联系电话');
  }

  const id = await getNextNumericId('rightsConsultations');
  const record = {
    id,
    userId: Number(user.id),
    issueType,
    description,
    contactPhone,
    attachments,
    status: 0,
    reply: '',
    repliedAt: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await getCollection('rightsConsultations').add({ data: record });
  return { ok: true, id };
}

async function getRightsConsultationDetail(user, consultationId) {
  const res = await getCollection('rightsConsultations').where({
    id: Number(consultationId),
    userId: Number(user.id),
  }).limit(1).get();
  const record = Array.isArray(res.data) && res.data.length ? res.data[0] : null;
  if (!record) {
    throw createHttpError(404, '咨询记录不存在');
  }
  return record;
}

async function routeRequest(event) {
  const method = normalizeMethod(event.method);
  const { pathname, query } = parseQuery(event.url);
  const data = event.data || {};

  if (method === 'POST' && pathname === '/auth/login') {
    return login(data);
  }

  if (method === 'POST' && pathname === '/auth/wechat-login') {
    return wechatLogin(event);
  }

  if (method === 'POST' && pathname === '/user/register') {
    return registerUser(data, 'worker');
  }

  if (method === 'POST' && pathname === '/user/register/boss') {
    return registerUser(data, 'boss');
  }

  if (method === 'GET' && pathname === '/base') {
    return listBases(query);
  }

  if (method === 'POST' && pathname === '/base') {
    const user = await getCurrentUser(event);
    return createBase(user, data);
  }

  const baseJobsMatch = pathname.match(/^\/base\/(\d+)\/jobs$/);
  if (method === 'GET' && baseJobsMatch) {
    return listJobsByBase(Number(baseJobsMatch[1]), query);
  }

  const baseApplicationsMatch = pathname.match(/^\/base\/(\d+)\/applications$/);
  if (method === 'GET' && baseApplicationsMatch) {
    const user = await getCurrentUser(event);
    return getApplicationsByBase(Number(baseApplicationsMatch[1]), query, user);
  }

  const baseApplicationReviewMatch = pathname.match(/^\/base\/applications\/(\d+)\/review$/);
  if (method === 'PATCH' && baseApplicationReviewMatch) {
    return reviewBaseApplication(Number(baseApplicationReviewMatch[1]), data);
  }

  const baseNoticeMatch = pathname.match(/^\/base\/(\d+)\/notices$/);
  if (method === 'POST' && baseNoticeMatch) {
    return saveBaseNotice(Number(baseNoticeMatch[1]), data);
  }
  if (method === 'GET' && baseNoticeMatch) {
    return listBaseNotices(Number(baseNoticeMatch[1]));
  }

  const baseIdMatch = pathname.match(/^\/base\/(\d+)$/);
  if (method === 'GET' && baseIdMatch) {
    return getBaseById(Number(baseIdMatch[1]));
  }
  if (method === 'PATCH' && baseIdMatch) {
    const user = await getCurrentUser(event);
    return updateBase(user, Number(baseIdMatch[1]), data);
  }

  const baseAuditMatch = pathname.match(/^\/base\/(\d+)\/audit$/);
  if (method === 'PATCH' && baseAuditMatch) {
    return auditBase(Number(baseAuditMatch[1]), data);
  }

  const baseCoopMatch = pathname.match(/^\/base\/(\d+)\/cooperations$/);
  if (method === 'GET' && baseCoopMatch) {
    return getBaseCooperations(Number(baseCoopMatch[1]));
  }

  const jobIdMatch = pathname.match(/^\/base\/jobs\/(\d+)$/);
  if (method === 'GET' && jobIdMatch) {
    return getJobById(Number(jobIdMatch[1]));
  }

  const user = await getCurrentUser(event);

  if (method === 'GET' && pathname === '/user/profile') {
    return getProfile(user);
  }

  if (method === 'PATCH' && pathname === '/user/profile') {
    return updateProfile(user, data);
  }

  if (method === 'POST' && pathname === '/attendance/signup') {
    return signup(user, data);
  }

  if (method === 'POST' && pathname === '/attendance/signup/cancel') {
    return cancelSignup(user, data);
  }

  if (method === 'POST' && pathname === '/attendance/checkin') {
    return checkin(user, data);
  }

  if (method === 'GET' && pathname === '/base/applications/me') {
    return getMyApplications(user);
  }

  if (method === 'GET' && pathname === '/attendance/worker/records') {
    return getWorkerAttendanceRecords(user, query);
  }

  if (method === 'GET' && pathname === '/attendance/records') {
    return getAttendanceRecords(query);
  }

  if (method === 'GET' && pathname === '/attendance/stats') {
    return getAttendanceStats(query);
  }

  if (method === 'GET' && pathname === '/attendance/bases') {
    return getAttendanceBaseStats(query);
  }

  if (method === 'GET' && pathname === '/attendance/pending-workers') {
    return getPendingWorkers(query);
  }

  if (method === 'GET' && pathname === '/attendance/export/records') {
    return exportAttendanceRecords(query);
  }

  if (method === 'GET' && pathname === '/attendance/export/base-stats') {
    return exportAttendanceBaseStats(query);
  }

  if (method === 'GET' && pathname === '/attendance/qrcode') {
    return getAttendanceQrCode(user);
  }

  if (method === 'GET' && pathname === '/base/managed') {
    return getManagedBases(user);
  }

  if (method === 'GET' && pathname === '/salary/worker/stats') {
    return getWorkerSalaryStats(user);
  }

  if (method === 'GET' && pathname === '/salary/worker/pending') {
    return getWorkerPendingSalaryList(user);
  }

  if (method === 'GET' && pathname === '/salary/list') {
    return listSalaryRecords(query);
  }

  const salaryWorkerDetailMatch = pathname.match(/^\/salary\/worker\/(\d+)$/);
  if (method === 'GET' && salaryWorkerDetailMatch) {
    return getWorkerSalaryDetail(user, Number(salaryWorkerDetailMatch[1]));
  }

  const salaryWorkerConfirmMatch = pathname.match(/^\/salary\/worker\/(\d+)\/confirm$/);
  if (method === 'POST' && salaryWorkerConfirmMatch) {
    return confirmWorkerSalary(user, Number(salaryWorkerConfirmMatch[1]));
  }

  const salaryWorkerAppealMatch = pathname.match(/^\/salary\/worker\/(\d+)\/appeal$/);
  if (method === 'POST' && salaryWorkerAppealMatch) {
    return appealWorkerSalary(user, Number(salaryWorkerAppealMatch[1]), data);
  }

  const salaryWorkerPaymentMatch = pathname.match(/^\/salary\/worker\/(\d+)\/payment$/);
  if (method === 'GET' && salaryWorkerPaymentMatch) {
    return getWorkerSalaryPayment(user, Number(salaryWorkerPaymentMatch[1]));
  }

  if (method === 'GET' && pathname === '/policy/list') {
    return listPolicies(query);
  }

  if (method === 'GET' && pathname === '/salary/reports/submitted') {
    return listSubmittedSalaryReports(query);
  }

  if (method === 'POST' && pathname === '/salary/reports/submit') {
    return submitSalaryReport(data);
  }

  const salaryReportMatch = pathname.match(/^\/salary\/reports\/(\d+)$/);
  if (method === 'GET' && salaryReportMatch) {
    return getSalaryReportDetail(Number(salaryReportMatch[1]));
  }

  const salaryReportExportMatch = pathname.match(/^\/salary\/reports\/(\d+)\/export$/);
  if (method === 'GET' && salaryReportExportMatch) {
    return exportSalaryReport(Number(salaryReportExportMatch[1]));
  }

  const policyMatch = pathname.match(/^\/policy\/(\d+)$/);
  if (method === 'GET' && policyMatch) {
    return getPolicyDetail(Number(policyMatch[1]));
  }

  if (method === 'GET' && pathname === '/training/courses') {
    return listTrainingCourses(query);
  }

  const trainingDetailMatch = pathname.match(/^\/training\/courses\/(\d+)$/);
  if (method === 'GET' && trainingDetailMatch) {
    return getTrainingCourseDetail(user, Number(trainingDetailMatch[1]));
  }

  const trainingEnrollMatch = pathname.match(/^\/training\/courses\/(\d+)\/enroll$/);
  if (method === 'POST' && trainingEnrollMatch) {
    return enrollTrainingCourse(user, Number(trainingEnrollMatch[1]));
  }

  if (method === 'POST' && pathname === '/policy/applications') {
    return submitPolicyApplication(user, data);
  }

  if (method === 'GET' && pathname === '/rights/consultations') {
    return listRightsConsultations(user);
  }

  if (method === 'POST' && pathname === '/rights/consultations') {
    return createRightsConsultation(user, data);
  }

  const rightsDetailMatch = pathname.match(/^\/rights\/consultations\/(\d+)$/);
  if (method === 'GET' && rightsDetailMatch) {
    return getRightsConsultationDetail(user, Number(rightsDetailMatch[1]));
  }

  if (method === 'GET' && pathname === '/user/list') {
    return listUsers(query);
  }

  if (method === 'GET' && pathname === '/user/stats') {
    return getUserStats();
  }

  const userAuditMatch = pathname.match(/^\/user\/(\d+)\/audit$/);
  if (method === 'PATCH' && userAuditMatch) {
    return auditUser(Number(userAuditMatch[1]), data);
  }

  if (method === 'GET' && pathname === '/operation-log/list') {
    return listOperationLogs();
  }

  if (method === 'POST' && pathname === '/salary/draft') {
    return createSalaryDraft(data);
  }

  const salaryCalculateMatch = pathname.match(/^\/salary\/calculate\/(\d+)$/);
  if (method === 'POST' && salaryCalculateMatch) {
    return calculateSalaryFromSignup(Number(salaryCalculateMatch[1]), data);
  }

  const salaryAppealAdjustMatch = pathname.match(/^\/salary\/(\d+)\/appeal$/);
  if (method === 'PATCH' && salaryAppealAdjustMatch) {
    return adjustSalaryAppeal(Number(salaryAppealAdjustMatch[1]), data);
  }

  const salarySettleMatch = pathname.match(/^\/salary\/(\d+)\/settle$/);
  if (method === 'POST' && salarySettleMatch) {
    return settleSalary(Number(salarySettleMatch[1]), data);
  }

  if (method === 'POST' && pathname === '/worklog/complete') {
    return completeWorklog(data);
  }

  if (method === 'GET' && pathname === '/worklog/archive') {
    return listWorkArchives(query);
  }

  throw createHttpError(404, `phase1Api 暂未支持接口：${method} ${pathname}`);
}

exports.main = async (event = {}, context = {}) => {
  try {
    const data = await routeRequest(event, context);
    return ok(data);
  } catch (error) {
    return fail(error.statusCode || 500, error.message || 'phase1Api 调用失败', error.data);
  }
};
