const mysql = require('mysql2/promise');
(async () => {
  const conn = await mysql.createConnection({
    host: 'cd-cdb-4wz4qeqq.sql.tencentcdb.com',
    port: 26982,
    user: 'root',
    password: 'Lry051223@',
    database: 'pickpass_db'
  });
  for (const table of ['base_info', 'recruitment_job', 'sys_user']) {
    const [rows] = await conn.query('SHOW COLUMNS FROM ' + table);
    console.log(table + ':');
    console.log(rows.map((row) => row.Field).join(','));
  }
  await conn.end();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
