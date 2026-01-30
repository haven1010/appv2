# Git 更新仓库脚本
# 使用方法：在项目根目录「数据库应用系统大作业」下，用 PowerShell 执行：.\commit-changes.ps1

Write-Host "正在检查 Git 状态..." -ForegroundColor Green
git status

Write-Host ""
Write-Host "正在添加所有更改..." -ForegroundColor Green
git add .

Write-Host ""
Write-Host "正在创建提交..." -ForegroundColor Green
$commitMessage = @"
功能更新：考勤与薪资结算对接后端

考勤管理：
- 后端新增 GET /attendance/records、/stats、/bases 接口
- 前端考勤页集成今日签到列表、各基地统计、考勤汇总
- 基地管理员仅能查看自己基地的考勤数据（role/roleKey 兼容）

薪资结算：
- 后端新增 SalaryController：GET /salary/list、/stats，POST calculate、payment 等
- SalaryService 新增 getList、getStats，支持按基地/日期/状态筛选及基地管理员权限
- 前端 PayrollView 对接 API：工资记录列表、汇总统计、基地/日期/状态筛选

修复：
- 考勤接口中 user.roleKey 改为兼容 JWT 的 user.role
"@

git commit -m $commitMessage

if ($LASTEXITCODE -eq 0) {
  Write-Host ""
  Write-Host "========================================" -ForegroundColor Cyan
  Write-Host "提交完成！" -ForegroundColor Green
  Write-Host ""
  Write-Host "推送到远程仓库请执行：" -ForegroundColor Yellow
  Write-Host "  git push origin main" -ForegroundColor Cyan
  Write-Host "========================================" -ForegroundColor Cyan
} else {
  Write-Host ""
  Write-Host "若无新更改，会提示 nothing to commit。有未提交更改时请检查上方的 git status。" -ForegroundColor Yellow
}
