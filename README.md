# 采摘通 Picking Pass

农业采摘用工全生命周期管理平台，覆盖 **基地入驻、岗位发布、工人报名、现场扫码签到、考勤统计、薪资确认、工资发放与报表导出**。

## 一眼看懂

```text
.
├── apps/                    # 可运行应用
│   ├── backend/             # NestJS API 服务，MySQL/TypeORM/JWT/Swagger
│   ├── web-admin/           # React + Vite Web 管理后台
│   └── wechat-miniprogram/  # 微信小程序，面向工人/老板/现场管理员
├── docs/                    # 需求、设计、测试、工程规范
│   ├── getting-started/     # 快速开始、全流程跑通
│   ├── design/              # 项目计划、系统设计、数据库结构
│   ├── testing/             # 测试指南、联调清单、测试数据
│   ├── operations/          # 上线前检查与运维准备
│   ├── engineering/         # Git 与注释规范
│   └── overview/            # 历史总览资料
└── artifacts/               # 导出文件、课程报告、演示材料
```

更详细的目录说明见 [docs/PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md)。

## 业务角色

- **工人 worker**：浏览基地和岗位、报名、出示签到码、查看考勤与工资、确认工资。
- **老板 boss**：提交企业/基地入驻资料，结算后提交工资表。
- **基地管理员 base_manager**：维护基地、发布岗位、审核报名、生成工资草稿。
- **现场管理员 field_manager**：现场扫码签到、查看报名/签到表、处理现场异常。
- **超级管理员 super_admin**：审核入驻和资料变更、管理用户、查看日志、导出工资与考勤报表。

## 快速启动

后端：

```bash
cd apps/backend
npm install
npm run start:dev
```

Web 管理端：

```bash
cd apps/web-admin
npm install
npm run dev
```

微信小程序：

1. 用微信开发者工具导入 `apps/wechat-miniprogram`。
2. 确认 `apps/wechat-miniprogram/app.js` 中的 `baseUrl` 指向后端，例如 `http://127.0.0.1:3001/api`。
3. 本地联调时在开发者工具里勾选“不校验合法域名”。

根目录也提供常用脚本：

```bash
npm run dev:backend
npm run dev:web
npm run build:backend
npm run build:web
```

## 核心链路

1. 老板提交基地入驻资料。
2. 超级管理员审核基地，分配基地管理员/现场管理员。
3. 基地管理员发布招聘岗位。
4. 工人在小程序浏览岗位并报名。
5. 现场管理员扫描工人二维码完成签到。
6. 系统按签到记录生成工资草稿。
7. 工人确认或申诉工资。
8. 老板/管理员完成发放，系统归档并导出报表。

## 关键文档

- [快速开始](docs/getting-started/快速开始.md)
- [全流程跑通说明](docs/getting-started/全流程跑通说明.md)
- [系统设计](docs/design/设计.md)
- [项目计划书](docs/design/采摘工管理系统项目计划书.md)
- [测试指南](docs/testing/测试指南.md)
- [联调与测试清单](docs/testing/联调与测试清单.md)

## 技术栈

- 后端：NestJS、TypeORM、MySQL、JWT、Swagger、XLSX 导出。
- Web：React、Vite、TypeScript、React Query、React Router。
- 小程序：微信小程序原生框架、自定义 TabBar、扫码能力。
