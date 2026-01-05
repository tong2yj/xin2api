@echo off
chcp 65001 >nul
echo ========================================
echo    CatieCli 快速备份工具
echo ========================================
echo.

REM 获取当前日期
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
set BACKUP_DATE=%datetime:~0,8%

echo [1/3] 准备备份...
echo 备份日期: %BACKUP_DATE%
echo.

REM 检查是否在正确的目录
if not exist "zbpack.json" (
    echo ❌ 错误：请在项目根目录运行此脚本
    echo 当前目录：%CD%
    echo 应该在：D:\cc\CatieCli-main
    pause
    exit /b 1
)

echo [2/3] 创建备份文件夹...
set BACKUP_NAME=CatieCli-main-backup-%BACKUP_DATE%
set BACKUP_PATH=..\%BACKUP_NAME%

if exist "%BACKUP_PATH%" (
    echo ⚠️  备份文件夹已存在：%BACKUP_NAME%
    set /p OVERWRITE="是否覆盖？(Y/N): "
    if /i not "%OVERWRITE%"=="Y" (
        echo 取消备份
        pause
        exit /b 0
    )
    rmdir /s /q "%BACKUP_PATH%"
)

echo.
echo [3/3] 复制文件...
xcopy . "%BACKUP_PATH%" /E /I /H /Y /EXCLUDE:backup_exclude.txt

if errorlevel 1 (
    echo ❌ 备份失败
    pause
    exit /b 1
)

echo.
echo ========================================
echo    ✅ 备份完成！
echo ========================================
echo.
echo 备份位置：%BACKUP_PATH%
echo.
echo 备份内容：
dir "%BACKUP_PATH%" | find "个文件"
echo.
echo 接下来：
echo 1. 检查备份文件夹确认完整性
echo 2. 可以安全地进行更新了
echo 3. 如需恢复，参考 BACKUP_AND_RECOVERY.md
echo.
pause
