# 数据库快照（2026-04-17 12:44）

## 1) 快照元信息

- 数据库：`pickpass_db`
- 主机：`127.0.0.1:3306`
- 账号：`root`
- 字符集：`utf8mb4`
- 生成时间：`2026-04-17`

## 2) 当前完整备份

- 备份文件：`apps/backend/backups/backup_pickpass_db_20260417_124403.sql`
- 文件大小：`837,986 bytes`

## 3) 全表行数（精确）

| 表名 | 行数 |
|---|---:|
| sys_user | 210 |
| base_info | 17 |
| recruitment_job | 19 |
| job_application | 141 |
| daily_signup | 141 |
| labor_salary | 126 |
| salary_payment | 95 |
| proxy_registration_case | 24 |
| operation_log | 2041 |
| base_supervisor_assignment | 24 |
| attendance_sheet | 0 |
| offline_attendance_event | 0 |
| salary_report_submission | 0 |
| base_rating | 0 |
| base_cooperation | 0 |

## 4) 成员与基地分布

### 4.1 角色分布

| role_key | 总数 | 未删除 | 已删除 |
|---|---:|---:|---:|
| super_admin | 1 | 1 | 0 |
| boss | 17 | 17 | 0 |
| base_manager | 14 | 14 | 0 |
| field_manager | 13 | 13 | 0 |
| worker | 165 | 164 | 1 |

### 4.2 用户审核状态（仅未删除）

| info_audit_status | 数量 |
|---|---:|
| 0（待审核） | 69 |
| 1（通过） | 133 |
| 2（拒绝） | 7 |

### 4.3 注册模式（仅未删除）

| register_mode | 数量 |
|---|---:|
| self | 187 |
| proxy | 22 |

### 4.4 基地状态

- `base_info` 共 17 条，全部 `is_deleted=0`
- `audit_status=1`（已通过）
- 分类：`category=1` 有 16 个，`category=2` 有 1 个

## 5) 业务链路状态

| 数据项 | 数量 |
|---|---:|
| job_application.status=0 | 141 |
| daily_signup.status=0 | 14 |
| daily_signup.status=1 | 127 |
| labor_salary.status=0 | 30 |
| labor_salary.status=1 | 1 |
| labor_salary.status=2 | 95 |
| salary_payment.status=2 | 95 |
| proxy_registration_case.pending_review | 10 |
| proxy_registration_case.approved | 5 |
| proxy_registration_case.rejected | 2 |
| proxy_registration_case.revoked | 5 |
| proxy_registration_case.takeover_done | 2 |

## 6) 结构关系检查

已检查项：

- 基地 owner 缺失/已删/角色异常：`0` 条
- `field_manager` 的 `assigned_base_id` 为空：`0` 条
- 非 `field_manager` 却存在 `assigned_base_id`：`0` 条
- `salary_payment` 孤儿记录（找不到 salary）：`0` 条

关联完整性（业务未闭环但可接受）：

- `labor_salary` 无支付记录：`31` 条
- `daily_signup` 无工资记录：`15` 条

## 7) 主要“混乱来源”

1. 测试批量数据较多：大量重复姓名（如“工人01”等），影响人工排查。
2. 待审核用户偏多（69），同一功能在不同账号下展示差异明显。
3. 业务链路不完整数据存在：报名、工资、支付并非全部闭环。
4. 操作日志体量最大（2041），4 月 4 日集中压测/联调写入明显。

## 8) 已导出的梳理文件

- `artifacts/exports/samples/db_snapshot_20260417/table_counts.tsv`
- `artifacts/exports/samples/db_snapshot_20260417/sys_user.tsv`
- `artifacts/exports/samples/db_snapshot_20260417/base_info.tsv`

## 9) 建议梳理顺序

1. 先按 `sys_user.tsv` 清理重复测试用户（保留固定联调账号）。
2. 再按 `base_info.tsv` 清理无效基地和对应管理分配。
3. 最后对 `daily_signup -> labor_salary -> salary_payment` 做闭环补齐或归档。
4. 清理后再次备份，作为团队统一基线。
