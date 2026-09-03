@echo off
chcp 65001 >nul
title Command Code 还原英文版
cd /d "%~dp0"

echo ============================================
echo   Command Code 还原英文原版
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

node "%~dp0localize.js" restore "%APP_DIR%"
if errorlevel 1 (
    echo.
    echo [失败] 还原未完成。可手动运行查看详细信息:
    echo   node "%~dp0localize.js" restore "%APP_DIR%"
    pause
    exit /b 1
)

echo.
echo [完成] 已还原为英文原版。
pause
