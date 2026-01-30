# 采摘通微信小程序

## 快速开始

### 1. 配置项目

1. 打开微信开发者工具
2. 导入项目，选择 `miniprogram` 目录
3. 修改 `app.js` 中的 `baseUrl` 为你的后端API地址

### 2. 配置AppID

编辑 `project.config.json`，将 `appid` 改为你的小程序AppID，或使用测试号。

### 3. 启动后端服务

确保后端服务已启动（`http://localhost:3001`）

### 4. 真机调试

如果需要在真机上测试：

1. 确保手机和电脑在同一WiFi
2. 修改 `app.js` 中的 `baseUrl` 为电脑内网IP，如：`http://192.168.1.100:3001/api`
3. 在微信开发者工具中，点击"详情" -> "本地设置" -> 勾选"不校验合法域名"

## 功能说明

### 已实现页面

- ✅ 首页（index）- 显示推荐基地
- ✅ 登录页（login）- 手机号+身份证后6位登录
- ✅ 注册页（register）- 用户注册（待完善）
- ✅ 我的码（qrcode）- 显示个人签到二维码
- ✅ 我的（profile）- 个人信息（待完善）
- ✅ 基地列表（base/list）- 基地列表（待完善）
- ✅ 基地详情（base/detail）- 基地详情（待完善）

### 待完善页面

- ⏳ 注册页面完整功能
- ⏳ 个人信息编辑
- ⏳ 基地列表和详情
- ⏳ 岗位申请
- ⏳ 工资查询
- ⏳ 申请记录

## 开发说明

### 目录结构

```
miniprogram/
├── app.js              # 小程序入口
├── app.json            # 小程序配置
├── app.wxss            # 全局样式
├── pages/              # 页面目录
│   ├── index/          # 首页
│   ├── login/          # 登录页
│   ├── qrcode/         # 二维码页
│   └── ...
├── images/             # 图片资源（需要创建）
└── project.config.json # 项目配置
```

### API调用

使用 `app.request()` 方法统一调用API：

```javascript
const app = getApp();

// GET请求
const data = await app.request({
  url: '/user/profile',
  method: 'GET',
});

// POST请求
const result = await app.request({
  url: '/attendance/signup',
  method: 'POST',
  data: {
    baseId: 1,
    jobId: 1,
  },
});
```

### 登录状态管理

登录信息存储在本地：

```javascript
// 保存登录信息
wx.setStorageSync('token', token);
wx.setStorageSync('userInfo', userInfo);

// 读取登录信息
const token = wx.getStorageSync('token');
const userInfo = wx.getStorageSync('userInfo');
```

## 注意事项

1. **域名配置**：正式环境需要在微信公众平台配置服务器域名
2. **HTTPS**：正式环境必须使用HTTPS
3. **图片资源**：需要创建 `images` 目录并添加tabBar图标
4. **权限申请**：需要申请相机权限用于扫描二维码
