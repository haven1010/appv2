@echo off
cd /d "%~dp0"

echo [1] feat(salary): worker stats, pending, confirm
git add app/backend/src/modules/salary/salary.controller.ts
git add app/backend/src/modules/salary/salary.service.ts
git diff --cached --quiet
if %errorlevel% neq 0 git commit -m "feat(salary): worker stats pending confirm API"

echo [2] feat(attendance): worker records
git add app/backend/src/modules/attendance/attendance.controller.ts
git add app/backend/src/modules/attendance/attendance.service.ts
git diff --cached --quiet
if %errorlevel% neq 0 git commit -m "feat(attendance): worker records API"

echo [3] feat(worker): full worker view
git add app/frontend/src/views/worker/WorkerView.tsx
git diff --cached --quiet
if %errorlevel% neq 0 git commit -m "feat(worker): full worker view"

echo Done.
git log --oneline -10
pause
