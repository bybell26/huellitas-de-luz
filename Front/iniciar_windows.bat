@echo off
chcp 65001 >nul
cd /d "%~dp0"
where py >nul 2>nul
if %ERRORLEVEL%==0 (
    py -3 servidor_local.py
) else (
    where python >nul 2>nul
    if %ERRORLEVEL%==0 (
        python servidor_local.py
    ) else (
        echo Para comenzar necesitas Python 3 o abrir index.html con Live Server de VS Code.
    )
)
echo.
pause
