const path = require('path');
const crypto = require('crypto');
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const CURRENT_ENCRYPTION_VERSION = 'v2';
const ALGORITHM = 'aes-256-cbc';

function normalizeKey(input) {
  const raw = Buffer.from(input, 'utf8');
  if (raw.length === 32) return raw;
  if (raw.length < 32) return crypto.createHash('sha256').update(input).digest();
  return raw.subarray(0, 32);
}

function getRequiredEncryptionKey() {
  const key = process.env.AES_KEY;
  if (!key) {
    throw new Error('AES_KEY is required in apps/backend/.env');
  }
  return normalizeKey(key);
}

function encryptSensitiveValue(plaintext) {
  if (!plaintext) return plaintext;

  const key = getRequiredEncryptionKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  return `${CURRENT_ENCRYPTION_VERSION}:${iv.toString('hex')}:${encrypted}`;
}

function hashSensitiveValue(value) {
  if (!value) return value;
  return crypto.createHash('sha256').update(value).digest('hex');
}

function buildFixedCredentials(userId) {
  const phone = `138${String(userId).padStart(8, '0')}`;
  const idCard = `33010619900101${String(userId).padStart(4, '0')}`;
  const idCardLast6 = idCard.slice(-6);

  return {
    phone,
    idCard,
    idCardLast6,
    phoneHash: hashSensitiveValue(phone),
    idCardHash: hashSensitiveValue(idCard),
    phoneEnc: encryptSensitiveValue(phone),
    idCardEnc: encryptSensitiveValue(idCard),
  };
}

function dbConfigFromEnv() {
  return {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || '123456',
    database: process.env.DB_DATABASE || 'pickpass_db',
  };
}

async function fetchFixedUsers(connection) {
  const [rows] = await connection.execute(
    `SELECT id, uid, name, role_key, is_deleted
     FROM sys_user
     WHERE id BETWEEN 1 AND 11
     ORDER BY id ASC`,
  );
  return rows;
}

async function applyBaseline(connection, rows) {
  let updated = 0;

  for (const row of rows) {
    if (row.is_deleted) {
      console.log(`skip id=${row.id} (${row.name}): user is deleted`);
      continue;
    }

    const fixed = buildFixedCredentials(row.id);

    await connection.execute(
      `UPDATE sys_user
       SET phone_enc = ?,
           phone_hash = ?,
           id_card_enc = ?,
           id_card_hash = ?,
           info_audit_status = 1
       WHERE id = ?`,
      [fixed.phoneEnc, fixed.phoneHash, fixed.idCardEnc, fixed.idCardHash, row.id],
    );

    updated += 1;
    console.log(
      `updated id=${row.id} ${row.name} (${row.role_key}) -> phone=${fixed.phone}, password=${fixed.idCardLast6}`,
    );
  }

  return updated;
}

async function verifyBaseline(connection) {
  const [verifyRows] = await connection.execute(
    `SELECT id,
            uid,
            name,
            role_key,
            is_deleted,
            phone_hash = SHA2(CONCAT('138', LPAD(id, 8, '0')), 256) AS phone_hash_ok,
            id_card_hash = SHA2(CONCAT('33010619900101', LPAD(id, 4, '0')), 256) AS id_card_hash_ok
     FROM sys_user
     WHERE id BETWEEN 1 AND 11
     ORDER BY id ASC`,
  );

  return verifyRows;
}

function printLoginList(rows) {
  console.log('\nVerified login list (id 1..11):');
  for (const row of rows) {
    if (row.is_deleted) continue;
    const phone = `138${String(row.id).padStart(8, '0')}`;
    const idCardLast6 = `010${String(row.id).padStart(3, '0')}`;
    console.log(
      `id=${row.id} uid=${row.uid} name=${row.name} role=${row.role_key} phone=${phone} password=${idCardLast6}`,
    );
  }
}

async function main() {
  const checkOnly = process.argv.includes('--check');
  const config = dbConfigFromEnv();

  const connection = await mysql.createConnection(config);
  try {
    const rows = await fetchFixedUsers(connection);
    if (rows.length === 0) {
      throw new Error('No users found in id range 1..11. Import baseline SQL first.');
    }

    if (!checkOnly) {
      const updated = await applyBaseline(connection, rows);
      console.log(`\nApplied login baseline for ${updated} users.`);
    }

    const verifyRows = await verifyBaseline(connection);
    const badRows = verifyRows.filter(
      (r) => !r.is_deleted && (!r.phone_hash_ok || !r.id_card_hash_ok),
    );

    if (badRows.length > 0) {
      console.error('\nBaseline check failed for users:');
      for (const row of badRows) {
        console.error(
          `id=${row.id} name=${row.name} phone_hash_ok=${row.phone_hash_ok} id_card_hash_ok=${row.id_card_hash_ok}`,
        );
      }
      process.exitCode = 1;
      return;
    }

    console.log('\nBaseline check passed.');
    printLoginList(verifyRows);
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
