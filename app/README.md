# 🍎 采摘通 (Picking-Pass) | 农业劳动力全生命周期管理平台

> 西北工业大学计算机学院《数据库系统》课程大作业

![Build Status](https://img.shields.io/badge/Build-Passing-brightgreen)
![Backend](https://img.shields.io/badge/Backend-NestJS%20%7C%20TypeORM-E0234E)
![Frontend](https://img.shields.io/badge/Frontend-React%20%7C%20Vite-61DAFB)

## 📖 项目背景

**采摘通 (Picking-Pass)** 是一个基于 B/S 架构的现代农业用工管理系统。针对传统农业园区“招工难、考勤乱、结算慢”的痛点，系统利用二维码技术和数字化流程，实现了从**岗位发布、工人报名、扫码核销**到**薪资自动结算**的 O2O 闭环管理。

---

## 🏗 系统架构与目录结构

本项目采用前后端分离架构。后端基于 **NestJS** 模块化设计，前端基于 **React + Vite**，并通过 **Orval** 自动生成 API 客户端代码。

### 📂 目录结构说明

```bash
picking-pass/
├── 📂 backend/                 # 后端工程 (NestJS)
│   ├── src/
│   │   ├── 📂 modules/         # 🧩 核心业务模块 (高内聚设计)
│   │   │   ├── 📂 auth/          # 认证模块 (JWT, Guard)
│   │   │   ├── 📂 user/          # 用户管理 (AES加密, Hash索引)
│   │   │   ├── 📂 base/          # 基地管理 (入驻, 审核)
│   │   │   ├── 📂 attendance/    # 考勤模块 (核心业务)
│   │   │   ├── 📂 salary/        # 薪资结算 (触发器联动)
│   │   │   ├── 📂 recommendation/# 智能推荐 (SQL复杂查询)
│   │   │   ├── 📂 qrcode/        # 二维码服务
│   │   │   └── 📂 common/        # 公共拦截器与过滤器
│   │   ├── app.module.ts       # 根模块
│   │   └── main.ts             # 入口文件 (Swagger配置)
│   ├── docker-compose.yml      # 容器编排
│   └── package.json
│
├── 📂 frontend/                # 前端工程 (React + Vite)
│   ├── src/
│   │   ├── 📂 api/             # 🤖 由 Orval 自动生成的接口代码
│   │   ├── 📂 views/           # 页面视图 (Login, Dashboard...)
│   │   ├── 📂 components/      # 公共组件
│   │   └── App.tsx
│   ├── orval.config.ts         # 接口代码生成配置
│   └── vite.config.ts          # 构建配置
│
└── 📄 README.md

```

---

## ✨ 核心功能模块

| 模块名称 | 对应代码目录 | 功能描述 |
| --- | --- | --- |
| **认证与安全** | `modules/auth` | 基于 JWT 的双令牌刷新机制；密码/身份证/手机号 AES-256 加密存储。 |
| **基地管理** | `modules/base` | 基地资质上传、审核流转、发布招聘岗位（支持多种薪资模式）。 |
| **考勤签到** | `modules/attendance` | **动态二维码**生成；现场扫码核销；支持离线签到数据同步。 |
| **薪资结算** | `modules/salary` | 自动化计算（工时×时薪 / 件数×单价）；**单价快照**机制防止历史数据篡改。 |
| **智能推荐** | `modules/recommendation` | 基于工人历史数据和岗位画像，利用复杂 SQL 查询推荐匹配岗位。 |

---

## 🛠 技术栈概览

### Backend (后端)

* **Core Framework**: [NestJS](https://nestjs.com/) (Node.js) - 企业级模块化开发框架。
* **Database ORM**: [TypeORM](https://typeorm.io/) - 优秀的 TypeScript ORM，防注入设计。
* **Database**: MySQL 8.0 - 存储核心业务数据。
* **Cache**: Redis - 缓存高频查询（如推荐列表）。
* **Storage**: Tencent Cloud COS (腾讯云对象存储) - 存储基地资质、现场照片。

### Frontend (前端)

* **Core**: React 18 + TypeScript.
* **Build Tool**: Vite - 极速构建体验。
* **API Generator**: [Orval](https://orval.dev/) - 根据 Swagger 文档自动生成 TypeScript 接口定义与 Hooks。
* **UI Library**: Ant Design / TailwindCSS.

---

## 🚀 快速启动 (Quick Start)

### 1. 环境准备

确保本地已安装：

* Node.js (v18+)
* MySQL (v8.0+)
* Docker (可选，推荐)

### 2. 数据库初始化

1. 创建数据库 `pickpass_db`。
2. 导入项目根目录下的 **`picking_pass_db_final.sql`** 文件。

* *注：该 SQL 文件包含完整的表结构、初始化数据及核心**触发器(Trigger)**代码。*

### 3. 后端启动

```bash
cd backend

# 安装依赖
npm install

# 配置环境变量
# 复制 .env.example 为 .env，并填入你的数据库密码
cp .env.example .env

# 启动开发模式
npm run start:dev

```

后端启动成功后，访问 Swagger 文档：`http://localhost:3000/api/docs`

### 4. 前端启动

由于前端依赖后端生成的 API 类型，建议后端启动后再运行前端。

```bash
cd frontend

# 安装依赖
npm install

# (可选) 根据后端 Swagger 更新接口代码
npm run generate:api

# 启动前端
npm run dev

```

---

## ⚙️ 环境变量配置 (.env)

请在 `backend` 目录下创建 `.env` 文件，配置如下关键参数：

```ini
# --- Database Configuration ---
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=your_password
DB_DATABASE=pickpass_db

# --- Security ---
# JWT 密钥 (越长越好)
JWT_SECRET=super_secret_key_for_course_design_2025
# AES 加密密钥 (必须32位)
AES_KEY=CaiZhiTong2025AES32ByteKey123456
# AES 偏移量 (必须16位)
AES_IV=0123456789012345

# --- Storage (COS) ---
COS_SECRET_ID=your_id
COS_SECRET_KEY=your_key
COS_BUCKET=your_bucket
COS_REGION=ap-guangzhou

```

---

## 💡 课程设计亮点 (Highlights)

1. **数据库范式设计**：严格遵循 3NF，解耦了“基地”与“岗位”实体，避免数据冗余。
2. **触发器应用 (`trg_cascade_salary_cancel`)**：

* 在数据库层面保障业务一致性：当 `daily_signup` 状态变为“取消”时，触发器自动级联重置关联的 `labor_salary` 记录，防止财务坏账。

1. **安全与隐私**：

* 创新性地采用了 **"密文存储 + Hash索引"** 方案（`phone_enc`, `phone_hash`），既保护了用户隐私，又保证了  的检索速度。

1. **工程化实践**：

* 后端采用 NestJS 模块化架构。
* 前端使用 Orval 自动生成代码，实现了前后端接口的类型安全 (Type-Safe)。

---

## 👥 作者

* **赵张阳** - 后端架构 / 数据库设计 / DevOps
* **张睿** - 前端开发 / 接口联调 / 测试

---
