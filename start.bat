@echo off
REM Spa CRM - double-click de chay. Mo trinh duyet: http://localhost:3000
cd /d "%~dp0"
title Spa CRM
if not exist ".next\BUILD_ID" (
  echo Chua build. Dang chay npm run build...
  call npm run build || (pause & exit /b 1)
)
call npm start
pause
