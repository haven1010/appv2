# Git仓库设置指南

## 步骤1：初始化Git仓库

在PowerShell中，进入项目根目录并执行：

```powershell
cd "D:\competition\appv2\数据库应用系统大作业"
git init
```

或者直接运行我创建的脚本：

```powershell
cd "D:\competition\appv2\数据库应用系统大作业"
.\setup-git.ps1
```

## 步骤2：添加文件并提交

```powershell
# 添加所有文件
git add .

# 创建初始提交
git commit -m "Initial commit: 采摘工智慧管理系统"
```

## 步骤3：在GitHub上创建仓库

1. 访问 https://github.com/new
2. 填写仓库信息：
   - **Repository name**: `picker-management-system` (或你喜欢的名字)
   - **Description**: `采摘工智慧管理系统 - 农业劳动力管理平台`
   - **Visibility**: 选择 Public 或 Private
   - **不要勾选** "Initialize this repository with a README"（因为我们已经有了）
   - **不要添加** .gitignore 或 license（因为我们已经有了）
3. 点击 "Create repository"

## 步骤4：连接本地仓库到GitHub

创建仓库后，GitHub会显示命令。执行以下命令（替换 `<YOUR_USERNAME>` 和 `<REPO_NAME>`）：

```powershell
# 添加远程仓库（替换为你的实际URL）
git remote add origin https://github.com/<YOUR_USERNAME>/<REPO_NAME>.git

# 将主分支重命名为 main（如果还没有）
git branch -M main

# 推送代码到GitHub
git push -u origin main
```

## 步骤5：验证

访问你的GitHub仓库页面，应该能看到所有文件已经上传。

## 常见问题

### 如果提示需要身份验证

GitHub现在使用个人访问令牌（Personal Access Token）而不是密码：

1. 访问 https://github.com/settings/tokens
2. 点击 "Generate new token" -> "Generate new token (classic)"
3. 设置权限：至少勾选 `repo` 权限
4. 生成后复制令牌
5. 推送时，用户名输入你的GitHub用户名，密码输入刚才复制的令牌

### 如果文件太大

如果某些文件（如 `node_modules`）太大，确保 `.gitignore` 文件已正确配置。我已经创建了 `.gitignore` 文件，应该会自动忽略这些文件。

### 如果遇到路径问题

如果路径中包含中文字符导致问题，可以尝试：

```powershell
# 使用短路径
cd D:\competition\appv2
cd 数据库应用系统大作业
```

## 后续操作

推送成功后，你可以：

- 在GitHub上查看代码
- 使用GitHub的Issues跟踪问题
- 使用Pull Requests进行协作
- 设置GitHub Actions进行CI/CD（可选）

## 快速命令参考

```powershell
# 查看状态
git status

# 查看远程仓库
git remote -v

# 查看提交历史
git log --oneline

# 添加文件
git add <文件名>

# 提交更改
git commit -m "提交信息"

# 推送到GitHub
git push origin main

# 拉取最新更改
git pull origin main
```
