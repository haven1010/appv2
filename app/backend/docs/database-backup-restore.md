# 数据库备份与恢复

这份文档是上线最低可用版说明，目标是让运维至少具备以下能力：

- 能手动执行全量备份
- 能列出已有备份文件
- 能从指定备份恢复数据库
- 能配置每日定时备份和保留天数

## 环境变量

- `DB_HOST`
- `DB_PORT`
- `DB_USERNAME`
- `DB_PASSWORD`
- `DB_DATABASE`
- `DB_ADMIN_USERNAME`
  恢复演练时用于创建/删除临时库和授权，默认回退到 `DB_USERNAME`
- `DB_ADMIN_PASSWORD`
  对应 `DB_ADMIN_USERNAME` 的密码
- `DB_GRANT_HOST`
  给应用账号授权临时库时使用，默认 `%`
- `DB_RESTORE_USERNAME`
  恢复时使用的账号；默认回退到 `DB_USERNAME`
- `DB_RESTORE_PASSWORD`
  对应 `DB_RESTORE_USERNAME` 的密码
- `DB_BACKUP_MODE`
  可选 `auto`、`local`、`docker`，默认 `auto`
- `DB_DOCKER_CONTAINER`
  容器模式下的 MySQL 容器名；默认会自动探测运行中的 MySQL 容器
- `BACKUP_PATH`
  默认 `./backups`
- `BACKUP_RETENTION_DAYS`
  默认 `30`

## 手动备份

在 `app/backend` 目录执行：

```bash
npm run db:backup
```

自定义目录或保留天数：

```bash
node scripts/db-backup.js --output-dir ./backups --retention-days 14
```

默认行为：

- 使用 `mysqldump` 导出全量 SQL
- 自动压缩为 `.sql.gz`
- 清理超过保留天数的旧备份
- 在 `auto` 模式下优先探测运行中的 MySQL 容器，并通过 `docker exec` 执行备份

## 查看备份

```bash
npm run db:backup:list
```

输出包含：

- 备份目录
- 文件名
- 文件路径
- 文件大小
- 修改时间

## 恢复数据库

恢复是破坏性操作，脚本默认要求显式确认。

```bash
npm run db:restore -- --file ./backups/backup_pickpass_db_20260324_120000.sql.gz --confirm "RESTORE pickpass_db"
```

也可以使用强制标记：

```bash
npm run db:restore -- --file ./backups/backup_pickpass_db_20260324_120000.sql.gz --force
```

支持文件格式：

- `.sql`
- `.sql.gz`

恢复模式：

- `local`：直接调用宿主机 `mysql`
- `docker`：通过 `docker exec` 调用容器内 `mysql`
- `auto`：优先自动探测运行中的 MySQL 容器

## 恢复演练

执行闭环恢复演练：

```bash
npm run db:restore:drill
```

默认行为：

- 自动选择 `backups/` 目录下最新备份
- 新建临时库，例如 `pickpass_restore_drill_20260324120000`
- 调用恢复脚本把备份恢复进临时库
- 对照源库校验核心表是否存在、核心表行数是否一致
- 校验通过后默认删除临时库

保留临时库用于人工检查：

```bash
npm run db:restore:drill -- --keep-db
```

## 应用内定时备份

后端启动后会由 `BackupService` 在每天凌晨 2 点调用：

- `node scripts/db-backup.js`

定时任务依赖：

- 应用进程在运行
- 机器上可执行 `mysqldump`
- 目标备份目录可写

## 上线前演练

上线前至少做一次完整恢复演练：

1. 执行一次手动备份
2. 在独立测试库恢复该备份
3. 验证关键表是否存在
4. 验证数据量是否合理
5. 记录恢复耗时，形成 `RTO`

建议最少验证这些表：

- `sys_user`
- `base_info`
- `daily_signup`
- `labor_salary`
- `salary_payment`
- `operation_log`

## 当前范围

这套最低可用版只覆盖：

- 全量备份
- 手动恢复
- 基础保留策略

还没有覆盖：

- binlog 增量恢复
- 远程对象存储归档
- 自动恢复演练
- 恢复后自动校验报告
