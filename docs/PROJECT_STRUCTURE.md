# Project Structure

这份目录约定的目标是：新成员、评审老师或企业工程师打开仓库后，能先看到业务边界，再进入具体应用。

## Top Level

| Path | Purpose |
| --- | --- |
| `apps/backend` | 后端 API 服务。NestJS 模块化架构，业务模块集中在 `src/modules`。 |
| `apps/web-admin` | Web 管理后台。React + Vite，页面集中在 `src/views`。 |
| `apps/wechat-miniprogram` | 微信小程序端。工人、老板、现场管理员和移动管理入口。 |
| `docs` | 项目知识库。启动、设计、测试、上线准备、工程规范都放这里。 |
| `artifacts` | 非源码交付物。包括导出样例、课程报告、截图和演示材料。 |

## Application Ownership

### `apps/backend`

```text
apps/backend
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   └── modules/
│       ├── auth/            # 登录、JWT、角色守卫
│       ├── user/            # 用户、实名信息、代注册、审核
│       ├── base/            # 基地、岗位、报名申请、合作申请
│       ├── attendance/      # 报名、二维码、扫码签到、离线补签
│       ├── salary/          # 工资计算、确认、申诉、支付、报表
│       ├── recommendation/  # 基地推荐
│       ├── dashboard/       # 统计看板
│       └── common/          # 加密、日志、备份、OCR/COS/SMS
├── migrations/              # 数据库迁移
├── scripts/                 # 种子数据、全流程模拟、备份恢复
└── docs/                    # 后端专项说明
```

### `apps/web-admin`

```text
apps/web-admin
├── src/
│   ├── App.tsx              # 路由和角色守卫
│   ├── views/               # 页面视图
│   ├── layouts/             # 后台布局
│   ├── components/          # 通用组件
│   ├── api/                 # Orval 生成的 API 类型和请求
│   └── lib/                 # 请求与工具函数
└── docs/                    # 前端设计系统和页面规范
```

### `apps/wechat-miniprogram`

```text
apps/wechat-miniprogram
├── app.js                   # 全局状态、API 请求封装、baseUrl 配置
├── app.json                 # 页面与 TabBar 配置
├── custom-tab-bar/          # 角色化底部导航
├── pages/
│   ├── index/               # 工人广场
│   ├── boss/                # 老板端
│   ├── field/               # 现场管理员端
│   ├── admin/               # 移动管理端
│   ├── base/ job/ signup/   # 基地、岗位、报名
│   └── profile/ salary/     # 我的、工资、工作历程
└── utils/
```

## Documentation Rules

- 新的运行说明放 `docs/getting-started`。
- 新的业务/架构设计放 `docs/design`。
- 测试账号、测试数据、联调步骤放 `docs/testing`。
- 上线、运维、备份恢复类资料放 `docs/operations`。
- 代码规范、Git 规范、团队协作约定放 `docs/engineering`。
- 导出的 Excel、报告截图、课程论文材料放 `artifacts`，不要堆到根目录。

## Common Commands

```bash
npm run dev:backend
npm run dev:web
npm run build:backend
npm run build:web
npm run simulate:full-flow
```
