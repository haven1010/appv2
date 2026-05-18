# 后端 npm 命令手册

更新时间：2026-04-02  
适用目录：`apps/backend`

## 使用前提

1. 先进入后端目录：

```bash
cd apps/backend
```

2. 确认依赖已安装：

```bash
npm install
```

## 命令总览

| 命令 | 作用 | 典型使用场景 |
| --- | --- | --- |
| `npm run build` | 编译 Nest 项目到 `dist` | 发布前本地编译验证、CI 构建 |
| `npm run format` | 使用 Prettier 格式化 `src/**/*.ts` | 提交前统一代码风格 |
| `npm run start` | 普通模式启动后端 | 本地快速启动验证 |
| `npm run start:dev` | 开发模式启动（watch） | 日常开发联调 |
| `npm run start:debug` | 调试模式启动（debug + watch） | 断点调试后端逻辑 |
| `npm run start:prod` | 运行编译后的产物 | 本地模拟生产启动 |
| `npm run lint` | ESLint 检查并自动修复 | 提交前质量检查 |
| `npm run db:backup` | 执行数据库备份 | 联调前留快照、变更前留档 |
| `npm run db:backup:list` | 列出已有备份 | 查找可恢复备份文件 |
| `npm run db:restore` | 从备份恢复数据库 | 数据损坏后回滚、还原测试环境 |
| `npm run db:restore:drill` | 恢复演练（临时库） | 上线前恢复能力演练 |
| `npm run login:baseline` | 修复并统一固定测试账号登录口径 | 新电脑初始化、登录异常批量修复 |
| `npm run login:baseline:check` | 只校验登录口径，不改数据 | 日常巡检、联调前自检 |
| `npm run test:concurrency` | 并发回归测试脚本 | 合并前压测关键链路 |
| `npm run seed:users` | 批量创建测试用户 | 初始化测试环境用户 |
| `npm run simulate:full-flow` | 30 工人全流程模拟脚本 | 全链路回归、演示前预热 |
| `npm run hardening:prelaunch` | 上线前数据硬化脚本 | 上线前最后一次数据清理/补齐 |

## 常用场景流程

### 1. 日常开发联调

```bash
npm run start:dev
```

建议配套：

```bash
npm run login:baseline:check
```

用途：确保登录基线没漂移，避免小程序登录报“用户未找到”。

### 2. 新电脑/新环境初始化

```bash
npm run login:baseline
npm run start:dev
```

用途：先把固定测试账号口径统一，再启动服务进行前后端联调。

### 3. 数据库操作前安全流程

```bash
npm run db:backup
```

执行完数据库结构/数据改动后，如需回退：

```bash
npm run db:restore -- --file <备份文件路径> --confirm "RESTORE pickpass_db"
```

### 4. 提交前质量检查

```bash
npm run lint
npm run build
```

用途：减少明显的语法/构建问题进入仓库。

### 5. 发布前回归

```bash
npm run hardening:prelaunch
npm run test:concurrency
npm run simulate:full-flow
```

用途：做一次上线前数据与流程完整性验证。

## 重点命令说明

### `login:baseline`

- 作用：统一固定测试账号（ID 1~11）的手机号、身份证及哈希口径。
- 适用：换机器后登录异常、导入不同快照后口径漂移。
- 特点：可重复执行（幂等），适合加入初始化流程。

### `login:baseline:check`

- 作用：只检查固定账号口径一致性，不修改数据库。
- 适用：联调前巡检、CI 前置检查。

### `db:restore`

- 作用：从备份恢复数据库。
- 风险：破坏性操作，执行前务必确认目标库与备份文件。
- 建议：恢复前先执行一次 `npm run db:backup`。

## 常见问题

### 1. 命令在哪个目录执行？

统一在 `apps/backend` 执行。

### 2. 为什么 `start:dev` 启动后小程序登录报用户未找到？

优先执行：

```bash
npm run login:baseline
```

然后重试登录。

### 3. 备份恢复相关命令看哪里最详细？

参考文档：[database-backup-restore.md](database-backup-restore.md)

### 4. 测试账号清单看哪里？

参考文档：[test-users.md](test-users.md)
