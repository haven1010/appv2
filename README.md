# 采摘工智慧管理系统

一个基于 React + NestJS + 微信小程序的农业劳动力管理平台，用于连接生产基地与采摘工人，优化用工资源配置，形成“岗位发布—报名—签到—考勤—薪资确认”的闭环管理。

## 项目结构

```
appv2/
├── app/
│   ├── frontend/          # React + Vite 前端应用
│   │   ├── src/
│   │   │   ├── views/     # 页面组件
│   │   │   ├── components/ # 通用组件
│   │   │   └── ...
│   │   └── package.json
│   └── backend/           # NestJS 后端应用
│       ├── src/
│       │   ├── modules/   # 业务模块
│       │   └── ...
│       └── package.json
├── miniprogram/          # 微信小程序端（采摘工/现场管理员）
├── report/               # 课程报告与模板
└── docs/                 # 设计与测试文档（如有）
```

## 技术栈

### 前端
- **React 18** - UI框架
- **Vite** - 构建工具
- **TypeScript** - 类型安全
- **React Query** - 数据获取与状态管理
- **Tailwind CSS** - 样式框架
- **React Router** - 路由管理

### 小程序端
- **微信小程序原生框架** - 轻量、低成本、多端兼容
- **自定义 TabBar** - 角色化导航
- **扫码能力** - 现场签到

### 后端
- **NestJS** - Node.js框架
- **TypeORM** - ORM框架
- **MySQL** - 数据库
- **JWT** - 身份认证
- **Swagger** - API文档

## 快速开始

### 前置要求
- Node.js >= 18
- MySQL >= 8.0
- npm 或 yarn

### 安装依赖

```bash
# 后端
cd app/backend
npm install

# 前端
cd app/frontend
npm install
```

### 配置数据库

1. 创建MySQL数据库：
```sql
CREATE DATABASE picker_management CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

2. 配置后端环境变量（`app/backend/.env`）：
```env
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=your_password
DB_DATABASE=picker_management
JWT_SECRET=your_jwt_secret
```

### 运行项目

**后端：**
```bash
cd app/backend
npm run start:dev
```
后端将在 http://localhost:3001 启动

**前端：**
```bash
cd app/frontend
npm run dev
```
前端将在 http://localhost:3000 启动

**小程序：**
1. 打开微信开发者工具，导入 `miniprogram` 目录
2. 修改 `miniprogram/app.js` 中的 `baseUrl` 为后端地址（如 `http://127.0.0.1:3001/api`）
3. 选择“本地设置”勾选“不校验合法域名”（开发环境）

## 功能模块

### 用户角色
- **超级管理员** - 审核基地申请、管理全局配置
- **基地管理员** - 管理基地信息、发布招聘岗位
- **现场管理员** - 管理现场作业、考勤
- **采摘工** - 查看岗位、报名、查看工作进度

### 权限说明
- **超级管理员**：全局配置、用户与角色管理、基地审核、全局统计
- **基地管理员**：基地信息维护、岗位发布与审核、报名审核
- **现场管理员**：扫码签到、考勤记录、现场数据汇总
- **采摘工**：岗位浏览、报名申请、签到码、个人资料与薪资查询

### 核心功能
- ✅ 用户注册与登录
- ✅ 基地申请与审核
- ✅ 招聘岗位发布与管理
- ✅ 岗位报名与审核
- ✅ 工作台与进度查看
- ✅ 考勤管理（小程序端扫码签到/考勤记录）
- ✅ 个人中心（资料、考勤、薪资查询）
- ✅ 现场管理员工作台（考勤概况/扫码入口）

## API文档

启动后端后，访问 http://localhost:3001/docs 查看Swagger API文档。

## 接口清单与联调说明

### 常用接口
- 认证与用户：`POST /auth/login`、`POST /user/register`、`GET /user/profile`、`PATCH /user/profile`
- 基地与岗位：`GET /base`、`GET /base/:id`、`GET /base/:id/jobs`、`GET /base/jobs/:jobId`、`POST /base/jobs/:jobId/apply`
- 报名与审核：`GET /base/applications/me`、`PATCH /base/applications/:id/review`
- 考勤与签到：`GET /attendance/qrcode`、`POST /attendance/checkin`、`GET /attendance/records`、`GET /attendance/stats`、`GET /attendance/worker/records`
- 薪资：`GET /salary/worker/stats`、`GET /salary/worker/pending`、`PATCH /salary/:id/worker-confirm`

### 联调步骤
1. 启动后端并确认可访问 `http://localhost:3001/docs`
2. 在小程序端配置 `miniprogram/app.js` 的 `baseUrl`
3. 使用登录接口获取 token，后续请求携带 `Authorization: Bearer <token>`
4. 验证核心链路：登录 → 岗位列表 → 报名 → 签到码 → 扫码签到 → 考勤查询 → 薪资查询

### 常见联调问题
- **小程序无法访问后端**：检查 `baseUrl`、关闭合法域名校验、确认后端端口启动
- **401 未授权**：检查 token 是否过期或未携带
- **扫码失败**：确认已授权相机权限并使用 `wx.scanCode`

## 测试数据

项目包含测试数据与文档：
- `注册测试信息.md` - 用户注册测试数据
- `申请入驻创建基地测试数据.md` - 基地申请测试数据
- `app/backend/scripts/seed-users.js` - 用户种子脚本

## 开发指南

### 代码规范
- 使用TypeScript进行类型检查
- 遵循ESLint规则
- 组件使用函数式组件 + Hooks
- API调用使用React Query

### 提交规范
- feat: 新功能
- fix: 修复bug
- docs: 文档更新
- style: 代码格式调整
- refactor: 代码重构
- test: 测试相关
- chore: 构建/工具链相关

## 许可证

本项目为数据库应用系统大作业项目。

## 联系方式

如有问题，请提交Issue或联系项目维护者。
