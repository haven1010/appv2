/**
 * 为各角色创建测试用户。
 * 使用前请先启动后端: npm run start:dev
 * 运行: node scripts/seed-users.js
 *
 * 公开注册只会创建 worker。
 * 管理员和次级 super_admin 通过受保护接口创建，需要先提供一个现有 super_admin 的登录信息：
 * SUPER_ADMIN_PHONE=13800000010 SUPER_ADMIN_IDCARD_LAST6=001010 node scripts/seed-users.js
 */

const API_BASE = process.env.API_BASE || 'http://localhost:3001';
const BOOTSTRAP_SUPER_ADMIN_PHONE = process.env.SUPER_ADMIN_PHONE;
const BOOTSTRAP_SUPER_ADMIN_IDCARD_LAST6 = process.env.SUPER_ADMIN_IDCARD_LAST6;

const USERS = [
  { name: '采摘工测试', roleKey: 'worker', phone: '13800000001', idCard: '330106199001011234' },
  { name: '企业老板测试', roleKey: 'boss', phone: '13800000006', idCard: '330106199006061234' },
  { name: '基地管理员测试', roleKey: 'base_manager', phone: '13800000002', idCard: '330106199002021234' },
  { name: '现场管理员测试', roleKey: 'field_manager', phone: '13800000004', idCard: '330106199004041234', assignedBaseId: 1 },
  { name: '次级超级管理员测试', roleKey: 'super_admin', phone: '13800000005', idCard: '330106199005051234' },
];

function buildBody(user) {
  return {
    name: user.name,
    idCard: user.idCard,
    phone: user.phone,
    roleKey: user.roleKey,
    assignedBaseId: user.assignedBaseId,
  };
}

function extractErrorMessage(data, fallback) {
  if (Array.isArray(data?.message)) return data.message[0];
  return data?.message || fallback;
}

async function registerWorker(user) {
  const res = await fetch(`${API_BASE}/api/user/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildBody(user)),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(extractErrorMessage(data, res.statusText));
  }
  return data;
}

async function registerBoss(user) {
  const res = await fetch(`${API_BASE}/api/user/register/boss`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildBody(user)),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(extractErrorMessage(data, res.statusText));
  }
  return data;
}

async function registerPublicUser(user) {
  if (user.roleKey === 'boss') return registerBoss(user);
  return registerWorker(user);
}

async function loginAsBootstrapSuperAdmin() {
  if (!BOOTSTRAP_SUPER_ADMIN_PHONE || !BOOTSTRAP_SUPER_ADMIN_IDCARD_LAST6) {
    return null;
  }

  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone: BOOTSTRAP_SUPER_ADMIN_PHONE,
      idCardLast6: BOOTSTRAP_SUPER_ADMIN_IDCARD_LAST6,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`超级管理员登录失败: ${extractErrorMessage(data, res.statusText)}`);
  }
  return data.access_token;
}

async function createManagedUser(user, token) {
  const endpoint = user.roleKey === 'super_admin'
    ? '/api/user/admin/super-admin'
    : '/api/user/admin';

  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(buildBody(user)),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(extractErrorMessage(data, res.statusText));
  }
  return data;
}

function isDuplicateError(error) {
  return Boolean(
    error?.message && (
      error.message.includes('Duplicate') ||
      error.message.includes('已存在') ||
      error.message.includes('已被注册') ||
      error.message.includes('重复')
    ),
  );
}

async function main() {
  console.log('API 地址:', API_BASE);
  console.log('开始创建测试用户...\n');

  const publicUsers = USERS.filter((user) => user.roleKey === 'worker' || user.roleKey === 'boss');
  const managedUsers = USERS.filter((user) => user.roleKey !== 'worker' && user.roleKey !== 'boss');

  for (const user of publicUsers) {
    try {
      const result = await registerPublicUser(user);
      console.log(`[OK] ${user.name} (${user.roleKey}) -> UID: ${result.uid || result.id}`);
    } catch (error) {
      if (isDuplicateError(error)) {
        console.log(`[跳过] ${user.name} (${user.roleKey}) 已存在`);
      } else {
        console.error(`[失败] ${user.name} (${user.roleKey}):`, error.message);
      }
    }
  }

  const token = await loginAsBootstrapSuperAdmin();
  if (!token) {
    console.log('\n未提供 SUPER_ADMIN_PHONE / SUPER_ADMIN_IDCARD_LAST6，跳过管理员和次级超级管理员创建。');
    console.log('如需继续，请先准备好首个 super_admin，再重新执行脚本。');
    return;
  }

  for (const user of managedUsers) {
    try {
      const result = await createManagedUser(user, token);
      console.log(`[OK] ${user.name} (${user.roleKey}) -> UID: ${result.uid || result.id}`);
    } catch (error) {
      if (isDuplicateError(error)) {
        console.log(`[跳过] ${user.name} (${user.roleKey}) 已存在`);
      } else {
        console.error(`[失败] ${user.name} (${user.roleKey}):`, error.message);
      }
    }
  }

  console.log('\n完成。登录方式：手机号 + 身份证后6位。');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
