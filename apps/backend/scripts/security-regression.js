/* eslint-disable no-console */

const API_BASE = (process.env.API_BASE || 'http://127.0.0.1:3001/api').replace(/\/+$/, '');
const SUPER_ADMIN_PHONE = String(process.env.SUPER_ADMIN_PHONE || '13800000010').trim();
const SUPER_ADMIN_IDCARD_LAST6 = String(process.env.SUPER_ADMIN_IDCARD_LAST6 || '010010').trim();

const runSeed = Date.now() % 100000000;
let serial = 0;

function nextSerial() {
  serial += 1;
  return serial;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function extractMessage(payload, fallback = 'Unknown error') {
  if (!payload) return fallback;
  if (Array.isArray(payload.message) && payload.message.length > 0) return String(payload.message[0]);
  if (payload.message) return String(payload.message);
  if (payload.msg) return String(payload.msg);
  return fallback;
}

function last6(idCard) {
  return String(idCard || '').slice(-6);
}

function buildPhone(prefix = '139') {
  const idx = (runSeed + nextSerial()) % 100000000;
  return `${prefix}${String(idx).padStart(8, '0')}`;
}

function buildIdCard() {
  const idx = nextSerial();
  const month = String((idx % 12) + 1).padStart(2, '0');
  const day = String((idx % 27) + 1).padStart(2, '0');
  const tail = String((runSeed + idx) % 10000).padStart(4, '0');
  return `3301061990${month}${day}${tail}`;
}

function buildBankCard() {
  const idx = (runSeed * 13 + nextSerial()) % 10000000000;
  return `622202${String(idx).padStart(10, '0')}`;
}

function buildProxyPayload(label, overrides = {}) {
  const idx = nextSerial();
  return {
    workerName: `${label}工人${idx}`,
    workerIdCard: buildIdCard(),
    workerPhone: buildPhone('139'),
    workerHomeAddress: `浙江省杭州市西湖区回归路${idx}号`,
    workerBankName: '中国农业银行',
    workerBankCardNo: buildBankCard(),
    workerEmergencyContact: `${label}家属`,
    workerEmergencyPhone: buildPhone('137'),
    proxyName: `${label}代办人`,
    proxyPhone: buildPhone('136'),
    relationToWorker: '子女',
    consentType: 'family_confirm',
    consentStatement: `${label}授权提交。`,
    ...overrides,
  };
}

async function requestApi(path, options = {}) {
  const method = options.method || 'GET';
  const token = options.token;
  const body = options.body;

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body == null ? undefined : JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));
  return {
    ok: response.ok,
    status: response.status,
    payload,
  };
}

async function expectStatus(path, options, expectedStatus, hint) {
  const result = await requestApi(path, options);
  assert(
    result.status === expectedStatus,
    `${hint} 期望状态=${expectedStatus} 实际=${result.status} 消息=${extractMessage(result.payload)}`,
  );
  return result.payload;
}

async function login(phone, idCardLast6) {
  const payload = await expectStatus(
    '/auth/login',
    {
      method: 'POST',
      body: {
        phone,
        idCardLast6,
      },
    },
    201,
    `登录失败: ${phone}`,
  );

  const token = payload?.access_token;
  assert(Boolean(token), `登录成功但未返回 access_token: ${phone}`);
  return token;
}

async function createProxyCase(proxyPayload) {
  return expectStatus(
    '/user/register/proxy',
    {
      method: 'POST',
      body: proxyPayload,
    },
    201,
    '创建代注册单失败',
  );
}

async function reviewProxyCase(caseId, status, token, reason) {
  return expectStatus(
    `/user/proxy-registration/${caseId}/review`,
    {
      method: 'PATCH',
      token,
      body: {
        status,
        reason: reason || undefined,
      },
    },
    200,
    `审核代注册单失败(caseId=${caseId}, status=${status})`,
  );
}

async function main() {
  console.log(`[准备] API_BASE=${API_BASE}`);
  const adminToken = await login(SUPER_ADMIN_PHONE, SUPER_ADMIN_IDCARD_LAST6);

  console.log('[用例1] 撤销后旧 token 不可访问工资接口');
  const revokePayload = buildProxyPayload('撤销回归', {
    workerBankCardNo: buildBankCard(),
  });
  const revokeCase = await createProxyCase(revokePayload);
  await reviewProxyCase(revokeCase.caseId, 'approved', adminToken);

  const workerTokenBeforeRevoke = await login(revokePayload.workerPhone, last6(revokePayload.workerIdCard));
  await expectStatus(
    '/salary/worker/stats',
    { method: 'GET', token: workerTokenBeforeRevoke },
    200,
    '撤销前工资接口应可访问',
  );

  await reviewProxyCase(revokeCase.caseId, 'revoked', adminToken, '自动化回归撤销');
  await expectStatus(
    '/salary/worker/stats',
    { method: 'GET', token: workerTokenBeforeRevoke },
    401,
    '撤销后旧 token 仍可访问工资接口',
  );

  console.log('[用例2] 同卡多工人触发高风险标记');
  const sharedCardPayload = buildProxyPayload('同卡风控', {
    workerBankCardNo: revokePayload.workerBankCardNo,
  });
  const sharedCardCase = await createProxyCase(sharedCardPayload);
  assert(
    String(sharedCardCase?.riskLevel || '').toLowerCase() === 'high',
    `同卡风控未标记 high，当前=${sharedCardCase?.riskLevel}`,
  );

  console.log('[用例3] 驳回后可通过专用接口重提');
  const rejectPayload = buildProxyPayload('驳回重提', {
    workerBankCardNo: buildBankCard(),
  });
  const rejectedCase = await createProxyCase(rejectPayload);
  await reviewProxyCase(rejectedCase.caseId, 'rejected', adminToken, '自动化回归驳回');

  const duplicateCreateResult = await requestApi('/user/register/proxy', {
    method: 'POST',
    body: rejectPayload,
  });
  assert(duplicateCreateResult.status === 409, `驳回后重复创建应返回 409，实际=${duplicateCreateResult.status}`);
  const duplicateMessage = extractMessage(duplicateCreateResult.payload);
  assert(
    duplicateMessage.includes(`caseId=${rejectedCase.caseId}`),
    `驳回后冲突提示未包含 caseId，消息=${duplicateMessage}`,
  );

  const resubmitPayload = {
    ...rejectPayload,
    workerHomeAddress: `${rejectPayload.workerHomeAddress}-重提`,
    consentStatement: '自动化回归重提',
  };
  const resubmitResult = await expectStatus(
    `/user/proxy-registration/${rejectedCase.caseId}/resubmit`,
    {
      method: 'PATCH',
      body: resubmitPayload,
    },
    200,
    '驳回重提失败',
  );
  assert(
    Number(resubmitResult?.caseId) === Number(rejectedCase.caseId) && String(resubmitResult?.status) === 'pending_review',
    `重提后状态异常: ${JSON.stringify(resubmitResult)}`,
  );

  console.log('[用例4] 首次改卡必须二次确认挑战令牌');
  const challengePayload = buildProxyPayload('二次确认', {
    workerBankCardNo: buildBankCard(),
  });
  const challengeCase = await createProxyCase(challengePayload);
  await reviewProxyCase(challengeCase.caseId, 'approved', adminToken);

  const challengeWorkerToken = await login(challengePayload.workerPhone, last6(challengePayload.workerIdCard));
  const nextBankCardNo = buildBankCard();

  const challengeInfo = await expectStatus(
    '/user/profile/bank-card/challenge',
    {
      method: 'POST',
      token: challengeWorkerToken,
      body: { bankCardNo: nextBankCardNo },
    },
    201,
    '请求银行卡二次确认挑战失败',
  );

  assert(challengeInfo?.required === true, `挑战接口应返回 required=true，实际=${JSON.stringify(challengeInfo)}`);
  assert(Boolean(challengeInfo?.challengeToken), '挑战接口未返回 challengeToken');

  await expectStatus(
    '/user/profile',
    {
      method: 'PATCH',
      token: challengeWorkerToken,
      body: {
        bankName: challengePayload.workerBankName,
        bankCardNo: nextBankCardNo,
      },
    },
    400,
    '无挑战令牌修改银行卡应失败',
  );

  await expectStatus(
    '/user/profile',
    {
      method: 'PATCH',
      token: challengeWorkerToken,
      body: {
        bankName: challengePayload.workerBankName,
        bankCardNo: nextBankCardNo,
        bankCardChallengeToken: challengeInfo.challengeToken,
      },
    },
    200,
    '携带挑战令牌修改银行卡失败',
  );

  console.log('✅ 安全回归断言全部通过');
}

main().catch((error) => {
  console.error('❌ SECURITY_REGRESSION_FAILED');
  console.error(error && error.stack ? error.stack : String(error));
  process.exit(1);
});
