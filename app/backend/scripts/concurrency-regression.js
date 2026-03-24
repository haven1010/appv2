/* eslint-disable no-console */
const mysql = require('mysql2/promise');

const BASE_URL = process.env.TEST_BASE_URL || 'http://127.0.0.1:3001/api';
const CONCURRENCY = Number(process.env.TEST_CONCURRENCY || 8);
const DB_CONFIG = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3307),
  user: process.env.DB_USERNAME || 'pickpass_user',
  password: process.env.DB_PASSWORD || 'pickpass_password',
  database: process.env.DB_DATABASE || 'pickpass_db',
};

const ACCOUNTS = {
  superAdmin: { phone: '13800000010', idCardLast6: '010010' },
  baseManager: { phone: '13800000009', idCardLast6: '010009' },
};

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function nowStamp() {
  return `${Date.now()}${Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, '0')}`;
}

function createPhone() {
  return `139${nowStamp().slice(-8)}`;
}

function createIdCard() {
  return `CARD${nowStamp()}${Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, '0')}`;
}

function getTodayDate() {
  const date = new Date();
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

async function api(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
  };

  const response = await fetch(`${BASE_URL}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  return {
    status: response.status,
    ok: response.ok,
    body,
  };
}

async function login(credentials) {
  const result = await api('/auth/login', {
    method: 'POST',
    body: credentials,
  });

  assert(result.status === 201 || result.status === 200, `登录失败: ${JSON.stringify(result.body)}`);
  return result.body.access_token;
}

async function registerWorker(prefix) {
  const phone = createPhone();
  const idCard = createIdCard();
  const payload = {
    name: `${prefix}_${nowStamp().slice(-6)}`,
    phone,
    idCard,
    emergencyContact: '并发测试联系人',
    emergencyPhone: createPhone(),
  };

  const result = await api('/user/register', {
    method: 'POST',
    body: payload,
  });

  assert(result.status === 201 || result.status === 200, `注册工人失败: ${JSON.stringify(result.body)}`);
  return {
    id: result.body.id,
    uid: result.body.uid,
    name: payload.name,
    phone,
    idCard,
    idCardLast6: idCard.slice(-6),
  };
}

async function queryOne(conn, sql, params = []) {
  const [rows] = await conn.query(sql, params);
  return rows[0];
}

async function queryAll(conn, sql, params = []) {
  const [rows] = await conn.query(sql, params);
  return rows;
}

function summarize(results) {
  const success = results.filter((item) => item.status >= 200 && item.status < 300).length;
  const clientError = results.filter((item) => item.status >= 400 && item.status < 500).length;
  const serverError = results.filter((item) => item.status >= 500).length;
  return { success, clientError, serverError };
}

async function runConcurrent(label, count, factory) {
  console.log(`\n[CASE] ${label}`);
  const settled = await Promise.all(
    Array.from({ length: count }, (_, index) =>
      factory(index)
        .then((result) => ({ ok: true, ...result }))
        .catch((error) => ({
          ok: false,
          status: 0,
          body: { message: error.message || String(error) },
        })),
    ),
  );
  const summary = summarize(settled);
  console.log(`[RESULT] ${label}: ${JSON.stringify(summary)}`);
  return settled;
}

async function createBaseAndJob(baseManagerToken, superAdminToken) {
  const basePayload = {
    baseName: `并发压测基地_${nowStamp()}`,
    licenseUrl: 'https://example.com/license.jpg',
    contactPhone: '13800138000',
    category: 1,
    regionCode: 330100,
    address: '并发压测地址',
    description: '{"tag":"concurrency"}',
  };

  const baseResult = await api('/base', {
    method: 'POST',
    token: baseManagerToken,
    body: basePayload,
  });
  assert(baseResult.ok, `创建基地失败: ${JSON.stringify(baseResult.body)}`);

  const baseId = Number(baseResult.body.id);
  const auditResults = await runConcurrent('base audit once', CONCURRENCY, async () =>
    api(`/base/${baseId}/audit`, {
      method: 'PATCH',
      token: superAdminToken,
      body: { status: 1 },
    }),
  );
  const auditSummary = summarize(auditResults);
  assert(auditSummary.success === 1, `基地审核并发成功数异常: ${JSON.stringify(auditSummary)}`);

  const jobPayload = {
    jobTitle: `并发压测岗位_${nowStamp().slice(-6)}`,
    payType: 3,
    unitPrice: 5,
    targetCount: 100,
    recruitCount: 10,
    workCycle: 1,
    workContent: '并发压测岗位',
    validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    requirements: '身体健康',
    hasMeals: true,
  };
  const jobResult = await api(`/base/${baseId}/jobs`, {
    method: 'POST',
    token: baseManagerToken,
    body: jobPayload,
  });
  assert(jobResult.ok, `创建岗位失败: ${JSON.stringify(jobResult.body)}`);

  return {
    baseId,
    jobId: Number(jobResult.body.id),
  };
}

async function createWorkerSession(prefix) {
  const worker = await registerWorker(prefix);
  const token = await login({
    phone: worker.phone,
    idCardLast6: worker.idCardLast6,
  });
  return { worker, token };
}

function getUserIdFromToken(token) {
  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
  assert(payload?.sub, 'JWT 中缺少用户 ID');
  return Number(payload.sub);
}

async function main() {
  const conn = await mysql.createConnection(DB_CONFIG);
  const superAdminToken = await login(ACCOUNTS.superAdmin);
  const baseManagerToken = await login(ACCOUNTS.baseManager);
  const superAdminId = getUserIdFromToken(superAdminToken);
  const { baseId, jobId } = await createBaseAndJob(baseManagerToken, superAdminToken);
  const workDate = getTodayDate();

  console.log(`[SETUP] baseId=${baseId}, jobId=${jobId}, date=${workDate}, concurrency=${CONCURRENCY}`);

  const signupWorker = await createWorkerSession('signup_worker');
  const signupResults = await runConcurrent('duplicate signup', CONCURRENCY, async () =>
    api('/attendance/signup', {
      method: 'POST',
      token: signupWorker.token,
      body: { baseId, jobId, workDate },
    }),
  );
  const signupSummary = summarize(signupResults);
  assert(signupSummary.success === 1, `报名并发成功数异常: ${JSON.stringify(signupSummary)}`);
  const signupRow = await queryOne(
    conn,
    'SELECT COUNT(*) AS cnt, MAX(id) AS signupId FROM daily_signup WHERE user_id=? AND base_id=? AND work_date=?',
    [signupWorker.worker.id, baseId, workDate],
  );
  assert(Number(signupRow.cnt) === 1, `报名记录数异常: ${JSON.stringify(signupRow)}`);

  const applyWorker = await createWorkerSession('apply_worker');
  const applyResults = await runConcurrent('duplicate job application', CONCURRENCY, async () =>
    api(`/base/jobs/${jobId}/apply`, {
      method: 'POST',
      token: applyWorker.token,
      body: { baseId: String(baseId), note: '并发申请测试' },
    }),
  );
  const applySummary = summarize(applyResults);
  assert(applySummary.success === 1, `岗位申请并发成功数异常: ${JSON.stringify(applySummary)}`);
  const applicationRow = await queryOne(
    conn,
    'SELECT COUNT(*) AS cnt, MAX(id) AS applicationId FROM job_application WHERE user_id=? AND job_id=? AND base_id=? AND status=0',
    [applyWorker.worker.id, jobId, baseId],
  );
  assert(Number(applicationRow.cnt) === 1, `岗位申请记录数异常: ${JSON.stringify(applicationRow)}`);

  const cooperationResults = await runConcurrent('duplicate cooperation create', CONCURRENCY, async () =>
    api('/base/cooperation', {
      method: 'POST',
      token: superAdminToken,
      body: { baseId, requirement: '并发合作申请测试' },
    }),
  );
  const cooperationSummary = summarize(cooperationResults);
  assert(cooperationSummary.success === 1, `合作申请并发成功数异常: ${JSON.stringify(cooperationSummary)}`);
  const cooperationRow = await queryOne(
    conn,
    'SELECT COUNT(*) AS cnt, MAX(id) AS cooperationId FROM base_cooperation WHERE applicant_id=? AND base_id=? AND status=0',
    [superAdminId, baseId],
  );
  assert(Number(cooperationRow.cnt) === 1, `合作申请记录数异常: ${JSON.stringify(cooperationRow)}`);

  const reviewWorker = await createWorkerSession('review_worker');
  const reviewApply = await api(`/base/jobs/${jobId}/apply`, {
    method: 'POST',
    token: reviewWorker.token,
    body: { baseId: String(baseId), note: '待审核申请' },
  });
  assert(reviewApply.ok, `创建待审核申请失败: ${JSON.stringify(reviewApply.body)}`);
  const reviewApplicationId = Number(reviewApply.body.id);

  const reviewApplicationResults = await runConcurrent('application review once', CONCURRENCY, async () =>
    api(`/base/applications/${reviewApplicationId}/review`, {
      method: 'PATCH',
      token: superAdminToken,
      body: { status: 1 },
    }),
  );
  const reviewApplicationSummary = summarize(reviewApplicationResults);
  assert(reviewApplicationSummary.success === 1, `申请审核成功数异常: ${JSON.stringify(reviewApplicationSummary)}`);
  const reviewedApplication = await queryOne(
    conn,
    'SELECT status, reviewed_by FROM job_application WHERE id=?',
    [reviewApplicationId],
  );
  assert(Number(reviewedApplication.status) === 1, `申请审核状态异常: ${JSON.stringify(reviewedApplication)}`);

  const cooperationReviewResults = await runConcurrent('cooperation review once', CONCURRENCY, async () =>
    api(`/base/cooperation/${cooperationRow.cooperationId}/review`, {
      method: 'PATCH',
      token: superAdminToken,
      body: { status: 1 },
    }),
  );
  const cooperationReviewSummary = summarize(cooperationReviewResults);
  assert(cooperationReviewSummary.success === 1, `合作审核成功数异常: ${JSON.stringify(cooperationReviewSummary)}`);
  const reviewedCooperation = await queryOne(
    conn,
    'SELECT status, reviewed_by FROM base_cooperation WHERE id=?',
    [cooperationRow.cooperationId],
  );
  assert(Number(reviewedCooperation.status) === 1, `合作审核状态异常: ${JSON.stringify(reviewedCooperation)}`);

  const payrollWorker = await createWorkerSession('payroll_worker');
  const payrollSignup = await api('/attendance/signup', {
    method: 'POST',
    token: payrollWorker.token,
    body: { baseId, jobId, workDate },
  });
  assert(payrollSignup.ok, `创建工资测试报名失败: ${JSON.stringify(payrollSignup.body)}`);
  const qrResult = await api('/attendance/qrcode', {
    token: payrollWorker.token,
  });
  assert(qrResult.ok, `获取二维码失败: ${JSON.stringify(qrResult.body)}`);
  const checkinResult = await api('/attendance/checkin', {
    method: 'POST',
    token: baseManagerToken,
    body: { qrContent: qrResult.body.content, baseId },
  });
  assert(checkinResult.ok, `签到失败: ${JSON.stringify(checkinResult.body)}`);
  const payrollSignupId = Number(checkinResult.body.id);

  const draftResults = await runConcurrent('salary draft upsert', CONCURRENCY, async (index) =>
    api(`/salary/calculate/${payrollSignupId}`, {
      method: 'POST',
      token: baseManagerToken,
      body: { duration: 6 + index, count: index + 1 },
    }),
  );
  assert(draftResults.every((item) => item.status >= 200 && item.status < 300), '工资草稿并发更新存在失败请求');
  const salaryRow = await queryOne(
    conn,
    'SELECT COUNT(*) AS cnt, MAX(id) AS salaryId FROM labor_salary WHERE signup_id=?',
    [payrollSignupId],
  );
  assert(Number(salaryRow.cnt) === 1, `工资草稿记录数异常: ${JSON.stringify(salaryRow)}`);
  const salaryId = Number(salaryRow.salaryId);

  const confirmSalaryResults = await runConcurrent('worker confirm salary once', CONCURRENCY, async () =>
    api(`/salary/worker/${salaryId}/confirm`, {
      method: 'POST',
      token: payrollWorker.token,
    }),
  );
  const confirmSalarySummary = summarize(confirmSalaryResults);
  assert(confirmSalarySummary.success === 1, `工资确认成功数异常: ${JSON.stringify(confirmSalarySummary)}`);
  const confirmedSalary = await queryOne(conn, 'SELECT status, total_amount FROM labor_salary WHERE id=?', [salaryId]);
  assert(Number(confirmedSalary.status) === 1, `工资确认后状态异常: ${JSON.stringify(confirmedSalary)}`);

  const recalcAfterConfirmResults = await runConcurrent('salary draft blocked after confirm', CONCURRENCY, async (index) =>
    api(`/salary/calculate/${payrollSignupId}`, {
      method: 'POST',
      token: baseManagerToken,
      body: { duration: 10 + index, count: 20 + index },
    }),
  );
  const recalcAfterConfirmSummary = summarize(recalcAfterConfirmResults);
  assert(recalcAfterConfirmSummary.success === 0, `工资确认后仍允许重算: ${JSON.stringify(recalcAfterConfirmSummary)}`);
  assert(recalcAfterConfirmSummary.clientError === CONCURRENCY, `工资确认后重算拦截数异常: ${JSON.stringify(recalcAfterConfirmSummary)}`);
  const salaryAfterBlockedRecalc = await queryOne(conn, 'SELECT status, total_amount FROM labor_salary WHERE id=?', [salaryId]);
  assert(
    Number(salaryAfterBlockedRecalc.status) === 1 && Number(salaryAfterBlockedRecalc.total_amount) === Number(confirmedSalary.total_amount),
    `工资确认后重算拦截失败: ${JSON.stringify(salaryAfterBlockedRecalc)}`,
  );

  const createPaymentResults = await runConcurrent('create payment once', CONCURRENCY, async () =>
    api(`/salary/${salaryId}/payment`, {
      method: 'POST',
      token: baseManagerToken,
      body: { paymentMethod: 'transfer' },
    }),
  );
  const createPaymentSummary = summarize(createPaymentResults);
  assert(createPaymentSummary.success === 1, `支付单创建成功数异常: ${JSON.stringify(createPaymentSummary)}`);
  const paymentRow = await queryOne(
    conn,
    'SELECT COUNT(*) AS cnt, MAX(id) AS paymentId FROM salary_payment WHERE salary_id=?',
    [salaryId],
  );
  assert(Number(paymentRow.cnt) === 1, `支付单记录数异常: ${JSON.stringify(paymentRow)}`);
  const paymentId = Number(paymentRow.paymentId);

  const confirmPaymentResults = await runConcurrent('confirm payment once', CONCURRENCY, async () =>
    api(`/salary/payment/${paymentId}/confirm`, {
      method: 'PATCH',
      token: baseManagerToken,
      body: { confirmSignatureUrl: `https://example.com/sign/${nowStamp()}.jpg` },
    }),
  );
  const confirmPaymentSummary = summarize(confirmPaymentResults);
  assert(confirmPaymentSummary.success === 1, `支付确认成功数异常: ${JSON.stringify(confirmPaymentSummary)}`);
  const confirmedPayment = await queryOne(conn, 'SELECT status FROM salary_payment WHERE id=?', [paymentId]);
  assert(Number(confirmedPayment.status) === 1, `支付确认后状态异常: ${JSON.stringify(confirmedPayment)}`);

  const completePaymentResults = await runConcurrent('complete payment once', CONCURRENCY, async () =>
    api(`/salary/payment/${paymentId}/complete`, {
      method: 'PATCH',
      token: baseManagerToken,
      body: { paymentVoucherUrl: `https://example.com/voucher/${nowStamp()}.jpg` },
    }),
  );
  const completePaymentSummary = summarize(completePaymentResults);
  assert(completePaymentSummary.success === 1, `支付完成成功数异常: ${JSON.stringify(completePaymentSummary)}`);
  const paidState = await queryOne(
    conn,
    'SELECT p.status AS paymentStatus, s.status AS salaryStatus FROM salary_payment p JOIN labor_salary s ON s.id=p.salary_id WHERE p.id=?',
    [paymentId],
  );
  assert(Number(paidState.paymentStatus) === 2 && Number(paidState.salaryStatus) === 2, `支付完成后状态异常: ${JSON.stringify(paidState)}`);

  const viewBefore = await queryOne(conn, 'SELECT view_count FROM recruitment_job WHERE id=?', [jobId]);
  const viewRequests = await runConcurrent('job view count atomic increment', CONCURRENCY, async () =>
    api(`/base/jobs/${jobId}`),
  );
  assert(viewRequests.every((item) => item.status >= 200 && item.status < 300), '岗位详情并发访问存在失败请求');
  const viewAfter = await queryOne(conn, 'SELECT view_count FROM recruitment_job WHERE id=?', [jobId]);
  assert(
    Number(viewAfter.view_count) - Number(viewBefore.view_count) === CONCURRENCY,
    `浏览量增量异常: before=${viewBefore.view_count}, after=${viewAfter.view_count}, concurrency=${CONCURRENCY}`,
  );

  const statusJobPayload = {
    jobTitle: `状态竞态岗位_${nowStamp().slice(-6)}`,
    payType: 2,
    hourlyRate: 30,
    recruitCount: 5,
    workCycle: 1,
    workContent: '状态并发测试',
    validUntil: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    requirements: '状态并发测试',
  };
  const statusJobResult = await api(`/base/${baseId}/jobs`, {
    method: 'POST',
    token: baseManagerToken,
    body: statusJobPayload,
  });
  assert(statusJobResult.ok, `创建状态竞态岗位失败: ${JSON.stringify(statusJobResult.body)}`);
  const statusJobId = Number(statusJobResult.body.id);
  const statusBefore = await queryOne(
    conn,
    'SELECT status, is_active, valid_until FROM recruitment_job WHERE id=?',
    [statusJobId],
  );

  console.log('\n[CASE] job status/renew race');
  const mixedResults = await Promise.all(
    Array.from({ length: CONCURRENCY }, (_, index) => {
      if (index % 2 === 0) {
        return api(`/base/jobs/${statusJobId}/status`, {
          method: 'PATCH',
          token: baseManagerToken,
          body: { status: 0 },
        });
      }
      return api(`/base/jobs/${statusJobId}/renew`, {
        method: 'PATCH',
        token: baseManagerToken,
      });
    }),
  );
  const mixedSummary = summarize(mixedResults);
  console.log(`[RESULT] job status/renew race: ${JSON.stringify(mixedSummary)}`);
  assert(mixedSummary.serverError === 0, `岗位状态/续期并发出现服务端错误: ${JSON.stringify(mixedSummary)}`);
  const statusAfter = await queryOne(
    conn,
    'SELECT status, is_active, valid_until FROM recruitment_job WHERE id=?',
    [statusJobId],
  );
  const isOfflineState = Number(statusAfter.status) === 0 && Number(statusAfter.is_active) === 0;
  const isRenewedState =
    Number(statusAfter.status) === 1 &&
    Number(statusAfter.is_active) === 1 &&
    new Date(statusAfter.valid_until).getTime() > new Date(statusBefore.valid_until).getTime();
  assert(isOfflineState || isRenewedState, `岗位状态并发后落到非法状态: ${JSON.stringify(statusAfter)}`);

  const logStats = await queryOne(
    conn,
    'SELECT operationType, COUNT(*) AS cnt FROM operation_log GROUP BY operationType ORDER BY operationType LIMIT 20',
  ).catch(() => null);
  if (logStats) {
    console.log(`[INFO] operation_log sample: ${JSON.stringify(logStats)}`);
  }

  const tableCounts = await queryAll(
    conn,
    "SELECT 'daily_signup' AS table_name, COUNT(*) AS cnt FROM daily_signup UNION ALL SELECT 'job_application', COUNT(*) FROM job_application UNION ALL SELECT 'base_cooperation', COUNT(*) FROM base_cooperation UNION ALL SELECT 'labor_salary', COUNT(*) FROM labor_salary UNION ALL SELECT 'salary_payment', COUNT(*) FROM salary_payment UNION ALL SELECT 'operation_log', COUNT(*) FROM operation_log",
  );
  console.log('\n[SUMMARY] table counts');
  console.log(JSON.stringify(tableCounts, null, 2));
  console.log('\n[OK] concurrency regression finished successfully');
  await conn.end();
}

main().catch(async (error) => {
  console.error('\n[FAIL]', error.message || error);
  console.error(error.stack || error);
  process.exit(1);
});
