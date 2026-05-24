# 微信云开发接入第一阶段

本文档记录第一阶段接入结果：只接入 CloudBase 初始化和云数据库访问封装，不迁移现有核心业务。

## 当前策略

- 登录、权限、考勤、工资、基地、岗位等核心功能继续使用 `NestJS API -> MySQL`。
- 微信云开发数据库先用于低风险数据，例如配置、反馈、公告、客户端日志和文件元数据。
- 当前已配置 `envId`：`cloud1-7gukagm3a064dc47`。

## 已新增文件

```text
apps/wechat-miniprogram/config/cloud.js
apps/wechat-miniprogram/utils/cloud-db.js
```

## 已调整文件

```text
apps/wechat-miniprogram/app.js
```

## 需要你在微信开发者工具中完成

以下准备工作已完成：

1. 已打开微信开发者工具并进入云开发控制台。
2. 已开通云开发环境。
3. 已确认云环境 ID：`cloud1-7gukagm3a064dc47`。
4. 已创建 `app_config` 集合。
5. 已添加 `cloudbaseSmokeTest` 测试数据。

如需临时切换调试环境，可在调试器 Console 中执行：

```js
const app = getApp()
app.setCloudEnvId('你的云环境ID')
```

当前代码配置位于 `apps/wechat-miniprogram/config/cloud.js`。

## 建议先创建的集合

第一阶段已创建测试集合：

```text
app_config
```

可以在 `app_config` 中添加一条测试数据：

```json
{
  "key": "cloudbaseSmokeTest",
  "value": "ok",
  "enabled": true
}
```

## 调试器验证命令

配置 `envId` 并创建 `app_config` 后，在微信开发者工具 Console 中执行：

```js
const app = getApp()
app.getCloudDb().get('appConfig', {
  where: { key: 'cloudbaseSmokeTest' },
  limit: 1
}).then(console.log).catch(console.error)
```

预期结果：能看到 `app_config` 集合中的测试记录。

## 风险控制

- 第一阶段不改任何业务页面的数据来源。
- 云开发配置为空时保持禁用状态。
- 不把后端密钥、数据库密码或管理员凭据放入小程序端。
- 正式迁移模块前，需要先配置集合权限规则。

## 第一阶段验收标准

- 小程序可以正常启动。
- 原有登录和后端 API 请求不受影响。
- 配置真实 `envId` 后，`wx.cloud.init()` 能成功执行。
- 能通过封装方法读取 `app_config` 测试数据。

第二阶段集合结构与权限规则见 [cloudbase-stage-2.md](cloudbase-stage-2.md)。
