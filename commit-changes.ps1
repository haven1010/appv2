# Git提交脚本
# 使用方法：在PowerShell中执行：.\commit-changes.ps1

Write-Host "正在检查Git状态..." -ForegroundColor Green
git status

Write-Host ""
Write-Host "正在添加所有更改的文件..." -ForegroundColor Green
git add .

Write-Host ""
Write-Host "正在创建提交..." -ForegroundColor Green
$commitMessage = @"
功能更新：

1. 修复考勤管理页面权限问题
   - 将BASE_ADMIN加入考勤管理访问权限
   - 更新侧边栏菜单权限配置

2. 优化招聘岗位表单
   - 为所有输入字段添加标签说明
   - 删除冗余的提示和说明文字
   - 改进表单用户体验

3. 添加测试数据文档
   - 创建发布招聘岗位测试数据文档
   - 包含6组不同薪资类型的测试数据

4. 项目文档完善
   - 添加README.md项目说明
   - 添加Git设置指南
   - 创建.gitignore文件
"@

git commit -m $commitMessage

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "提交完成！" -ForegroundColor Green
Write-Host ""
Write-Host "如果已配置远程仓库，可以执行以下命令推送：" -ForegroundColor Yellow
Write-Host "  git push origin main" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
