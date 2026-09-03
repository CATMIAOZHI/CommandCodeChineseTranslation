@echo off
title Command Code 一键汉化工具
cd /d "%~dp0"

echo ============================================
echo   Command Code 一键汉化工具
echo ============================================
echo.

set APP_DIR=D:\commandcodedesktop\Command Code
if not exist "%APP_DIR%\resources\app\out\main\index.js" (
    echo [错误] 未找到默认安装目录: %APP_DIR%
    set /p APP_DIR=请输入 Command Code 安装目录:
)

node "%~dp0localize.js" apply "%APP_DIR%" >nul 2>&1
if %errorlevel% equ 2 (
    echo.
    echo [提示] 应用可能已汉化。如想重新汉化，请先运行 还原.bat 恢复英文版。
    pause
    exit /b 2
)
if errorlevel 1 (
    echo.
    echo [失败] 汉化未完成。可手动运行下面命令查看详细错误:
    echo   node "%~dp0localize.js" apply "%APP_DIR%"
    pause
    exit /b 1
)

echo.
echo [完成] 汉化成功！
echo 请先完全退出 Command Code，再重新打开即可看到中文界面。
echo 如需还原英文版，请双击运行 还原.bat
echo.
pause
