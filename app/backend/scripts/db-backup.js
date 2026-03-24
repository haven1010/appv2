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

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function formatTimestamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    '_',
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join('');
}

function readDbConfig() {
  return {
    host: process.env.DB_HOST || process.env.DB_HOSTNAME || '127.0.0.1',
    port: String(process.env.DB_PORT || '3307'),
    username: process.env.DB_USERNAME || process.env.DB_USER || 'pickpass_user',
    password: process.env.DB_PASSWORD || 'pickpass_password',
    database: process.env.DB_DATABASE || 'pickpass_db',
  };
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: options.stdio || ['ignore', 'pipe', 'pipe'],
      env: options.env || process.env,
      cwd: options.cwd || process.cwd(),
    });

    let stderr = '';
    if (child.stderr) {
      child.stderr.on('data', (chunk) => {
        stderr += String(chunk);
      });
    }

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stderr });
        return;
      }
      reject(new Error(`${command} exited with code ${code}${stderr ? `: ${stderr.trim()}` : ''}`));
    });
  });
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

function listBackupFiles(outputDir, prefix) {
  if (!fs.existsSync(outputDir)) {
    return [];
  }

  return fs
    .readdirSync(outputDir)
    .filter((name) => name.startsWith(prefix) && (name.endsWith('.sql') || name.endsWith('.sql.gz')))
    .map((name) => {
      const filePath = path.join(outputDir, name);
      const stat = fs.statSync(filePath);
      return {
        name,
        path: filePath,
        sizeBytes: stat.size,
        modifiedAt: stat.mtime.toISOString(),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

function pruneOldBackups(files, retentionDays) {
  if (!(retentionDays > 0)) {
    return [];
  }

  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const removed = [];
  for (const file of files) {
    const modified = new Date(file.modifiedAt).getTime();
    if (modified < cutoff) {
      fs.unlinkSync(file.path);
      removed.push(file.path);
    }
  }
  return removed;
}

async function createBackup() {
  const db = readDbConfig();
  const mode = getArg('--mode', process.env.DB_BACKUP_MODE || 'auto');
  const dockerContainer = detectDockerContainer(getArg('--docker-container', process.env.DB_DOCKER_CONTAINER || ''));
  const outputDir = path.resolve(
    getArg('--output-dir', process.env.BACKUP_PATH || path.join(process.cwd(), 'backups')),
  );
  const retentionDays = Number(getArg('--retention-days', process.env.BACKUP_RETENTION_DAYS || '30'));
  const compress = !hasFlag('--no-compress');
  const timestamp = formatTimestamp();
  const prefix = `backup_${db.database}_`;
  const sqlFile = path.join(outputDir, `${prefix}${timestamp}.sql`);
  const targetFile = compress ? `${sqlFile}.gz` : sqlFile;

  ensureDir(outputDir);

  const directDumpArgs = [
    `--host=${db.host}`,
    `--port=${db.port}`,
    `--user=${db.username}`,
    '--single-transaction',
    '--quick',
    '--routines',
    '--triggers',
    '--default-character-set=utf8mb4',
    '--set-gtid-purged=OFF',
    db.database,
  ];

  const useDocker = mode === 'docker' || (mode === 'auto' && dockerContainer);
  if (mode === 'docker' && !dockerContainer) {
    throw new Error('docker backup mode requested, but no mysql container was found');
  }

  const dumpCommand = useDocker ? 'docker' : 'mysqldump';
  const dumpArgs = useDocker
    ? [
        'exec',
        '-e',
        `MYSQL_PWD=${db.password}`,
        dockerContainer,
        'mysqldump',
        '--host=127.0.0.1',
        '--port=3306',
        `--user=${db.username}`,
        '--single-transaction',
        '--quick',
        '--routines',
        '--triggers',
        '--default-character-set=utf8mb4',
        '--set-gtid-purged=OFF',
        db.database,
      ]
    : directDumpArgs;

  console.log(
    `[backup] dumping ${db.database} to ${targetFile} via ${useDocker ? `docker:${dockerContainer}` : 'local-mysqldump'}`,
  );

  await new Promise((resolve, reject) => {
    const dump = spawn(dumpCommand, dumpArgs, {
      env: {
        ...process.env,
        MYSQL_PWD: db.password,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stderr = '';
    dump.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });

    const output = fs.createWriteStream(targetFile);
    let settled = false;

    const fail = (error) => {
      if (settled) {
        return;
      }
      settled = true;
      try {
        output.destroy();
      } catch {}
      try {
        fs.unlinkSync(targetFile);
      } catch {}
      reject(error);
    };

    const succeed = () => {
      if (settled) {
        return;
      }
      settled = true;
      resolve();
    };

    let gzipProcess = null;

    output.on('error', fail);

    if (compress) {
      gzipProcess = spawn('gzip', ['-c'], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let gzipErr = '';
      gzipProcess.stderr.on('data', (chunk) => {
        gzipErr += String(chunk);
      });

      dump.stdout.pipe(gzipProcess.stdin);
      gzipProcess.stdout.pipe(output);

      gzipProcess.on('error', fail);
      gzipProcess.on('close', (code) => {
        if (code !== 0) {
          fail(new Error(`gzip exited with code ${code}${gzipErr ? `: ${gzipErr.trim()}` : ''}`));
        }
      });
    } else {
      dump.stdout.pipe(output);
    }

    dump.on('error', fail);
    dump.on('close', (code) => {
      if (code !== 0) {
        fail(new Error(`${dumpCommand} exited with code ${code}${stderr ? `: ${stderr.trim()}` : ''}`));
      }
    });

    output.on('close', succeed);
  });

  const files = listBackupFiles(outputDir, prefix);
  const removed = pruneOldBackups(files, retentionDays);
  const stat = fs.statSync(targetFile);

  console.log(
    JSON.stringify(
      {
        ok: true,
        file: targetFile,
        sizeBytes: stat.size,
        mode: useDocker ? 'docker' : 'local',
        dockerContainer: useDocker ? dockerContainer : null,
        retentionDays,
        removed,
      },
      null,
      2,
    ),
  );
}

function listBackups() {
  const db = readDbConfig();
  const outputDir = path.resolve(
    getArg('--output-dir', process.env.BACKUP_PATH || path.join(process.cwd(), 'backups')),
  );
  const files = listBackupFiles(outputDir, `backup_${db.database}_`);
  console.log(JSON.stringify({ ok: true, outputDir, files }, null, 2));
}

async function main() {
  if (hasFlag('--list')) {
    listBackups();
    return;
  }

  await createBackup();
}

main().catch((error) => {
  console.error('[backup] failed:', error.message || error);
  process.exit(1);
});
