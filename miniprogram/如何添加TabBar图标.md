# 如何添加TabBar图标

## 方案1：暂时不使用图标（当前方案）

我已经修改了 `app.json`，移除了图标路径，只使用文字TabBar。这样可以先让项目运行起来。

## 方案2：创建图标文件

### 步骤1：创建图标

你需要创建以下8个图标文件（建议尺寸：81x81px，PNG格式）：

1. `images/home.png` - 首页图标（未选中）
2. `images/home-active.png` - 首页图标（选中）
3. `images/base.png` - 基地图标（未选中）
4. `images/base-active.png` - 基地图标（选中）
5. `images/qrcode.png` - 二维码图标（未选中）
6. `images/qrcode-active.png` - 二维码图标（选中）
7. `images/profile.png` - 我的图标（未选中）
8. `images/profile-active.png` - 我的图标（选中）

### 步骤2：图标设计建议

- **未选中状态**：灰色（#666666），建议使用线条图标
- **选中状态**：绿色（#4ade80），建议使用填充图标
- **尺寸**：81x81px（微信小程序推荐尺寸）
- **格式**：PNG，透明背景
- **风格**：简洁、清晰，符合小程序设计规范

### 步骤3：在线图标资源

你可以使用以下工具创建或下载图标：

1. **IconFont（阿里巴巴图标库）**
   - 网址：https://www.iconfont.cn/
   - 搜索关键词：首页、基地、二维码、我的
   - 下载PNG格式，尺寸选择81x81

2. **Flaticon**
   - 网址：https://www.flaticon.com/
   - 搜索相关图标，下载PNG格式

3. **简单图标生成**
   - 可以使用在线工具生成简单的文字图标
   - 或者使用设计软件（如Figma、Sketch）创建

### 步骤4：恢复TabBar配置

创建好图标文件后，修改 `app.json`，恢复图标路径：

```json
{
  "tabBar": {
    "color": "#666666",
    "selectedColor": "#4ade80",
    "backgroundColor": "#ffffff",
    "borderStyle": "black",
    "list": [
      {
        "pagePath": "pages/index/index",
        "text": "首页",
        "iconPath": "images/home.png",
        "selectedIconPath": "images/home-active.png"
      },
      {
        "pagePath": "pages/base/list/list",
        "text": "基地",
        "iconPath": "images/base.png",
        "selectedIconPath": "images/base-active.png"
      },
      {
        "pagePath": "pages/qrcode/qrcode",
        "text": "我的码",
        "iconPath": "images/qrcode.png",
        "selectedIconPath": "images/qrcode-active.png"
      },
      {
        "pagePath": "pages/profile/profile",
        "text": "我的",
        "iconPath": "images/profile.png",
        "selectedIconPath": "images/profile-active.png"
      }
    ]
  }
}
```

## 方案3：使用Base64编码的简单图标（临时方案）

如果暂时没有图标文件，可以使用Base64编码的简单图标。但这会增加文件大小，不推荐长期使用。

## 当前状态

✅ **已修复**：移除了图标路径配置，TabBar现在只显示文字，项目可以正常运行。

你现在可以：
1. 先使用文字TabBar进行开发和测试
2. 后续再添加图标文件
3. 或者使用在线图标资源快速创建图标

## 快速测试

现在项目应该可以正常运行了。在微信开发者工具中：
1. 点击"编译"按钮
2. 应该可以看到底部TabBar（只有文字，没有图标）
3. 可以正常切换页面
