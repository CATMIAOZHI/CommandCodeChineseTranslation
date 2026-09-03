@echo off
chcp 65001 >nul
title Command Code 一键汉化
cd /d "%~dp0"

echo ============================================
echo   Command Code 一键汉化
echo ============================================
echo.

rem 目录解析：优先环境变量 CC_APP_DIR，其次自动探测，都失败才手动输入
if defined CC_APP_DIR (
    set "APP_DIR=%CC_APP_DIR%"
) else (
    set "APP_DIR="
    for %%D in ("%LOCALAPPDATA%\Programs\Command Code" "%PROGRAMFILES%\Command Code" "%PROGRAMFILES(X86)%\Command Code" "D:\commandcodedesktop\Command Code" "C:\commandcodedesktop\Command Code") do (
        if not defined APP_DIR (
            if exist "%%~D\resources\app\out\main\index.js" set "APP_DIR=%%~D"
        )
    )
)
if not defined APP_DIR (
    echo [提示] 未自动找到 Command Code 安装目录。
    set /p APP_DIR=请输入 Command Code 安装目录:
)

if not exist "%APP_DIR%\resources\app\out\main\index.js" (
    echo [错误] 目录中未找到 Command Code 应用: %APP_DIR%
    pause
    exit /b 1
)

node "%~dp0localize.js" apply "%APP_DIR%"
if errorlevel 2 (
    echo.
    echo [提示] 应用可能已汉化。如想重新汉化，请先运行 还原.bat 恢复英文版。
    pause
    exit /b 2
)
if errorlevel 1 (
    echo.
    echo [失败] 汉化未完成。可手动运行查看详细信息:
    echo   node "%~dp0localize.js" apply "%APP_DIR%"
    pause
    exit /b 1
)

echo.
echo [完成] 汉化成功！
echo 请完全退出 Command Code 后重新打开，即可看到中文界面。
echo 如需还原英文版，请双击运行 还原.bat
echo.
pause
