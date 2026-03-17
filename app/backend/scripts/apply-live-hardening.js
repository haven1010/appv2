require('dotenv').config({ path: '.env' });

const mysql = require('mysql2/promise');

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_DATABASE || 'pickpass_db',
  });

  const schema = process.env.DB_DATABASE || 'pickpass_db';

  async function queryOne(sql, params = []) {
    const [rows] = await connection.query(sql, params);
    return rows[0] || null;
  }

  async function queryAll(sql, params = []) {
    const [rows] = await connection.query(sql, params);
    return rows;
  }

  async function hasIndex(tableName, indexName) {
    const row = await queryOne(
      `SELECT 1
       FROM information_schema.statistics
       WHERE table_schema = ? AND table_name = ? AND index_name = ?
       LIMIT 1`,
      [schema, tableName, indexName],
    );
    return Boolean(row);
  }

  async function hasConstraint(tableName, constraintName) {
    const row = await queryOne(
      `SELECT 1
       FROM information_schema.table_constraints
       WHERE table_schema = ? AND table_name = ? AND constraint_name = ?
       LIMIT 1`,
      [schema, tableName, constraintName],
    );
    return Boolean(row);
  }

  async function ensureNoRows(sql, label) {
    const rows = await queryAll(sql);
    if (rows.length > 0) {
      throw new Error(`${label} check failed: ${JSON.stringify(rows)}`);
    }
  }

  console.log('Running live schema hardening checks...');

  await ensureNoRows(
    `SELECT phone_hash, COUNT(*) AS c
     FROM sys_user
     WHERE phone_hash IS NOT NULL
     GROUP BY phone_hash
     HAVING c > 1`,
    'duplicate sys_user.phone_hash',
  );

  await ensureNoRows(
    `SELECT id_card_hash, COUNT(*) AS c
     FROM sys_user
     GROUP BY id_card_hash
     HAVING c > 1`,
    'duplicate sys_user.id_card_hash',
  );

  await ensureNoRows(
    `SELECT user_id, base_id, work_date, COUNT(*) AS c
     FROM daily_signup
     GROUP BY user_id, base_id, work_date
     HAVING c > 1`,
    'duplicate daily_signup(user_id, base_id, work_date)',
  );

  await ensureNoRows(
    `SELECT salary_id, COUNT(*) AS c
     FROM salary_payment
     GROUP BY salary_id
     HAVING c > 1`,
    'duplicate salary_payment.salary_id',
  );

  await ensureNoRows(
    `SELECT b.id, b.owner_id
     FROM base_info b
     LEFT JOIN sys_user u ON u.id = b.owner_id
     WHERE u.id IS NULL`,
    'orphan base_info.owner_id',
  );

  await ensureNoRows(
    `SELECT u.id, u.assigned_base_id
     FROM sys_user u
     LEFT JOIN base_info b ON b.id = u.assigned_base_id
     WHERE u.assigned_base_id IS NOT NULL AND b.id IS NULL`,
    'orphan sys_user.assigned_base_id',
  );

  await ensureNoRows(
    `SELECT s.id, s.proxy_user_id
     FROM daily_signup s
     LEFT JOIN sys_user u ON u.id = s.proxy_user_id
     WHERE s.proxy_user_id IS NOT NULL AND u.id IS NULL`,
    'orphan daily_signup.proxy_user_id',
  );

  await ensureNoRows(
    `SELECT s.id, s.admin_id
     FROM labor_salary s
     LEFT JOIN sys_user u ON u.id = s.admin_id
     WHERE u.id IS NULL`,
    'orphan labor_salary.admin_id',
  );

  console.log('Checks passed. Applying schema changes...');

  if (!(await hasIndex('sys_user', 'UQ_sys_user_id_card_hash'))) {
    await connection.query(
      'ALTER TABLE sys_user ADD UNIQUE KEY UQ_sys_user_id_card_hash (id_card_hash)',
    );
    console.log('Added UQ_sys_user_id_card_hash');
  }

  if (!(await hasIndex('sys_user', 'UQ_sys_user_phone_hash'))) {
    await connection.query(
      'ALTER TABLE sys_user ADD UNIQUE KEY UQ_sys_user_phone_hash (phone_hash)',
    );
    console.log('Added UQ_sys_user_phone_hash');
  }

  if (!(await hasConstraint('sys_user', 'FK_sys_user_assigned_base'))) {
    await connection.query(
      'ALTER TABLE sys_user ADD CONSTRAINT FK_sys_user_assigned_base FOREIGN KEY (assigned_base_id) REFERENCES base_info(id) ON DELETE SET NULL',
    );
    console.log('Added FK_sys_user_assigned_base');
  }

  if (!(await hasConstraint('base_info', 'FK_base_info_owner'))) {
    await connection.query(
      'ALTER TABLE base_info ADD CONSTRAINT FK_base_info_owner FOREIGN KEY (owner_id) REFERENCES sys_user(id) ON DELETE RESTRICT',
    );
    console.log('Added FK_base_info_owner');
  }

  if (await hasIndex('daily_signup', 'IDX_96b07a56d0da164eab16b1b9b6')) {
    if (!(await hasIndex('daily_signup', 'IDX_daily_signup_user_id'))) {
      await connection.query(
        'ALTER TABLE daily_signup ADD INDEX IDX_daily_signup_user_id (user_id)',
      );
      console.log('Added IDX_daily_signup_user_id');
    }
    await connection.query(
      'ALTER TABLE daily_signup DROP INDEX IDX_96b07a56d0da164eab16b1b9b6',
    );
    console.log('Dropped old daily_signup unique index');
  }

  if (!(await hasIndex('daily_signup', 'UQ_daily_signup_user_base_date'))) {
    await connection.query(
      'ALTER TABLE daily_signup ADD UNIQUE KEY UQ_daily_signup_user_base_date (user_id, base_id, work_date)',
    );
    console.log('Added UQ_daily_signup_user_base_date');
  }

  if (!(await hasConstraint('daily_signup', 'FK_daily_signup_proxy_user'))) {
    await connection.query(
      'ALTER TABLE daily_signup ADD CONSTRAINT FK_daily_signup_proxy_user FOREIGN KEY (proxy_user_id) REFERENCES sys_user(id) ON DELETE SET NULL',
    );
    console.log('Added FK_daily_signup_proxy_user');
  }

  if (!(await hasConstraint('labor_salary', 'FK_labor_salary_admin'))) {
    await connection.query(
      'ALTER TABLE labor_salary ADD CONSTRAINT FK_labor_salary_admin FOREIGN KEY (admin_id) REFERENCES sys_user(id) ON DELETE RESTRICT',
    );
    console.log('Added FK_labor_salary_admin');
  }

  if (!(await hasIndex('salary_payment', 'UQ_salary_payment_salary_id'))) {
    await connection.query(
      'ALTER TABLE salary_payment ADD UNIQUE KEY UQ_salary_payment_salary_id (salary_id)',
    );
    console.log('Added UQ_salary_payment_salary_id');
  }

  console.log('Live schema hardening completed.');
  await connection.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
