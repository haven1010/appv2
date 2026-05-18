# Backend API

NestJS 后端服务，负责采摘通的认证、用户、基地、岗位、报名、考勤、薪资、推荐、日志和报表导出。

## Run

```bash
npm install
npm run start:dev
```

默认地址：

- API: `http://localhost:3001/api`
- Swagger: `http://localhost:3001/docs`

## Structure

```text
src/
├── main.ts
├── app.module.ts
└── modules/
    ├── auth/
    ├── user/
    ├── base/
    ├── attendance/
    ├── salary/
    ├── recommendation/
    ├── dashboard/
    ├── qrcode/
    └── common/
```

## Useful Commands

```bash
npm run build
npm run start:dev
npm run login:baseline
npm run simulate:full-flow
npm run db:backup
```

更多后端命令见 [docs/npm-commands-guide.md](docs/npm-commands-guide.md)。
