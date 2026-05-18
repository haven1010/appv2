require('dotenv').config({ path: '.env' });

const mysql = require('mysql2/promise');

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || '123456',
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

  async function hasCheckConstraint(tableName, constraintName) {
    const row = await queryOne(
      `SELECT 1
       FROM information_schema.table_constraints
       WHERE table_schema = ?
         AND table_name = ?
         AND constraint_type = 'CHECK'
         AND constraint_name = ?
       LIMIT 1`,
      [schema, tableName, constraintName],
    );
    return Boolean(row);
  }

  async function hasColumn(tableName, columnName) {
    const row = await queryOne(
      `SELECT 1
       FROM information_schema.columns
       WHERE table_schema = ? AND table_name = ? AND column_name = ?
       LIMIT 1`,
      [schema, tableName, columnName],
    );
    return Boolean(row);
  }

  async function hasTrigger(triggerName) {
    const row = await queryOne(
      `SELECT 1
       FROM information_schema.triggers
       WHERE trigger_schema = ? AND trigger_name = ?
       LIMIT 1`,
      [schema, triggerName],
    );
    return Boolean(row);
  }

  async function ensureNoRows(sql, label) {
    const rows = await queryAll(sql);
    if (rows.length > 0) {
      throw new Error(`${label} check failed: ${JSON.stringify(rows)}`);
    }
  }

  async function ensureIndex(tableName, indexName, ddl) {
    if (!(await hasIndex(tableName, indexName))) {
      await connection.query(ddl);
      console.log(`Added ${indexName}`);
    }
  }

  async function ensureConstraint(tableName, constraintName, ddl) {
    if (!(await hasConstraint(tableName, constraintName))) {
      await connection.query(ddl);
      console.log(`Added ${constraintName}`);
    }
  }

  async function ensureCheckConstraint(tableName, constraintName, ddl) {
    if (!(await hasCheckConstraint(tableName, constraintName))) {
      await connection.query(ddl);
      console.log(`Added ${constraintName}`);
    }
  }

  async function ensureTrigger(triggerName, ddl) {
    if (!(await hasTrigger(triggerName))) {
      await connection.query(ddl);
      console.log(`Added ${triggerName}`);
    }
  }

  async function dropIndexIfExists(tableName, indexName) {
    if (await hasIndex(tableName, indexName)) {
      await connection.query(`ALTER TABLE \`${tableName}\` DROP INDEX \`${indexName}\``);
      console.log(`Dropped ${tableName}.${indexName}`);
    }
  }

  async function getForeignKeys(tableName, columnNames) {
    const placeholders = columnNames.map(() => '?').join(',');
    const rows = await queryAll(
      `SELECT
         kcu.constraint_name AS constraintName,
         rc.delete_rule AS deleteRule,
         kcu.referenced_table_name AS referencedTableName,
         GROUP_CONCAT(kcu.column_name ORDER BY kcu.ordinal_position) AS columnsJoined,
         GROUP_CONCAT(kcu.referenced_column_name ORDER BY kcu.ordinal_position) AS referencedColumnsJoined
       FROM information_schema.key_column_usage kcu
       JOIN information_schema.referential_constraints rc
         ON rc.constraint_schema = kcu.table_schema
        AND rc.table_name = kcu.table_name
        AND rc.constraint_name = kcu.constraint_name
       WHERE kcu.table_schema = ?
         AND kcu.table_name = ?
         AND kcu.column_name IN (${placeholders})
         AND kcu.referenced_table_name IS NOT NULL
       GROUP BY kcu.constraint_name, rc.delete_rule, kcu.referenced_table_name`,
      [schema, tableName, ...columnNames],
    );

    return rows.map((row) => ({
      constraintName: row.constraintName,
      deleteRule: row.deleteRule,
      referencedTableName: row.referencedTableName,
      columns: String(row.columnsJoined).split(','),
      referencedColumns: String(row.referencedColumnsJoined).split(','),
    }));
  }

  function sameColumns(left, right) {
    return left.length === right.length && left.every((value, index) => value === right[index]);
  }

  async function reconcileForeignKey(tableName, columnNames, desired) {
    const foreignKeys = await getForeignKeys(tableName, columnNames);
    const matched = foreignKeys.find((foreignKey) =>
      foreignKey.constraintName === desired.constraintName
      && foreignKey.deleteRule === desired.deleteRule
      && foreignKey.referencedTableName === desired.referencedTableName
      && sameColumns(foreignKey.columns, desired.columns)
      && sameColumns(foreignKey.referencedColumns, desired.referencedColumns),
    );

    if (matched) {
      return;
    }

    for (const foreignKey of foreignKeys) {
      await connection.query(`ALTER TABLE \`${tableName}\` DROP FOREIGN KEY \`${foreignKey.constraintName}\``);
      console.log(`Dropped ${foreignKey.constraintName}`);
    }

    await connection.query(desired.ddl);
    console.log(`Added ${desired.constraintName}`);
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
    `SELECT base_name, COUNT(*) AS c
     FROM base_info
     GROUP BY base_name
     HAVING c > 1`,
    'duplicate base_info.base_name',
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
    `SELECT user_id, job_id, base_id, COUNT(*) AS c
     FROM job_application
     WHERE status = 0
     GROUP BY user_id, job_id, base_id
     HAVING c > 1`,
    'duplicate pending job_application',
  );

  await ensureNoRows(
    `SELECT applicant_id, base_id, COUNT(*) AS c
     FROM base_cooperation
     WHERE status = 0
     GROUP BY applicant_id, base_id
     HAVING c > 1`,
    'duplicate pending base_cooperation',
  );

  await ensureNoRows(
    `SELECT b.id, b.owner_id
     FROM base_info b
     LEFT JOIN sys_user u ON u.id = b.owner_id
     WHERE u.id IS NULL`,
    'orphan base_info.owner_id',
  );

  await ensureNoRows(
    `SELECT b.id, b.owner_id, u.role_key
     FROM base_info b
     JOIN sys_user u ON u.id = b.owner_id
     WHERE u.role_key <> 'base_manager'`,
    'base_info owner is not base_manager',
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

  await ensureNoRows(
    `SELECT s.id, s.base_id, s.job_id, j.base_id AS job_base_id
     FROM daily_signup s
     JOIN recruitment_job j ON j.id = s.job_id
     WHERE s.base_id <> j.base_id`,
    'mismatched daily_signup(job_id, base_id)',
  );

  await ensureNoRows(
    `SELECT a.id, a.base_id, a.job_id, j.base_id AS job_base_id
     FROM job_application a
     JOIN recruitment_job j ON j.id = a.job_id
     WHERE a.base_id <> j.base_id`,
    'mismatched job_application(job_id, base_id)',
  );

  await ensureNoRows(
    `SELECT id, uid, role_key, assigned_base_id
     FROM sys_user
     WHERE role_key <> 'field_manager' AND assigned_base_id IS NOT NULL`,
    'non-field-manager with assigned_base_id',
  );

  await ensureNoRows(
    `SELECT id
     FROM recruitment_job
     WHERE NOT (
       (pay_type = 1 AND salary_amount IS NOT NULL AND salary_amount > 0 AND hourly_rate IS NULL AND unit_price IS NULL AND (targetCount IS NULL OR targetCount = 0))
       OR (pay_type = 2 AND hourly_rate IS NOT NULL AND hourly_rate > 0 AND salary_amount IS NULL AND unit_price IS NULL AND (targetCount IS NULL OR targetCount = 0))
       OR (pay_type = 3 AND unit_price IS NOT NULL AND unit_price > 0 AND targetCount IS NOT NULL AND targetCount > 0 AND salary_amount IS NULL AND hourly_rate IS NULL)
     )`,
    'invalid recruitment_job pay fields',
  );

  await ensureNoRows(
    `SELECT id
     FROM recruitment_job
     WHERE min_age IS NOT NULL AND max_age IS NOT NULL AND min_age > max_age`,
    'invalid recruitment_job age range',
  );

  await ensureNoRows(
    `SELECT id
     FROM recruitment_job
     WHERE work_start_date IS NOT NULL AND work_end_date IS NOT NULL AND work_start_date > work_end_date`,
    'invalid recruitment_job work date range',
  );

  console.log('Checks passed. Applying schema changes...');

  if (!(await hasColumn('sys_user', 'gender'))) {
    await connection.query(
      "ALTER TABLE sys_user ADD COLUMN gender enum('male','female') NULL COMMENT 'male:男, female:女' AFTER face_img_url",
    );
    console.log('Added sys_user.gender');
  }

  if (!(await hasColumn('sys_user', 'is_poor_household'))) {
    await connection.query(
      "ALTER TABLE sys_user ADD COLUMN is_poor_household tinyint NULL COMMENT '1:是, 0:否' AFTER gender",
    );
    console.log('Added sys_user.is_poor_household');
  }

  await ensureIndex(
    'sys_user',
    'UQ_sys_user_id_card_hash',
    'ALTER TABLE sys_user ADD UNIQUE KEY UQ_sys_user_id_card_hash (id_card_hash)',
  );

  await ensureIndex(
    'sys_user',
    'UQ_sys_user_phone_hash',
    'ALTER TABLE sys_user ADD UNIQUE KEY UQ_sys_user_phone_hash (phone_hash)',
  );

  await ensureIndex(
    'sys_user',
    'IDX_sys_user_emergency_phone_hash',
    'ALTER TABLE sys_user ADD KEY IDX_sys_user_emergency_phone_hash (emergency_phone_hash)',
  );

  await ensureConstraint(
    'sys_user',
    'FK_sys_user_assigned_base',
    'ALTER TABLE sys_user ADD CONSTRAINT FK_sys_user_assigned_base FOREIGN KEY (assigned_base_id) REFERENCES base_info(id) ON DELETE SET NULL',
  );

  await ensureConstraint(
    'base_info',
    'FK_base_info_owner',
    'ALTER TABLE base_info ADD CONSTRAINT FK_base_info_owner FOREIGN KEY (owner_id) REFERENCES sys_user(id) ON DELETE RESTRICT',
  );

  await ensureIndex(
    'base_info',
    'UQ_base_info_base_name',
    'ALTER TABLE base_info ADD UNIQUE KEY UQ_base_info_base_name (base_name)',
  );

  await ensureIndex(
    'recruitment_job',
    'IDX_recruitment_job_id_base',
    'ALTER TABLE recruitment_job ADD KEY IDX_recruitment_job_id_base (id, base_id)',
  );

  if (await hasIndex('daily_signup', 'IDX_96b07a56d0da164eab16b1b9b6')) {
    if (!(await hasIndex('daily_signup', 'IDX_daily_signup_user_id'))) {
      await connection.query('ALTER TABLE daily_signup ADD INDEX IDX_daily_signup_user_id (user_id)');
      console.log('Added IDX_daily_signup_user_id');
    }
    await connection.query('ALTER TABLE daily_signup DROP INDEX IDX_96b07a56d0da164eab16b1b9b6');
    console.log('Dropped old daily_signup unique index');
  }

  await ensureIndex(
    'daily_signup',
    'UQ_daily_signup_user_base_date',
    'ALTER TABLE daily_signup ADD UNIQUE KEY UQ_daily_signup_user_base_date (user_id, base_id, work_date)',
  );

  await ensureIndex(
    'daily_signup',
    'IDX_daily_signup_job_base',
    'ALTER TABLE daily_signup ADD KEY IDX_daily_signup_job_base (job_id, base_id)',
  );

  await ensureConstraint(
    'daily_signup',
    'FK_daily_signup_proxy_user',
    'ALTER TABLE daily_signup ADD CONSTRAINT FK_daily_signup_proxy_user FOREIGN KEY (proxy_user_id) REFERENCES sys_user(id) ON DELETE SET NULL',
  );

  await ensureConstraint(
    'daily_signup',
    'FK_daily_signup_job_base',
    'ALTER TABLE daily_signup ADD CONSTRAINT FK_daily_signup_job_base FOREIGN KEY (job_id, base_id) REFERENCES recruitment_job(id, base_id) ON DELETE RESTRICT',
  );

  await ensureConstraint(
    'labor_salary',
    'FK_labor_salary_admin',
    'ALTER TABLE labor_salary ADD CONSTRAINT FK_labor_salary_admin FOREIGN KEY (admin_id) REFERENCES sys_user(id) ON DELETE RESTRICT',
  );

  if (!(await hasColumn('labor_salary', 'worker_appeal_status'))) {
    await connection.query(
      "ALTER TABLE labor_salary ADD COLUMN worker_appeal_status tinyint NOT NULL DEFAULT '0' COMMENT '0:无申诉, 1:待处理, 2:已调整待确认, 3:已驳回' AFTER worker_sign_url",
    );
    console.log('Added labor_salary.worker_appeal_status');
  }

  if (!(await hasColumn('labor_salary', 'worker_appeal_reason'))) {
    await connection.query(
      "ALTER TABLE labor_salary ADD COLUMN worker_appeal_reason text NULL COMMENT '采摘工申诉原因' AFTER worker_appeal_status",
    );
    console.log('Added labor_salary.worker_appeal_reason');
  }

  if (!(await hasColumn('labor_salary', 'worker_expected_amount'))) {
    await connection.query(
      "ALTER TABLE labor_salary ADD COLUMN worker_expected_amount decimal(10,2) NULL COMMENT '采摘工申诉期望金额' AFTER worker_appeal_reason",
    );
    console.log('Added labor_salary.worker_expected_amount');
  }

  if (!(await hasColumn('labor_salary', 'worker_appealed_at'))) {
    await connection.query(
      "ALTER TABLE labor_salary ADD COLUMN worker_appealed_at datetime NULL COMMENT '采摘工申诉时间' AFTER worker_expected_amount",
    );
    console.log('Added labor_salary.worker_appealed_at');
  }

  if (!(await hasColumn('labor_salary', 'appeal_reply'))) {
    await connection.query(
      "ALTER TABLE labor_salary ADD COLUMN appeal_reply text NULL COMMENT '基地管理员处理说明' AFTER worker_appealed_at",
    );
    console.log('Added labor_salary.appeal_reply');
  }

  if (!(await hasColumn('labor_salary', 'appeal_handled_by'))) {
    await connection.query(
      "ALTER TABLE labor_salary ADD COLUMN appeal_handled_by bigint NULL COMMENT '申诉处理人ID' AFTER appeal_reply",
    );
    console.log('Added labor_salary.appeal_handled_by');
  }

  if (!(await hasColumn('labor_salary', 'appeal_handled_at'))) {
    await connection.query(
      "ALTER TABLE labor_salary ADD COLUMN appeal_handled_at datetime NULL COMMENT '申诉处理时间' AFTER appeal_handled_by",
    );
    console.log('Added labor_salary.appeal_handled_at');
  }

  await ensureIndex(
    'salary_payment',
    'UQ_salary_payment_salary_id',
    'ALTER TABLE salary_payment ADD UNIQUE KEY UQ_salary_payment_salary_id (salary_id)',
  );

  await reconcileForeignKey('salary_payment', ['salary_id'], {
    constraintName: 'FK_salary_payment_salary',
    deleteRule: 'CASCADE',
    referencedTableName: 'labor_salary',
    columns: ['salary_id'],
    referencedColumns: ['id'],
    ddl: 'ALTER TABLE salary_payment ADD CONSTRAINT FK_salary_payment_salary FOREIGN KEY (salary_id) REFERENCES labor_salary(id) ON DELETE CASCADE',
  });

  await reconcileForeignKey('salary_payment', ['paid_by'], {
    constraintName: 'FK_salary_payment_paid_by',
    deleteRule: 'SET NULL',
    referencedTableName: 'sys_user',
    columns: ['paid_by'],
    referencedColumns: ['id'],
    ddl: 'ALTER TABLE salary_payment ADD CONSTRAINT FK_salary_payment_paid_by FOREIGN KEY (paid_by) REFERENCES sys_user(id) ON DELETE SET NULL',
  });

  if (!(await hasColumn('job_application', 'pending_guard'))) {
    await connection.query(
      'ALTER TABLE job_application ADD COLUMN pending_guard tinyint GENERATED ALWAYS AS (case when status = 0 then 1 else NULL end) STORED',
    );
    console.log('Added job_application.pending_guard');
  }

  if (!(await hasColumn('job_application', 'work_end_time'))) {
    await connection.query(
      "ALTER TABLE job_application ADD COLUMN work_end_time datetime NULL COMMENT '结束务工时间' AFTER reviewed_at",
    );
    console.log('Added job_application.work_end_time');
  }

  if (!(await hasColumn('job_application', 'work_end_by'))) {
    await connection.query(
      "ALTER TABLE job_application ADD COLUMN work_end_by bigint NULL COMMENT '结束务工操作人ID' AFTER work_end_time",
    );
    console.log('Added job_application.work_end_by');
  }

  if (!(await hasColumn('job_application', 'work_end_recorded_at'))) {
    await connection.query(
      "ALTER TABLE job_application ADD COLUMN work_end_recorded_at datetime NULL COMMENT '结束务工记录创建时间' AFTER work_end_by",
    );
    console.log('Added job_application.work_end_recorded_at');
  }

  await ensureIndex(
    'job_application',
    'IDX_job_application_reviewed_by',
    'ALTER TABLE job_application ADD KEY IDX_job_application_reviewed_by (reviewed_by)',
  );

  await ensureIndex(
    'job_application',
    'IDX_job_application_job_base',
    'ALTER TABLE job_application ADD KEY IDX_job_application_job_base (job_id, base_id)',
  );

  await ensureIndex(
    'job_application',
    'UQ_job_application_pending',
    'ALTER TABLE job_application ADD UNIQUE KEY UQ_job_application_pending (user_id, job_id, base_id, pending_guard)',
  );

  await ensureConstraint(
    'job_application',
    'FK_job_application_reviewed_by',
    'ALTER TABLE job_application ADD CONSTRAINT FK_job_application_reviewed_by FOREIGN KEY (reviewed_by) REFERENCES sys_user(id) ON DELETE RESTRICT',
  );

  await ensureConstraint(
    'job_application',
    'FK_job_application_job_base',
    'ALTER TABLE job_application ADD CONSTRAINT FK_job_application_job_base FOREIGN KEY (job_id, base_id) REFERENCES recruitment_job(id, base_id) ON DELETE RESTRICT',
  );

  if (!(await hasColumn('base_cooperation', 'pending_guard'))) {
    await connection.query(
      'ALTER TABLE base_cooperation ADD COLUMN pending_guard tinyint GENERATED ALWAYS AS (case when status = 0 then 1 else NULL end) STORED',
    );
    console.log('Added base_cooperation.pending_guard');
  }

  await ensureIndex(
    'base_cooperation',
    'IDX_base_cooperation_reviewed_by',
    'ALTER TABLE base_cooperation ADD KEY IDX_base_cooperation_reviewed_by (reviewed_by)',
  );

  await ensureIndex(
    'base_cooperation',
    'UQ_base_cooperation_pending',
    'ALTER TABLE base_cooperation ADD UNIQUE KEY UQ_base_cooperation_pending (applicant_id, base_id, pending_guard)',
  );

  await ensureConstraint(
    'base_cooperation',
    'FK_base_cooperation_reviewed_by',
    'ALTER TABLE base_cooperation ADD CONSTRAINT FK_base_cooperation_reviewed_by FOREIGN KEY (reviewed_by) REFERENCES sys_user(id) ON DELETE RESTRICT',
  );

  await ensureTrigger(
    'TRG_sys_user_validate_role_before_insert',
    `CREATE TRIGGER TRG_sys_user_validate_role_before_insert
       BEFORE INSERT ON sys_user
       FOR EACH ROW
       BEGIN
         IF NEW.role_key <> 'field_manager' AND NEW.assigned_base_id IS NOT NULL THEN
           SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'only field_manager can set assigned_base_id';
         END IF;
       END`,
  );

  await ensureTrigger(
    'TRG_sys_user_validate_role_before_update',
    `CREATE TRIGGER TRG_sys_user_validate_role_before_update
       BEFORE UPDATE ON sys_user
       FOR EACH ROW
       BEGIN
         IF NEW.role_key <> 'field_manager' AND NEW.assigned_base_id IS NOT NULL THEN
           SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'only field_manager can set assigned_base_id';
         END IF;
       END`,
  );

  await ensureTrigger(
    'TRG_base_info_validate_owner_before_insert',
    `CREATE TRIGGER TRG_base_info_validate_owner_before_insert
       BEFORE INSERT ON base_info
       FOR EACH ROW
       BEGIN
         IF (SELECT role_key FROM sys_user WHERE id = NEW.owner_id) NOT IN ('base_manager', 'boss') THEN
           SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'base owner must be base_manager or boss';
         END IF;
       END`,
  );

  await ensureTrigger(
    'TRG_base_info_validate_owner_before_update',
    `CREATE TRIGGER TRG_base_info_validate_owner_before_update
       BEFORE UPDATE ON base_info
       FOR EACH ROW
       BEGIN
         IF (SELECT role_key FROM sys_user WHERE id = NEW.owner_id) NOT IN ('base_manager', 'boss') THEN
           SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'base owner must be base_manager or boss';
         END IF;
       END`,
  );

  await ensureTrigger(
    'TRG_sys_user_guard_owner_role_before_update',
    `CREATE TRIGGER TRG_sys_user_guard_owner_role_before_update
       BEFORE UPDATE ON sys_user
       FOR EACH ROW
       BEGIN
         IF NEW.role_key NOT IN ('base_manager', 'boss')
            AND EXISTS (SELECT 1 FROM base_info WHERE owner_id = NEW.id LIMIT 1) THEN
           SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'base owner must remain base_manager or boss';
         END IF;
       END`,
  );

  await ensureCheckConstraint(
    'recruitment_job',
    'CHK_recruitment_job_pay_fields',
    `ALTER TABLE recruitment_job
       ADD CONSTRAINT CHK_recruitment_job_pay_fields CHECK (
         (pay_type = 1 AND salary_amount IS NOT NULL AND salary_amount > 0 AND hourly_rate IS NULL AND unit_price IS NULL AND (targetCount IS NULL OR targetCount = 0))
         OR (pay_type = 2 AND hourly_rate IS NOT NULL AND hourly_rate > 0 AND salary_amount IS NULL AND unit_price IS NULL AND (targetCount IS NULL OR targetCount = 0))
         OR (pay_type = 3 AND unit_price IS NOT NULL AND unit_price > 0 AND targetCount IS NOT NULL AND targetCount > 0 AND salary_amount IS NULL AND hourly_rate IS NULL)
       )`,
  );

  await ensureCheckConstraint(
    'recruitment_job',
    'CHK_recruitment_job_age_range',
    'ALTER TABLE recruitment_job ADD CONSTRAINT CHK_recruitment_job_age_range CHECK (min_age IS NULL OR max_age IS NULL OR min_age <= max_age)',
  );

  await ensureCheckConstraint(
    'recruitment_job',
    'CHK_recruitment_job_work_dates',
    'ALTER TABLE recruitment_job ADD CONSTRAINT CHK_recruitment_job_work_dates CHECK (work_start_date IS NULL OR work_end_date IS NULL OR work_start_date <= work_end_date)',
  );

  await dropIndexIfExists('labor_salary', 'REL_ba4a47c6f7ee6d3fab12536638');
  await dropIndexIfExists('salary_payment', 'IDX_370527789abbd3ed2e3aeec54f');
  await dropIndexIfExists('sys_user', 'IDX_b3f96c7b107162727a0fb7d5fb');
  await dropIndexIfExists('sys_user', 'IDX_14640e62c4be0dc6b727664e20');
  await dropIndexIfExists('sys_user', 'IDX_ecfbc9cc96173a2bd6b3e2cb40');

  console.log('Live schema hardening completed.');
  await connection.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
