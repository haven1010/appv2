#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const mysql = require('mysql2/promise');

const execFileAsync = promisify(execFile);
const CORE_TABLES = [
  'sys_user',
  'base_info',
  'recruitment_job',
  'daily_signup',
  'labor_salary',
  'salary_payment',
  'job_application',
  'base_cooperation',
  'operation_log',
];

function getArg(name, fallback) {
  const prefix = `${name}=`;
  const raw = process.argv.slice(2);
  const exactIndex = raw.findIndex((item) => item === name);
  if (exactIndex >= 0) {
    return raw[exactIndex + 1] ?? true;
  }
  const prefixed = raw.find((item) => item.startsWith(prefix));
  if (prefixed) {
    return prefixed.slice(prefix.length);
  }
  return fallback;
}

function hasFlag(name) {
  return process.argv.slice(2).includes(name);
}

function formatTimestamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join('');
}

function readDbConfig() {
  return {
    host: process.env.DB_HOST || process.env.DB_HOSTNAME || '127.0.0.1',
    port: Number(process.env.DB_PORT || '3306'),
    username: process.env.DB_USERNAME || process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '123456',
    database: process.env.DB_DATABASE || 'pickpass_db',
    adminUsername: process.env.DB_ADMIN_USERNAME || process.env.DB_USERNAME || process.env.DB_USER || 'root',
    adminPassword: process.env.DB_ADMIN_PASSWORD || process.env.DB_PASSWORD || '123456',
    grantHost: process.env.DB_GRANT_HOST || '%',
    mode: process.env.DB_BACKUP_MODE || 'auto',
    dockerContainer: process.env.DB_DOCKER_CONTAINER || '',
  };
}

function resolveBackupFile() {
  const explicit = getArg('--file');
  if (explicit) {
    const filePath = path.resolve(explicit);
    if (!fs.existsSync(filePath)) {
      throw new Error(`backup file not found: ${filePath}`);
    }
    return filePath;
  }

  const backupDir = path.resolve(getArg('--output-dir', process.env.BACKUP_PATH || path.join(process.cwd(), 'backups')));
  if (!fs.existsSync(backupDir)) {
    throw new Error(`backup directory not found: ${backupDir}`);
  }

  const files = fs
    .readdirSync(backupDir)
    .filter((name) => name.endsWith('.sql') || name.endsWith('.sql.gz'))
    .sort();

  if (files.length === 0) {
    throw new Error(`no backup files found in ${backupDir}`);
  }

  return path.join(backupDir, files[files.length - 1]);
}

async function getServerConnection(config) {
  return mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.adminUsername,
    password: config.adminPassword,
    multipleStatements: false,
  });
}

async function getTableCounts(connection, database) {
  const result = {};
  for (const table of CORE_TABLES) {
    const [rows] = await connection.query(`SELECT COUNT(*) AS cnt FROM \`${database}\`.\`${table}\``);
    result[table] = Number(rows[0].cnt);
  }
  return result;
}

async function getTablePresence(connection, database) {
  const [rows] = await connection.query(
    `
      SELECT TABLE_NAME
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = ?
      ORDER BY TABLE_NAME
    `,
    [database],
  );
  return rows.map((row) => row.TABLE_NAME);
}

async function restoreIntoTempDb(backupFile, tempDb, config) {
  const restoreScript = path.resolve(process.cwd(), 'scripts', 'db-restore.js');
  const env = {
    ...process.env,
    DB_HOST: config.host,
    DB_PORT: String(config.port),
    DB_USERNAME: config.username,
    DB_PASSWORD: config.password,
    DB_RESTORE_USERNAME: config.adminUsername,
    DB_RESTORE_PASSWORD: config.adminPassword,
    DB_DATABASE: tempDb,
    DB_BACKUP_MODE: config.mode,
    DB_DOCKER_CONTAINER: config.dockerContainer,
  };

  const args = [
    restoreScript,
    '--file',
    backupFile,
    '--confirm',
    `RESTORE ${tempDb}`,
  ];

  const { stdout, stderr } = await execFileAsync(process.execPath, args, {
    cwd: process.cwd(),
    env,
  });

  return {
    stdout: stdout.trim(),
    stderr: stderr.trim(),
  };
}

async function main() {
  const config = readDbConfig();
  const backupFile = resolveBackupFile();
  const keepDb = hasFlag('--keep-db');
  const prefix = getArg('--temp-db-prefix', 'pickpass_restore_drill');
  const tempDb = `${prefix}_${formatTimestamp()}`;

  console.log(`[drill] using backup ${backupFile}`);
  console.log(`[drill] temp database ${tempDb}`);

  const server = await getServerConnection(config);
  let dropped = false;

  try {
    const sourceTables = await getTablePresence(server, config.database);
    for (const table of CORE_TABLES) {
      if (!sourceTables.includes(table)) {
        throw new Error(`source database missing required table: ${table}`);
      }
    }

    const sourceCounts = await getTableCounts(server, config.database);

    await server.query(`CREATE DATABASE \`${tempDb}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await server.query(
      `GRANT ALL PRIVILEGES ON \`${tempDb}\`.* TO '${config.username}'@'${config.grantHost}'`,
    );
    const restoreResult = await restoreIntoTempDb(backupFile, tempDb, config);

    const restoredTables = await getTablePresence(server, tempDb);
    const restoredCounts = await getTableCounts(server, tempDb);

    for (const table of CORE_TABLES) {
      if (!restoredTables.includes(table)) {
        throw new Error(`restored database missing required table: ${table}`);
      }
      if (sourceCounts[table] !== restoredCounts[table]) {
        throw new Error(
          `row count mismatch for ${table}: source=${sourceCounts[table]}, restored=${restoredCounts[table]}`,
        );
      }
    }

    if (!keepDb) {
      await server.query(`DROP DATABASE \`${tempDb}\``);
      dropped = true;
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          backupFile,
          sourceDatabase: config.database,
          tempDatabase: tempDb,
          dropped,
          counts: restoredCounts,
          restoreStdout: restoreResult.stdout,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    if (!dropped && !keepDb) {
      try {
        await server.query(`DROP DATABASE IF EXISTS \`${tempDb}\``);
        dropped = true;
      } catch {}
    }
    throw error;
  } finally {
    await server.end();
  }
}

main().catch((error) => {
  console.error('[drill] failed:', error.message || error);
  process.exit(1);
});
