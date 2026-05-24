# CloudBase Phase 1 迁移说明

本文档对应第一阶段基础迁移，只覆盖以下能力：

- 登录 `POST /auth/login`
- 个人资料 `GET/PATCH /user/profile`
- 基地列表 `GET /base`
- 基地详情 `GET /base/:id`
- 岗位列表 `GET /base/:id/jobs`
- 岗位详情 `GET /base/jobs/:jobId`

当前代码已经新增云函数 `phase1Api`，并在小程序请求层中对白名单接口优先走该云函数。其余接口仍保留旧链路。

## 需要你手动完成的事项

以下操作需要在微信云开发控制台里完成，我无法替你直接点击：

1. 创建并上传云函数 `phase1Api`
2. 创建集合 `users`
3. 创建集合 `bases`
4. 创建集合 `jobs`
5. 按本文档的字段模板导入基础数据
6. 给云函数配置环境变量 `JWT_SECRET`

## 集合设计

### users

建议字段：

```json
{
  "id": 1,
  "uid": "U001",
  "name": "张三",
  "phone": "13800000000",
  "idCard": "610101199901011234",
  "role": "worker",
  "roleKey": "worker",
  "faceImgUrl": "",
  "avatarUrl": "",
  "headImgUrl": "",
  "photoUrl": "",
  "gender": "male",
  "isPoorHousehold": false,
  "assignedBaseId": null,
  "homeAddress": "陕西省西安市...",
  "bankName": "中国农业银行",
  "bankCardNo": "6228...",
  "emergencyContact": "李四-父亲",
  "emergencyPhone": "13900000000",
  "infoAuditStatus": 1,
  "registerMode": "self",
  "accountOwnerVerified": true,
  "loginLockReason": null,
  "isDeleted": false,
  "createdAt": "2026-05-04T00:00:00.000Z",
  "updatedAt": "2026-05-04T00:00:00.000Z"
}
```

必须保证：

- `id` 唯一
- `uid` 唯一
- `phone` 唯一
- `roleKey` 取值与现有前端一致：
  - `worker`
  - `boss`
  - `base_manager`
  - `field_manager`
  - `super_admin`
  - `region_admin`

### bases

建议字段：

```json
{
  "id": 1,
  "baseName": "示范苹果基地",
  "licenseUrl": "cloud://.../license.jpg",
  "contactPhone": "13800000000",
  "category": 1,
  "regionCode": 610100,
  "address": "陕西省西安市...",
  "description": "{\"salary\":\"150元/天\",\"jobDescription\":\"采摘分拣\",\"fieldManagerPhone\":\"13800000000\"}",
  "auditStatus": 1,
  "ownerId": 2,
  "isDeleted": false,
  "createdAt": "2026-05-04T00:00:00.000Z",
  "updatedAt": "2026-05-04T00:00:00.000Z"
}
```

必须保证：

- `id` 唯一
- `ownerId` 对应 `users.id`
- `auditStatus = 1` 的基地才会在普通列表里显示

### jobs

建议字段：

```json
{
  "id": 1001,
  "baseId": 1,
  "jobTitle": "苹果采摘",
  "workAddress": "陕西省西安市...",
  "recruitCount": 30,
  "workHours": "08:00-17:00",
  "payType": 1,
  "salaryAmount": 150,
  "unitPrice": null,
  "hourlyRate": null,
  "requirements": "身体健康",
  "workContent": "采摘、分拣、装箱",
  "benefits": "包住宿",
  "workplaceImages": [],
  "validUntil": "2026-06-30T23:59:59.000Z",
  "workStartDate": "2026-05-05",
  "workEndDate": "2026-06-30",
  "status": 1,
  "auditStatus": 1,
  "isActive": true,
  "isDeleted": false,
  "createdAt": "2026-05-04T00:00:00.000Z",
  "updatedAt": "2026-05-04T00:00:00.000Z"
}
```

必须保证：

- `id` 唯一
- `baseId` 对应 `bases.id`
- 第一阶段展示岗位时，推荐至少设置：
  - `status = 1`
  - `auditStatus = 1`
  - `isActive = true`

## 第一阶段验证顺序

1. 上传并部署 `phase1Api`
2. 导入 `users / bases / jobs` 三个集合
3. 在云函数环境变量中配置 `JWT_SECRET`
4. 小程序清缓存后重新编译
5. 先测登录
6. 再测首页基地列表
7. 再测老板端基地列表
8. 再测个人资料页

## 当前仍未迁移的接口

以下能力仍走旧后端或旧云函数：

- 注册
- 报名
- 审核
- 考勤
- 工资
- 报表
- 后台统计
- 二维码签到

这些会在下一阶段继续迁移。
