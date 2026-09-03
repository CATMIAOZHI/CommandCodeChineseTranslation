@echo off
title Command Code 还原英文版
cd /d "%~dp0"

echo ============================================
echo   Command Code 还原英文原版
echo ============================================
echo.

set APP_DIR=D:\commandcodedesktop\Command Code
if not exist "%APP_DIR%\resources\app\out\main\index.js" (
    echo [错误] 未找到默认安装目录: %APP_DIR%
    set /p APP_DIR=请输入 Command Code 安装目录:
)

node "%~dp0localize.js" restore "%APP_DIR%" >nul 2>&1
if errorlevel 1 (
    echo.
    echo [失败] 还原未完成。可手动运行下面命令查看详细错误:
    echo   node "%~dp0localize.js" restore "%APP_DIR%"
    pause
    exit /b 1
)

echo.
echo [完成] 已还原为英文原版。
pause
