#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { spawn, execFileSync } = require('child_process');

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

function readDbConfig() {
  return {
    host: process.env.DB_HOST || process.env.DB_HOSTNAME || '127.0.0.1',
    port: String(process.env.DB_PORT || '3306'),
    username:
      process.env.DB_RESTORE_USERNAME ||
      process.env.DB_USERNAME ||
      process.env.DB_USER ||
      'root',
    password: process.env.DB_RESTORE_PASSWORD || process.env.DB_PASSWORD || '123456',
    database: process.env.DB_DATABASE || 'pickpass_db',
  };
}

function commandExists(command) {
  try {
    execFileSync('sh', ['-lc', `command -v ${command}`], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function detectDockerContainer(preferred) {
  if (!commandExists('docker')) {
    return null;
  }
  if (preferred) {
    return preferred;
  }

  try {
    const output = execFileSync('docker', ['ps', '--format', '{{.Names}}\t{{.Image}}'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const candidates = output
      .trim()
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [name, image] = line.split('\t');
        return { name, image };
      })
      .filter((item) => /mysql|mariadb/i.test(item.image));

    if (candidates.length === 1) {
      return candidates[0].name;
    }
    return candidates.find((item) => item.name === 'pickpass_mysql')?.name || null;
  } catch {
    return null;
  }
}

function requireConfirmation(filePath, database) {
  const expected = `RESTORE ${database}`;
  const confirm = getArg('--confirm', process.env.DB_RESTORE_CONFIRM || '');
  if (!hasFlag('--force') && confirm !== expected) {
    throw new Error(
      `restore is destructive; rerun with --force or --confirm "${expected}" for file ${filePath}`,
    );
  }
}

async function main() {
  const db = readDbConfig();
  const mode = getArg('--mode', process.env.DB_BACKUP_MODE || 'auto');
  const dockerContainer = detectDockerContainer(getArg('--docker-container', process.env.DB_DOCKER_CONTAINER || ''));
  const fileArg = getArg('--file');
  if (!fileArg) {
    throw new Error('missing required --file <backup.sql|backup.sql.gz>');
  }

  const filePath = path.resolve(fileArg);
  if (!fs.existsSync(filePath)) {
    throw new Error(`backup file not found: ${filePath}`);
  }

  if (!filePath.endsWith('.sql') && !filePath.endsWith('.sql.gz')) {
    throw new Error('backup file must end with .sql or .sql.gz');
  }

  requireConfirmation(filePath, db.database);

  const useDocker = mode === 'docker' || (mode === 'auto' && dockerContainer);
  if (mode === 'docker' && !dockerContainer) {
    throw new Error('docker restore mode requested, but no mysql container was found');
  }

  console.log(
    `[restore] restoring ${filePath} into ${db.database} via ${useDocker ? `docker:${dockerContainer}` : `${db.host}:${db.port}`}`,
  );

  await new Promise((resolve, reject) => {
    const mysql = spawn(
      useDocker ? 'docker' : 'mysql',
      useDocker
        ? [
            'exec',
            '-i',
            '-e',
            `MYSQL_PWD=${db.password}`,
            dockerContainer,
            'mysql',
            '--host=127.0.0.1',
            '--port=3306',
            `--user=${db.username}`,
            db.database,
          ]
        : [
            `--host=${db.host}`,
            `--port=${db.port}`,
            `--user=${db.username}`,
            db.database,
          ],
      {
        env: {
          ...process.env,
          MYSQL_PWD: db.password,
        },
        stdio: ['pipe', 'pipe', 'pipe'],
      },
    );

    let stderr = '';
    mysql.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });

    let inputProcess = null;
    if (filePath.endsWith('.gz')) {
      inputProcess = spawn('gunzip', ['-c', filePath], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let gunzipErr = '';
      inputProcess.stderr.on('data', (chunk) => {
        gunzipErr += String(chunk);
      });
      inputProcess.stdout.pipe(mysql.stdin);
      inputProcess.on('error', reject);
      inputProcess.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`gunzip exited with code ${code}${gunzipErr ? `: ${gunzipErr.trim()}` : ''}`));
        }
      });
    } else {
      const input = fs.createReadStream(filePath);
      input.on('error', reject);
      input.pipe(mysql.stdin);
      inputProcess = input;
    }

    mysql.on('error', reject);
    mysql.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`${useDocker ? 'docker' : 'mysql'} exited with code ${code}${stderr ? `: ${stderr.trim()}` : ''}`));
        return;
      }
      resolve();
    });
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        restoredFrom: filePath,
        database: db.database,
        mode: useDocker ? 'docker' : 'local',
        dockerContainer: useDocker ? dockerContainer : null,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error('[restore] failed:', error.message || error);
  process.exit(1);
});
