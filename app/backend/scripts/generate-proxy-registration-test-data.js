/**
 * Generate complete proxy-registration fixtures for manual testing.
 *
 * Usage:
 *   node scripts/generate-proxy-registration-test-data.js
 * Optional env:
 *   API_BASE=http://127.0.0.1:3001/api
 *   SUPER_ADMIN_PHONE=13800000010
 *   SUPER_ADMIN_IDCARD_LAST6=010010
 */

const fs = require('fs');
const path = require('path');

const API_BASE = (process.env.API_BASE || 'http://127.0.0.1:3001/api').replace(/\/+$/, '');
const SUPER_ADMIN_PHONE = String(process.env.SUPER_ADMIN_PHONE || '13800000010').trim();
const SUPER_ADMIN_IDCARD_LAST6 = String(process.env.SUPER_ADMIN_IDCARD_LAST6 || '010010').trim();

function nowTag() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${y}${m}${day}${hh}${mm}${ss}`;
}

function extractMessage(payload, fallback = 'Unknown error') {
  if (!payload) return fallback;
  if (Array.isArray(payload.message) && payload.message.length) return String(payload.message[0]);
  if (payload.message) return String(payload.message);
  if (payload.msg) return String(payload.msg);
  return fallback;
}

async function requestApi(urlPath, options = {}) {
  const method = options.method || 'GET';
  const token = options.token;
  const body = options.body;

  const res = await fetch(`${API_BASE}${urlPath}`, {
    method,
    headers: Object.assign(
      { 'Content-Type': 'application/json' },
      token ? { Authorization: `Bearer ${token}` } : {},
    ),
    body: body == null ? undefined : JSON.stringify(body),
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(`${method} ${urlPath} failed: ${extractMessage(payload, res.statusText)}`);
    err.statusCode = res.status;
    err.payload = payload;
    throw err;
  }

  return payload;
}

function buildPhone(seedBase, offset, prefix) {
  const value = (seedBase + offset) % 100000000;
  return `${prefix}${String(value).padStart(8, '0')}`;
}

function buildIdCard(seedBase, offset) {
  const tail = String((seedBase + offset) % 10000).padStart(4, '0');
  return `33010619900101${tail}`;
}

function last6(text) {
  return String(text || '').slice(-6);
}

async function login(phone, idCardLast6) {
  return requestApi('/auth/login', {
    method: 'POST',
    body: { phone, idCardLast6 },
  });
}

async function createProxyCase(input) {
  const payload = {
    workerName: input.workerName,
    workerIdCard: input.workerIdCard,
    workerPhone: input.workerPhone,
    workerHomeAddress: input.workerHomeAddress,
    workerBankName: input.workerBankName,
    workerBankCardNo: input.workerBankCardNo,
    workerEmergencyContact: input.workerEmergencyContact,
    workerEmergencyPhone: input.workerEmergencyPhone,
    proxyName: input.proxyName,
    proxyPhone: input.proxyPhone,
    relationToWorker: input.relationToWorker,
    consentType: 'family_confirm',
    consentStatement: input.consentStatement,
  };

  return requestApi('/user/register/proxy', {
    method: 'POST',
    body: payload,
  });
}

async function reviewCase(caseId, status, reason, token) {
  return requestApi(`/user/proxy-registration/${caseId}/review`, {
    method: 'PATCH',
    token,
    body: {
      status,
      reason: reason || undefined,
    },
  });
}

async function takeoverCase(caseId, nextPhone, idCardLast6, workerToken) {
  return requestApi(`/user/proxy-registration/${caseId}/takeover`, {
    method: 'POST',
    token: workerToken,
    body: {
      phone: nextPhone,
      idCardLast6,
    },
  });
}

function makeCasePayload(seedBase, index, scenarioTag) {
  const workerPhone = buildPhone(seedBase, index * 11 + 1, '139');
  const workerEmergencyPhone = buildPhone(seedBase, index * 11 + 2, '137');
  const proxyPhone = buildPhone(seedBase, index * 11 + 3, '136');

  return {
    workerName: `${scenarioTag}工人`,
    workerIdCard: buildIdCard(seedBase, index * 7 + 1),
    workerPhone,
    workerHomeAddress: `浙江省杭州市西湖区测试路${index}号`,
    workerBankName: '中国农业银行',
    workerBankCardNo: `622202${String(seedBase + index).padStart(8, '0')}`,
    workerEmergencyContact: `${scenarioTag}家属`,
    workerEmergencyPhone,
    proxyName: `${scenarioTag}代办人`,
    proxyPhone,
    relationToWorker: '子女',
    consentStatement: `${scenarioTag}授权提交。`,
  };
}

async function main() {
  const tag = nowTag();
  const seedBase = Number(tag.slice(-8));

  console.log('[1/6] 登录超级管理员...');
  const adminLogin = await login(SUPER_ADMIN_PHONE, SUPER_ADMIN_IDCARD_LAST6);
  const adminToken = adminLogin.access_token;
  if (!adminToken) {
    throw new Error('超级管理员登录失败，未获取到 access_token');
  }

  console.log('[2/6] 创建五类代注册测试单...');
  const pendingCasePayload = makeCasePayload(seedBase, 1, '待审核');
  const approvedCasePayload = makeCasePayload(seedBase, 2, '已通过待接管');
  const rejectedCasePayload = makeCasePayload(seedBase, 3, '已驳回');
  const revokedCasePayload = makeCasePayload(seedBase, 4, '已撤销');
  const takeoverCasePayload = makeCasePayload(seedBase, 5, '已接管');

  const pending = await createProxyCase(pendingCasePayload);
  const approved = await createProxyCase(approvedCasePayload);
  const rejected = await createProxyCase(rejectedCasePayload);
  const revoked = await createProxyCase(revokedCasePayload);
  const takeover = await createProxyCase(takeoverCasePayload);

  console.log('[3/6] 管理员审核流转...');
  await reviewCase(approved.caseId, 'approved', '', adminToken);
  await reviewCase(rejected.caseId, 'rejected', '证件信息模糊，需重新提交', adminToken);
  await reviewCase(revoked.caseId, 'approved', '', adminToken);
  await reviewCase(revoked.caseId, 'revoked', '家属主动撤销办理', adminToken);
  await reviewCase(takeover.caseId, 'approved', '', adminToken);

  console.log('[4/6] 处理已接管场景...');
  const takeoverWorkerLogin = await login(
    takeoverCasePayload.workerPhone,
    last6(takeoverCasePayload.workerIdCard),
  );
  const takeoverNewPhone = buildPhone(seedBase, 99, '135');
  await takeoverCase(
    takeover.caseId,
    takeoverNewPhone,
    last6(takeoverCasePayload.workerIdCard),
    takeoverWorkerLogin.access_token,
  );

  console.log('[5/6] 组装测试数据清单...');
  const result = {
    generatedAt: new Date().toISOString(),
    apiBase: API_BASE,
    admin: {
      phone: SUPER_ADMIN_PHONE,
      passwordHint: `身份证后6位 ${SUPER_ADMIN_IDCARD_LAST6}`,
    },
    cases: [
      {
        scenario: 'A-待审核',
        caseId: String(pending.caseId),
        status: 'pending_review',
        workerName: pendingCasePayload.workerName,
        workerPhone: pendingCasePayload.workerPhone,
        workerIdCardLast6: last6(pendingCasePayload.workerIdCard),
        proxyName: pendingCasePayload.proxyName,
        proxyPhone: pendingCasePayload.proxyPhone,
        expectedLogin: '不可登录（提示代注册待审核）',
      },
      {
        scenario: 'B-已通过待接管',
        caseId: String(approved.caseId),
        status: 'approved',
        workerName: approvedCasePayload.workerName,
        workerPhone: approvedCasePayload.workerPhone,
        workerIdCardLast6: last6(approvedCasePayload.workerIdCard),
        proxyName: approvedCasePayload.proxyName,
        proxyPhone: approvedCasePayload.proxyPhone,
        expectedLogin: '可登录（registerMode=proxy, accountOwnerVerified=0）',
      },
      {
        scenario: 'C-已驳回',
        caseId: String(rejected.caseId),
        status: 'rejected',
        workerName: rejectedCasePayload.workerName,
        workerPhone: rejectedCasePayload.workerPhone,
        workerIdCardLast6: last6(rejectedCasePayload.workerIdCard),
        proxyName: rejectedCasePayload.proxyName,
        proxyPhone: rejectedCasePayload.proxyPhone,
        expectedLogin: '不可登录（提示驳回原因）',
      },
      {
        scenario: 'D-已撤销',
        caseId: String(revoked.caseId),
        status: 'revoked',
        workerName: revokedCasePayload.workerName,
        workerPhone: revokedCasePayload.workerPhone,
        workerIdCardLast6: last6(revokedCasePayload.workerIdCard),
        proxyName: revokedCasePayload.proxyName,
        proxyPhone: revokedCasePayload.proxyPhone,
        expectedLogin: '不可登录（提示撤销原因）',
      },
      {
        scenario: 'E-已接管完成',
        caseId: String(takeover.caseId),
        status: 'takeover_done',
        workerName: takeoverCasePayload.workerName,
        oldWorkerPhone: takeoverCasePayload.workerPhone,
        newWorkerPhone: takeoverNewPhone,
        workerIdCardLast6: last6(takeoverCasePayload.workerIdCard),
        proxyName: takeoverCasePayload.proxyName,
        proxyPhone: takeoverCasePayload.proxyPhone,
        expectedLogin: '新手机号可登录（registerMode=self, accountOwnerVerified=1）',
      },
    ],
  };

  const outputDir = path.join(process.cwd(), 'docs');
  fs.mkdirSync(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, `generated-proxy-test-data-${tag}.json`);
  fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');

  console.log('[6/6] 完成。');
  console.log(JSON.stringify({
    outputPath,
    summary: result.cases.map((item) => ({ scenario: item.scenario, caseId: item.caseId, status: item.status })),
  }, null, 2));
}

main().catch((error) => {
  console.error('GENERATE_PROXY_TEST_DATA_FAILED');
  console.error(error && error.stack ? error.stack : String(error));
  process.exit(1);
});
