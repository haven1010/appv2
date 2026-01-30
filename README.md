# 采摘工智慧管理系统

一个基于 React + NestJS 的农业劳动力管理平台，用于连接生产基地与采摘工人，优化用工资源配置。

## 项目结构

```
数据库应用系统大作业/
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
└── miniprogram/          # 微信小程序（可选）
```

## 技术栈

### 前端
- **React 18** - UI框架
- **Vite** - 构建工具
- **TypeScript** - 类型安全
- **React Query** - 数据获取与状态管理
- **Tailwind CSS** - 样式框架
- **React Router** - 路由管理

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

## 功能模块

### 用户角色
- **超级管理员** - 审核基地申请、管理全局配置
- **区域管理员** - 管理特定区域的基地
- **基地管理员** - 管理基地信息、发布招聘岗位
- **现场管理员** - 管理现场作业、考勤
- **采摘工** - 查看岗位、报名、查看工作进度

### 核心功能
- ✅ 用户注册与登录
- ✅ 基地申请与审核
- ✅ 招聘岗位发布与管理
- ✅ 岗位报名与审核
- ✅ 工作台与进度查看
- ✅ 考勤管理（小程序端）

## API文档

启动后端后，访问 http://localhost:3001/api 查看Swagger API文档。

## 测试数据

项目包含测试数据生成脚本和文档：
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
