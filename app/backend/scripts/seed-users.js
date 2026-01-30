/**
 * 为各角色各创建一个测试用户。
 * 使用前请先启动后端: npm run start:dev
 * 运行: node scripts/seed-users.js
 */

const API_BASE = process.env.API_BASE || 'http://localhost:3001';

const USERS = [
  { name: '采摘工测试', roleKey: 'worker', phone: '13800000001', idCard: '330106199001011234' },
  { name: '基地管理员测试', roleKey: 'base_manager', phone: '13800000002', idCard: '330106199002021234' },
  { name: '区域管理员测试', roleKey: 'region_admin', phone: '13800000003', idCard: '330106199003031234', regionCode: 3301 },
  { name: '现场管理员测试', roleKey: 'field_manager', phone: '13800000004', idCard: '330106199004041234' },
  { name: '超级管理员测试', roleKey: 'super_admin', phone: '13800000005', idCard: '330106199005051234', regionCode: 3301 },
];

async function register(user) {
  const body = {
    name: user.name,
    idCard: user.idCard,
    phone: user.phone,
    roleKey: user.roleKey,
  };
  if (user.regionCode != null) body.regionCode = user.regionCode;

  const res = await fetch(`${API_BASE}/api/user/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || data.message?.[0] || res.statusText);
  }
  return data;
}

async function main() {
  console.log('API 地址:', API_BASE);
  console.log('开始为各角色创建用户...\n');

  for (const u of USERS) {
    try {
      const result = await register(u);
      console.log(`[OK] ${u.name} (${u.roleKey}) -> UID: ${result.uid || result.id}`);
    } catch (e) {
      if (e.message && (e.message.includes('Duplicate') || e.message.includes('已存在') || e.message.includes('重复'))) {
        console.log(`[跳过] ${u.name} (${u.roleKey}) 已存在`);
      } else {
        console.error(`[失败] ${u.name} (${u.roleKey}):`, e.message);
      }
    }
  }

  console.log('\n完成。登录方式：手机号 + 身份证后6位（如 13800000001 / 011234）');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
