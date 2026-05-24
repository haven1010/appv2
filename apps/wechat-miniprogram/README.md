# WeChat Mini Program

微信小程序端，覆盖工人、老板、现场管理员和移动管理场景。

## Open

1. 打开微信开发者工具。
2. 导入 `apps/wechat-miniprogram`。
3. 确认 `app.js` 中的 `baseUrl` 指向后端，例如 `http://127.0.0.1:3001/api`。
4. 本地联调时勾选“不校验合法域名”。
5. 如需启用微信云开发，请先阅读 [../../docs/cloudbase-stage-1.md](../../docs/cloudbase-stage-1.md)。

## Structure

```text
.
├── app.js
├── app.json
├── config/       # 环境和云开发配置
├── custom-tab-bar/
├── pages/
│   ├── index/        # 工人广场
│   ├── login/
│   ├── register/
│   ├── base/
│   ├── job/
│   ├── signup/
│   ├── qrcode/
│   ├── salary/
│   ├── profile/
│   ├── boss/         # 老板端
│   ├── field/        # 现场管理员端
│   └── admin/        # 移动管理端
└── utils/        # 角色、云数据库等公共工具
```

## Core Flows

- 工人：浏览岗位、报名、出示签到码、确认工资。
- 老板：提交入驻资料、结算并提交工资表。
- 现场管理员：扫码签到、查看考勤记录。
- 管理端：基地、考勤、用户和系统工资表管理。

家人代注册流程见 [README_采摘工端.md](README_采摘工端.md)。
