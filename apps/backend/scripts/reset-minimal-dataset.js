const path = require('path');
const crypto = require('crypto');
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const CURRENT_ENCRYPTION_VERSION = 'v2';
const ALGORITHM = 'aes-256-cbc';
const DEFAULT_AES_IV = '0123456789012345';

function sha256(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function normalizeKey(input) {
  const raw = Buffer.from(String(input || ''), 'utf8');
  if (raw.length === 32) return raw;
  if (raw.length < 32) return crypto.createHash('sha256').update(raw).digest();
  return raw.subarray(0, 32);
}

function encryptSensitiveValue(value, key) {
  const text = String(value || '').trim();
  if (!text) return null;
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${CURRENT_ENCRYPTION_VERSION}:${iv.toString('hex')}:${encrypted}`;
}

function parseArgValue(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return '';
  return String(process.argv[idx + 1] || '').trim();
}

function resolveDbPassword() {
  const cli = parseArgValue('--db-password');
  if (cli) return { value: cli, source: '--db-password' };

  const mysqlPwd = String(process.env.MYSQL_PWD || '').trim();
  if (mysqlPwd) return { value: mysqlPwd, source: 'MYSQL_PWD' };

  const envPwd = String(process.env.DB_PASSWORD || '').trim();
  if (envPwd) return { value: envPwd, source: '.env(DB_PASSWORD)' };

  return { value: '', source: 'missing' };
}

async function getBaseTables(connection, dbName) {
  const [rows] = await connection.execute(
    `SELECT table_name AS tableName
       FROM information_schema.tables
      WHERE table_schema = ?
        AND table_type = 'BASE TABLE'`,
    [dbName],
  );

  return rows
    .map((item) => item.tableName ?? item.table_name ?? item.TABLE_NAME ?? Object.values(item)[0])
    .map((name) => String(name || '').trim())
    .filter(Boolean);
}

async function hasColumn(connection, dbName, tableName, columnName) {
  const [rows] = await connection.execute(
    `SELECT 1
       FROM information_schema.columns
      WHERE table_schema = ?
        AND table_name = ?
        AND column_name = ?
      LIMIT 1`,
    [dbName, tableName, columnName],
  );
  return Boolean(rows[0]);
}

function buildRoleUsers() {
  return [
    {
      roleKey: 'worker',
      name: 'Worker Demo',
      phone: '13800000001',
      idCard: '610101199001010001',
      regionCode: 610100,
    },
    {
      roleKey: 'boss',
      name: 'Boss Demo',
      phone: '13800000002',
      idCard: '610101199001010002',
      regionCode: 610100,
    },
    {
      roleKey: 'base_manager',
      name: 'Base Manager Demo',
      phone: '13800000003',
      idCard: '610101199001010003',
      regionCode: 610100,
    },
    {
      roleKey: 'field_manager',
      name: 'Field Manager Demo',
      phone: '13800000004',
      idCard: '610101199001010004',
      regionCode: 610100,
    },
    {
      roleKey: 'super_admin',
      name: 'Super Admin Demo',
      phone: '13800000005',
      idCard: '610101199001010005',
      regionCode: 610100,
    },
  ];
}

function makeUid(roleKey, index) {
  return `UMINI_${roleKey.toUpperCase()}_${String(index).padStart(2, '0')}`;
}

async function insertUser(connection, dbName, key, payload) {
  const columns = [
    'uid',
    'name',
    'id_card_enc',
    'phone_enc',
    'id_card_hash',
    'role_key',
    'face_img_url',
    'region_code',
    'is_deleted',
    'phone_hash',
    'info_audit_status',
  ];

  const values = [
    payload.uid,
    payload.name,
    encryptSensitiveValue(payload.idCard, key),
    encryptSensitiveValue(payload.phone, key),
    sha256(payload.idCard),
    payload.roleKey,
    '',
    payload.regionCode,
    0,
    sha256(payload.phone),
    0,
  ];

  if (await hasColumn(connection, dbName, 'sys_user', 'gender')) {
    columns.push('gender');
    values.push('male');
  }

  if (await hasColumn(connection, dbName, 'sys_user', 'is_poor_household')) {
    columns.push('is_poor_household');
    values.push(0);
  }

  if (await hasColumn(connection, dbName, 'sys_user', 'register_mode')) {
    columns.push('register_mode');
    values.push('self');
  }

  if (await hasColumn(connection, dbName, 'sys_user', 'account_owner_verified')) {
    columns.push('account_owner_verified');
    values.push(1);
  }

  if (await hasColumn(connection, dbName, 'sys_user', 'login_lock_reason')) {
    columns.push('login_lock_reason');
    values.push(null);
  }

  if (await hasColumn(connection, dbName, 'sys_user', 'assigned_base_id')) {
    columns.push('assigned_base_id');
    values.push(payload.assignedBaseId ?? null);
  }

  const placeholders = columns.map(() => '?').join(', ');
  const sql = `INSERT INTO sys_user (${columns.join(', ')}) VALUES (${placeholders})`;
  const [result] = await connection.execute(sql, values);
  return Number(result.insertId);
}

async function insertBase(connection, dbName, key, ownerId) {
  const descriptionPayload = JSON.stringify({
    salary: '日结 220 元',
    jobDescription: '负责果园采摘与分拣，提供午餐与工具。',
    workEnvImages: [
      'https://example.com/work-env-1.jpg',
      'https://example.com/work-env-2.jpg',
    ],
    companyAdminContact: {
      name: 'Boss Demo',
      phone: '13800000002',
    },
    auditFlow: 'boss_submit_super_admin_review',
  });

  const columns = [
    'base_name',
    'license_enc',
    'contact_enc',
    'category',
    'region_code',
    'address',
    'description',
    'audit_status',
    'owner_id',
    'is_deleted',
  ];

  const values = [
    'Demo Base (Only One)',
    encryptSensitiveValue('https://example.com/license-demo.jpg', key),
    encryptSensitiveValue('13800000002', key),
    1,
    610100,
    'Xi an Test Road No.1',
    descriptionPayload,
    0,
    ownerId,
    0,
  ];

  const placeholders = columns.map(() => '?').join(', ');
  const sql = `INSERT INTO base_info (${columns.join(', ')}) VALUES (${placeholders})`;
  const [result] = await connection.execute(sql, values);
  return Number(result.insertId);
}

function loginPasswordHint(idCard) {
  return String(idCard).slice(-6);
}

async function main() {
  const dbPassword = resolveDbPassword();
  const dbName = String(process.env.DB_DATABASE || '').trim();
  if (!dbName) {
    throw new Error('DB_DATABASE is required');
  }

  const aesKeySeed = String(process.env.AES_KEY || '').trim();
  if (!aesKeySeed) {
    throw new Error('AES_KEY is required');
  }
  const aesIvSeed = String(process.env.AES_IV || DEFAULT_AES_IV).trim();
  if (!aesIvSeed) {
    throw new Error('AES_IV is required');
  }

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USERNAME,
    password: dbPassword.value,
    database: dbName,
    charset: 'utf8mb4',
  });

  const key = normalizeKey(aesKeySeed);

  try {
    const tables = await getBaseTables(connection, dbName);
    if (!tables.length) throw new Error(`No tables found in ${dbName}`);

    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const table of tables) {
      await connection.query(`TRUNCATE TABLE \`${table}\``);
    }
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');

    const roleUsers = buildRoleUsers();
    const createdUserIds = {};

    for (let i = 0; i < roleUsers.length; i += 1) {
      const user = roleUsers[i];
      if (user.roleKey === 'field_manager') continue;
      const userId = await insertUser(connection, dbName, key, {
        ...user,
        uid: makeUid(user.roleKey, i + 1),
      });
      createdUserIds[user.roleKey] = userId;
    }

    const baseId = await insertBase(connection, dbName, key, createdUserIds.boss);

    const fieldManagerUser = roleUsers.find((item) => item.roleKey === 'field_manager');
    const fieldManagerId = await insertUser(connection, dbName, key, {
      ...fieldManagerUser,
      uid: makeUid('field_manager', 4),
      assignedBaseId: baseId,
    });
    createdUserIds.field_manager = fieldManagerId;

    console.log('\nReset completed');
    console.log(`- Users: ${Object.keys(createdUserIds).length}`);
    console.log(`- Bases: 1 (ID=${baseId})`);

    console.log('\nTest accounts (phone / password=idCard last 6):');
    for (const user of roleUsers) {
      console.log(`- ${user.roleKey}: ${user.phone} / ${loginPasswordHint(user.idCard)}`);
    }
  } finally {
    try {
      await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    } catch (_) {
      // noop
    }
    await connection.end();
  }
}

main().catch((error) => {
  const dbPasswordSource = resolveDbPassword().source;
  console.error(`Reset failed: ${error.message || error}`);
  console.error(`Password source: ${dbPasswordSource}`);
  process.exit(1);
});

