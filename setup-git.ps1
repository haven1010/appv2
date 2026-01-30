# Git仓库初始化脚本
# 使用方法：在PowerShell中执行：.\setup-git.ps1

Write-Host "正在初始化Git仓库..." -ForegroundColor Green

# 检查是否已经是git仓库
if (Test-Path .git) {
    Write-Host "警告: 已经是Git仓库，跳过初始化" -ForegroundColor Yellow
} else {
    git init
    Write-Host "Git仓库初始化完成" -ForegroundColor Green
}

# 添加所有文件
Write-Host "正在添加文件到暂存区..." -ForegroundColor Green
git add .

# 创建初始提交
Write-Host "正在创建初始提交..." -ForegroundColor Green
git commit -m "Initial commit: 采摘工智慧管理系统"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "下一步操作：" -ForegroundColor Yellow
Write-Host "1. 访问 https://github.com/new 创建新仓库" -ForegroundColor White
Write-Host "2. 不要初始化README、.gitignore或license" -ForegroundColor White
Write-Host "3. 创建仓库后，复制仓库URL（例如：https://github.com/yourusername/repo-name.git）" -ForegroundColor White
Write-Host "4. 然后执行以下命令：" -ForegroundColor White
Write-Host ""
Write-Host "   git remote add origin <你的仓库URL>" -ForegroundColor Cyan
Write-Host "   git branch -M main" -ForegroundColor Cyan
Write-Host "   git push -u origin main" -ForegroundColor Cyan
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
