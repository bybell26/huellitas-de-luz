@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Necesitas Node.js 22 o superior.
  pause
  exit /b 1
)
echo Abre http://127.0.0.1:8000/index.html
node servidor_local.cjs
pause
