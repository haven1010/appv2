# Web Admin

React + Vite 管理后台，服务于超级管理员、基地管理员和现场管理员。

## Run

```bash
npm install
npm run dev
```

默认地址：`http://localhost:3000`

开发时请先启动后端 `apps/backend`，前端会把 `/api` 代理到 `http://localhost:3001`。

## Structure

```text
src/
├── App.tsx              # 路由、登录状态、角色守卫
├── views/               # 数据看板、基地、岗位、考勤、薪资、审核等页面
├── layouts/             # 后台布局
├── components/          # 通用 UI 组件
├── api/                 # Orval 生成的接口类型
├── lib/                 # HTTP 请求与工具函数
└── styles.css
```

## Main Pages

- `/login`：登录
- `/register`：注册
- `/dashboard`：管理端工作台
- `/dashboard/bases`：基地管理
- `/dashboard/jobs`：招聘管理
- `/dashboard/attendance`：考勤管理
- `/dashboard/payroll`：薪资结算
- `/worker`：工人 Web 视图
