@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Necesitas Node.js 22 o superior para ejecutar estas pruebas.
  pause
  exit /b 1
)
echo Abre http://127.0.0.1:8010 en tu navegador.
node server.cjs
pause
