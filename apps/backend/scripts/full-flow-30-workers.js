/**
 * End-to-end workflow simulator:
 * boss submit base -> super admin audit -> assign base manager ->
 * publish job -> 30 workers signup -> field manager checkin ->
 * base manager calculate salary -> workers confirm -> super admin pay ->
 * export signup/checkin/salary tables.
 *
 * Usage:
 *   SUPER_ADMIN_PHONE=13800000010 SUPER_ADMIN_IDCARD_LAST6=001010 node scripts/full-flow-30-workers.js
 * Optional:
 *   API_BASE=http://127.0.0.1:3001/api WORKER_COUNT=30 WORK_DATE=2026-04-01
 */

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const API_BASE = (process.env.API_BASE || 'http://127.0.0.1:3001/api').replace(/\/+$/, '');
const WORKER_COUNT = Math.max(Number(process.env.WORKER_COUNT || 30), 1);
const SUPER_ADMIN_PHONE = String(process.env.SUPER_ADMIN_PHONE || '').trim();
const SUPER_ADMIN_IDCARD_LAST6 = String(process.env.SUPER_ADMIN_IDCARD_LAST6 || '').trim();
const SUPER_ADMIN_IDCARD = String(process.env.SUPER_ADMIN_IDCARD || '').trim();
const RUN_DATE = String(process.env.WORK_DATE || '').trim() || getTodayDate();
const RUN_TAG = buildRunTag();
// Unique serial base per run so repeated runs don't clash on ID cards
const SERIAL_PREFIX = Number(RUN_TAG.slice(-4)) + 1000;

function getTodayDate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function buildRunTag() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${y}${m}${day}${hh}${mm}${ss}`;
}

function toCsvCell(value) {
  const text = String(value == null ? '' : value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function extractMessage(payload, fallback = 'Unknown error') {
  if (!payload) return fallback;
  if (Array.isArray(payload.message) && payload.message.length) return String(payload.message[0]);
  if (payload.message) return String(payload.message);
  if (payload.msg) return String(payload.msg);
  return fallback;
}

function isDuplicateError(error) {
  const text = String(error?.message || '');
  return /duplicate|already|已报名|已申请|重复|已存在|已被使用|已注册|已被/i.test(text);
}

function idCardFromSerial(serial) {
  return `61010119800101${String(serial).padStart(4, '0')}`;
}

function fixedPhone(prefix, serial) {
  return `${prefix}${String(serial).padStart(8, '0')}`.slice(0, 11);
}

function last6(idCard) {
  return String(idCard || '').slice(-6);
}

async function requestApi(urlPath, options = {}) {
  const method = options.method || 'GET';
  const token = options.token;
  const data = options.data;
  const url = `${API_BASE}${urlPath.startsWith('/') ? urlPath : `/${urlPath}`}`;

  const res = await fetch(url, {
    method,
    headers: Object.assign(
      {
        'Content-Type': 'application/json',
      },
      token ? { Authorization: `Bearer ${token}` } : {},
    ),
    body: data == null ? undefined : JSON.stringify(data),
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(`${method} ${urlPath} failed: ${extractMessage(payload, res.statusText)}`);
    error.statusCode = res.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

async function login(phone, idCardLike) {
  const idCardLast6 = String(idCardLike || '').length > 6 ? last6(idCardLike) : String(idCardLike || '');
  const payload = await requestApi('/auth/login', {
    method: 'POST',
    data: { phone, idCardLast6 },
  });
  return {
    token: payload.access_token,
    user: payload.user || {},
  };
}

async function ensurePublicUser(user) {
  const endpoint = user.roleKey === 'boss' ? '/user/register/boss' : '/user/register';
  try {
    const payload = {
      name: user.name,
      idCard: user.idCard,
      phone: user.phone,
      roleKey: user.roleKey,
      homeAddress: user.homeAddress || '陕西省西安市雁塔区测试路1号',
    };
    if (user.gender) payload.gender = user.gender;
    if (user.isPoorHousehold !== undefined) payload.isPoorHousehold = user.isPoorHousehold;
    if (user.roleKey === 'boss') {
      payload.bankName = user.bankName || '中国农业银行';
      payload.bankCardNo = user.bankCardNo || `622848${String(Date.now()).slice(-10).padStart(10, '0')}`;
    }
    await requestApi(endpoint, {
      method: 'POST',
      data: payload,
    });
  } catch (error) {
    if (!isDuplicateError(error)) throw error;
  }
  const auth = await login(user.phone, user.idCard);
  return Object.assign({}, user, { uid: auth.user?.uid, id: Number(auth.user?.id), token: auth.token });
}

async function ensureManagedUser(user, superToken) {
  try {
    await requestApi('/user/admin', {
      method: 'POST',
      token: superToken,
      data: {
        name: user.name,
        idCard: user.idCard,
        phone: user.phone,
        roleKey: user.roleKey,
        assignedBaseId: user.assignedBaseId,
      },
    });
  } catch (error) {
    if (!isDuplicateError(error)) throw error;
  }
  const auth = await login(user.phone, user.idCard);
  return Object.assign({}, user, { uid: auth.user?.uid, id: Number(auth.user?.id), token: auth.token });
}

async function safeCall(fn, onDuplicateFallback) {
  try {
    return await fn();
  } catch (error) {
    if (isDuplicateError(error) && typeof onDuplicateFallback === 'function') {
      return onDuplicateFallback(error);
    }
    throw error;
  }
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeCsv(filePath, header, rows) {
  const lines = [header.map(toCsvCell).join(',')];
  rows.forEach((row) => {
    lines.push(row.map(toCsvCell).join(','));
  });
  fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
}

function writeXlsx(filePath, sheetName, header, rows) {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet([header, ...rows]);
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName || 'Sheet1');
  XLSX.writeFile(workbook, filePath);
}

function salaryStatusText(statusCode) {
  const code = Number(statusCode);
  if (code === 0) return 'pending_worker_confirm';
  if (code === 1) return 'confirmed_waiting_pay';
  if (code === 2) return 'paid';
  return 'unknown';
}

async function createBaseWithBoss(bossToken, payload) {
  return safeCall(
    () => requestApi('/base', { method: 'POST', token: bossToken, data: payload }),
    async () => {
      const list = await requestApi('/base?showAll=true', { method: 'GET' });
      const found = (Array.isArray(list) ? list : []).find((item) => String(item.baseName || '').trim() === payload.baseName);
      if (!found) throw new Error('Base exists but cannot be fetched by name');
      return found;
    },
  );
}

async function main() {
  if (!SUPER_ADMIN_PHONE || (!SUPER_ADMIN_IDCARD_LAST6 && !SUPER_ADMIN_IDCARD)) {
    throw new Error('Missing SUPER_ADMIN_PHONE and SUPER_ADMIN_IDCARD_LAST6 (or SUPER_ADMIN_IDCARD).');
  }

  console.log(`[1/12] Login super admin: ${SUPER_ADMIN_PHONE}`);
  const superAdminAuth = await login(SUPER_ADMIN_PHONE, SUPER_ADMIN_IDCARD_LAST6 || SUPER_ADMIN_IDCARD);
  const superToken = superAdminAuth.token;

  const boss = {
    roleKey: 'boss',
    name: `妯℃嫙鑰佹澘-${RUN_TAG.slice(-4)}`,
    phone: fixedPhone('176', Number(RUN_TAG.slice(-8))),
    idCard: idCardFromSerial(SERIAL_PREFIX + 1),
  };
  console.log(`[2/12] Ensure boss account: ${boss.phone}`);
  const bossUser = await ensurePublicUser(boss);

  const baseManager = {
    roleKey: 'base_manager',
    name: `基地管理员${RUN_TAG.slice(-4)}`,
    phone: fixedPhone('177', Number(RUN_TAG.slice(-8))),
    idCard: idCardFromSerial(SERIAL_PREFIX + 2),
  };
  console.log(`[3/12] Ensure base manager account: ${baseManager.phone}`);
  const baseManagerUser = await ensureManagedUser(baseManager, superToken);

  const baseName = `模拟入驻基地-${RUN_TAG}`;
  const basePayload = {
    baseName,
    licenseUrl: 'https://example.com/license/demo-license.png',
    contactPhone: fixedPhone('178', Number(RUN_TAG.slice(-8))),
    category: 1,
    regionCode: 610100,
    address: 'Shaanxi XiAn Demo Base No.1',
    description: JSON.stringify({
      salary: '25元/小时',
      owner: bossUser.name,
      ownerPhone: bossUser.phone,
      companyAdmin: {
        name: baseManagerUser.name,
        phone: baseManagerUser.phone,
      },
      envImages: [
        'https://example.com/env/a.png',
        'https://example.com/env/b.png',
      ],
      runTag: RUN_TAG,
    }),
  };

  console.log('[4/12] Boss submit base profile');
  const bossAuth = await login(bossUser.phone, bossUser.idCard);
  const baseInfo = await createBaseWithBoss(bossAuth.token, basePayload);
  const baseId = Number(baseInfo.id);

  console.log('[5/12] Super admin audit base');
  await requestApi(`/base/${baseId}/audit`, {
    method: 'PATCH',
    token: superToken,
    data: { status: 1 },
  }).catch((error) => {
    if (!/(已审核|already|Conflict)/i.test(String(error.message))) throw error;
  });

  const fieldManager = {
    roleKey: 'field_manager',
    name: `现场管理员${RUN_TAG.slice(-4)}`,
    phone: fixedPhone('179', Number(RUN_TAG.slice(-8))),
    idCard: idCardFromSerial(SERIAL_PREFIX + 3),
    assignedBaseId: baseId,
  };
  console.log('[6/12] Ensure field manager account + assign supervisors for base');
  const fieldManagerUser = await ensureManagedUser(fieldManager, superToken);
  await requestApi(`/base/${baseId}/supervisors`, {
    method: 'PATCH',
    token: superToken,
    data: {
      baseManagerIds: [Number(baseManagerUser.id)],
      fieldManagerIds: [Number(fieldManagerUser.id)],
    },
  }).catch((error) => {
    const msg = String(error.message || '');
    if (!/(已分配|already|Conflict)/i.test(msg)) throw error;
  });

  console.log('[7/12] Boss publish one recruiting job -> Super admin review');
  const job = await requestApi(`/base/${baseId}/jobs`, {
    method: 'POST',
    token: bossAuth.token,
    data: {
      jobTitle: `苹果采摘工${RUN_TAG.slice(-4)}`,
      recruitCount: WORKER_COUNT,
      workCycle: 1,
      workContent: 'Fruit picking, sorting and packing',
      workHours: '08:00-17:00',
      workStartDate: '2026-01-01',
      workEndDate: '2026-12-31',
      payType: 2,
      hourlyRate: 25,
      requirements: '40-60岁，身体健康',
      hasMeals: true,
      hasAccommodation: false,
      validUntil: '2026-12-31',
    },
  });
  const jobId = Number(job.id);
  console.log(`  Job published (id=${jobId}), super admin reviewing...`);
  await requestApi(`/base/jobs/${jobId}/review`, {
    method: 'PATCH',
    token: superToken,
    data: { status: 1, reason: '审核通过' },
  }).catch((error) => {
    const msg = String(error.message || '');
    if (!/(已审核|already|Conflict)/i.test(msg)) throw error;
  });

  const baseManagerAuth = await login(baseManagerUser.phone, baseManagerUser.idCard);

  console.log(`[8/12] Ensure ${WORKER_COUNT} workers + signup`);
  const workers = [];
  for (let i = 1; i <= WORKER_COUNT; i += 1) {
    const workerSeed = Number(`88${String(i).padStart(2, '0')}00`);
    const worker = {
      roleKey: 'worker',
      name: `工人${String(i).padStart(2, '0')}`,
      phone: fixedPhone('139', workerSeed + Number(RUN_TAG.slice(-4))),
      idCard: idCardFromSerial(SERIAL_PREFIX + 100 + i),
      gender: i % 2 === 0 ? 'male' : 'female',
      isPoorHousehold: false,
    };
    const ensured = await ensurePublicUser(worker);

    await requestApi('/user/profile', {
      method: 'PATCH',
      token: ensured.token,
      data: {
        bankName: '中国农业银行',
        bankCardNo: `622848000000${String(i).padStart(6, '0')}`,
      },
    }).catch(() => null);

    await requestApi(`/base/jobs/${jobId}/apply`, {
      method: 'POST',
      token: ensured.token,
      data: { baseId, note: '脚本模拟报名' },
    }).catch((error) => {
      if (!isDuplicateError(error)) throw error;
    });

    await requestApi('/attendance/signup', {
      method: 'POST',
      token: ensured.token,
      data: { baseId, jobId, workDate: RUN_DATE },
    }).catch((error) => {
      if (!isDuplicateError(error)) throw error;
    });

    workers.push(ensured);
  }

  console.log('  Auditing worker profiles...');
  for (let i = 0; i < workers.length; i += 1) {
    const worker = workers[i];
    await requestApi(`/user/${worker.id}/audit`, {
      method: 'PATCH',
      token: superToken,
      data: { status: 1 },
    }).catch((error) => {
      if (!/(已审核|already)/i.test(String(error.message))) throw error;
    });
  }

  console.log('[9/12] Field manager scan-checkin for all workers');
  const fieldAuth = await login(fieldManagerUser.phone, fieldManagerUser.idCard);
  let checkinSuccess = 0;
  for (let i = 0; i < workers.length; i += 1) {
    const worker = workers[i];
    const qr = await requestApi('/attendance/qrcode', {
      method: 'GET',
      token: worker.token,
    });
    if (!qr || !qr.content) continue;

    await requestApi('/attendance/checkin', {
      method: 'POST',
      token: fieldAuth.token,
      data: {
        qrContent: qr.content,
        baseId,
      },
    }).catch((error) => {
      const msg = String(error.message || '');
      if (!/(已签到|already|duplicate)/i.test(msg)) throw error;
    });
    checkinSuccess += 1;
  }

  console.log('[10/12] Base manager calculate daily salaries');
  const attendanceRecordsRes = await requestApi(`/attendance/records?date=${encodeURIComponent(RUN_DATE)}&baseId=${baseId}`, {
    method: 'GET',
    token: baseManagerAuth.token,
  });
  const attendanceRecords = Array.isArray(attendanceRecordsRes?.records)
    ? attendanceRecordsRes.records
    : [];
  const checkedInRecords = attendanceRecords.filter((item) => Number(item.status) === 1);

  let salaryDraftCount = 0;
  for (let i = 0; i < checkedInRecords.length; i += 1) {
    const signupId = Number(checkedInRecords[i].id);
    if (!signupId) continue;
    await requestApi(`/salary/calculate/${signupId}`, {
      method: 'POST',
      token: baseManagerAuth.token,
      data: { duration: 8 },
    }).catch((error) => {
      const msg = String(error.message || '');
      if (!/(已确认|已发放|cannot|not checked in)/i.test(msg)) throw error;
    });
    salaryDraftCount += 1;
  }

  console.log('[11/12] Workers confirm salary -> Boss settle -> Submit report to Super admin');
  let salaryListRes = await requestApi(
    `/salary/list?baseId=${baseId}&dateFrom=${encodeURIComponent(RUN_DATE)}&dateTo=${encodeURIComponent(RUN_DATE)}`,
    { method: 'GET', token: superToken },
  );
  let salaryList = Array.isArray(salaryListRes?.list) ? salaryListRes.list : [];

  const workerByUid = workers.reduce((acc, item) => {
    acc[item.uid] = item;
    return acc;
  }, {});

  for (let i = 0; i < salaryList.length; i += 1) {
    const salary = salaryList[i];
    if (Number(salary.status) !== 0) continue;
    const worker = workerByUid[String(salary.workerUid || '')];
    if (!worker || !worker.token) continue;
    await requestApi(`/salary/worker/${salary.id}/confirm`, {
      method: 'POST',
      token: worker.token,
    }).catch((error) => {
      const msg = String(error.message || '');
      if (!/(已确认|已发放|not allow|already)/i.test(msg)) throw error;
    });
  }

  const bossSettleAuth = await login(bossUser.phone, bossUser.idCard);
  salaryListRes = await requestApi(
    `/salary/list?baseId=${baseId}&dateFrom=${encodeURIComponent(RUN_DATE)}&dateTo=${encodeURIComponent(RUN_DATE)}`,
    { method: 'GET', token: bossSettleAuth.token },
  );
  salaryList = Array.isArray(salaryListRes?.list) ? salaryListRes.list : [];

  let settledCount = 0;
  for (let i = 0; i < salaryList.length; i += 1) {
    const salary = salaryList[i];
    if (Number(salary.status) !== 1) continue;
    await requestApi(`/salary/${salary.id}/settle`, {
      method: 'POST',
      token: bossSettleAuth.token,
      data: { paymentMethod: 'transfer' },
    }).catch((error) => {
      const msg = String(error.message || '');
      if (!/(已结算|already|Conflict)/i.test(msg)) throw error;
    });
    settledCount += 1;
  }

  console.log(`  Boss settled ${settledCount} salaries, submitting report...`);
  const report = await requestApi('/salary/reports/submit', {
    method: 'POST',
    token: bossSettleAuth.token,
    data: {
      baseId,
      dateFrom: RUN_DATE,
      dateTo: RUN_DATE,
    },
  }).catch((error) => {
    const msg = String(error.message || '');
    if (!/(已提交|already|Conflict)/i.test(msg)) throw error;
    return null;
  });

  let superReportView = [];
  if (report) {
    const reportId = Number(report.id);
    superReportView = await requestApi(`/salary/reports/${reportId}`, {
      method: 'GET',
      token: superToken,
    }).catch(() => []);
  }

  console.log('[12/12] Export signup/checkin/salary tables and verify worker history');
  const superRecordsRes = await requestApi(`/attendance/records?date=${encodeURIComponent(RUN_DATE)}&baseId=${baseId}`, {
    method: 'GET',
    token: superToken,
  });
  const superRecords = Array.isArray(superRecordsRes?.records) ? superRecordsRes.records : [];
  const checkinRows = superRecords.filter((item) => Number(item.status) === 1);

  const finalSalaryRes = await requestApi(
    `/salary/list?baseId=${baseId}&dateFrom=${encodeURIComponent(RUN_DATE)}&dateTo=${encodeURIComponent(RUN_DATE)}`,
    { method: 'GET', token: superToken },
  );
  const finalSalaryList = Array.isArray(finalSalaryRes?.list) ? finalSalaryRes.list : [];

  const superView = await requestApi(`/attendance/records?date=${encodeURIComponent(RUN_DATE)}&baseId=${baseId}`, {
    method: 'GET',
    token: superToken,
  });
  const baseView = await requestApi(`/attendance/records?date=${encodeURIComponent(RUN_DATE)}&baseId=${baseId}`, {
    method: 'GET',
    token: baseManagerAuth.token,
  });
  const fieldView = await requestApi(`/attendance/records?date=${encodeURIComponent(RUN_DATE)}&baseId=${baseId}`, {
    method: 'GET',
    token: fieldAuth.token,
  });

  const sampleWorker = workers[0];
  const workerPaidList = await requestApi('/salary/worker/paid?limit=5', {
    method: 'GET',
    token: sampleWorker.token,
  }).catch(() => []);
  const workerHistory = await requestApi('/attendance/worker/records?limit=10', {
    method: 'GET',
    token: sampleWorker.token,
  }).catch(() => []);

  const exportDir = path.join(process.cwd(), 'exports', `full-flow-${RUN_TAG}`);
  ensureDir(exportDir);

  writeCsv(
    path.join(exportDir, 'signup-table.csv'),
    ['SignupID', 'WorkDate', 'BaseName', 'JobTitle', 'WorkerName', 'WorkerUID', 'WorkerPhone', 'Status', 'CreatedAt'],
    superRecords.map((row) => [
      row.id,
      row.workDate,
      row.baseName,
      row.jobTitle,
      row.workerName,
      row.workerUid,
      row.workerPhone,
      row.status,
      row.createdAt,
    ]),
  );

  writeCsv(
    path.join(exportDir, 'checkin-table.csv'),
    ['SignupID', 'WorkDate', 'BaseName', 'JobTitle', 'WorkerName', 'WorkerUID', 'CheckinTime', 'Status'],
    checkinRows.map((row) => [
      row.id,
      row.workDate,
      row.baseName,
      row.jobTitle,
      row.workerName,
      row.workerUid,
      row.checkinTime,
      row.status,
    ]),
  );

  writeCsv(
    path.join(exportDir, 'salary-table.csv'),
    ['SalaryID', 'SignupID', 'WorkDate', 'BaseName', 'JobTitle', 'WorkerName', 'WorkerUID', 'WorkDuration', 'PieceCount', 'TotalAmount', 'Status'],
    finalSalaryList.map((row) => [
      row.id,
      row.signupId,
      row.workDate,
      row.baseName,
      row.jobTitle,
      row.workerName,
      row.workerUid,
      row.workDuration,
      row.pieceCount,
      row.totalAmount,
      row.status,
    ]),
  );
  writeXlsx(
    path.join(exportDir, 'salary-table.xlsx'),
    'salary',
    [
      'SalaryID',
      'SignupID',
      'WorkDate',
      'BaseName',
      'JobTitle',
      'WorkerName',
      'WorkerUID',
      'WorkDurationHours',
      'PieceCount',
      'TotalAmount',
      'StatusCode',
      'StatusText',
    ],
    finalSalaryList.map((row) => [
      row.id,
      row.signupId,
      row.workDate,
      row.baseName,
      row.jobTitle,
      row.workerName,
      row.workerUid,
      row.workDuration,
      row.pieceCount,
      row.totalAmount,
      row.status,
      salaryStatusText(row.status),
    ]),
  );


  const credentials = {
    superAdmin: {
      phone: SUPER_ADMIN_PHONE,
      idCardLast6: SUPER_ADMIN_IDCARD_LAST6 || last6(SUPER_ADMIN_IDCARD),
    },
    boss: {
      phone: bossUser.phone,
      idCardLast6: last6(bossUser.idCard),
    },
    baseManager: {
      phone: baseManagerUser.phone,
      idCardLast6: last6(baseManagerUser.idCard),
    },
    fieldManager: {
      phone: fieldManagerUser.phone,
      idCardLast6: last6(fieldManagerUser.idCard),
    },
    sampleWorkers: workers.slice(0, 5).map((item) => ({
      uid: item.uid,
      phone: item.phone,
      idCardLast6: last6(item.idCard),
    })),
  };
  fs.writeFileSync(
    path.join(exportDir, 'credentials.json'),
    JSON.stringify(credentials, null, 2),
    'utf8',
  );

  const summary = {
    runDate: RUN_DATE,
    baseId,
    jobId,
    workersPlanned: WORKER_COUNT,
    workersSignupRecords: superRecords.length,
    workersCheckedIn: checkinRows.length,
    salaryDraftCount,
    salaryRecords: finalSalaryList.length,
    bossSettledCount: settledCount,
    reportSubmitted: Boolean(report),
    reportDetailItems: Array.isArray(superReportView) ? superReportView.length : 0,
    superAdminVisible: Number(superView?.total || superView?.records?.length || 0),
    baseManagerVisible: Number(baseView?.total || baseView?.records?.length || 0),
    fieldManagerVisible: Number(fieldView?.total || fieldView?.records?.length || 0),
    workerPaidNoticeCount: Array.isArray(workerPaidList) ? workerPaidList.length : 0,
    workerHistoryCount: Array.isArray(workerHistory) ? workerHistory.length : 0,
    exportDir,
  };

  console.log('\n=== FULL FLOW SUMMARY ===');
  Object.keys(summary).forEach((key) => {
    console.log(`${key}: ${summary[key]}`);
  });
  console.log('\nCredentials written to:', path.join(exportDir, 'credentials.json'));
}

main().catch((error) => {
  console.error('\n[FLOW FAILED]', error.message || error);
  process.exit(1);
});

