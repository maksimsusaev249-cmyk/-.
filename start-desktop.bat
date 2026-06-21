@echo off
:: Enable UTF-8 encoding in Windows command line for beautiful Russian text
chcp 65001 >nul
title Клик Клан - Desktop Client Launcher
cls
echo ====================================================================
echo             КЛИК КЛАН - SYSTEM DESKTOP APP LAUNCHER
echo ====================================================================
echo.
echo [1/4] Checking environment requirements...
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Платформа Node.js не установлена!
    echo Пожалуйста, запустите УСТАНОВКА_ИГРЫ.bat для автоматической установки.
    echo.
    pause
    exit /b
)

echo [2/4] Verifying and installing required packages...
if not exist node_modules (
    echo [INFO] Installing standard packages...
    call npm install --no-audit --no-fund
)

:: Check if Electron is installed, if not install it as a dev dependency
echo Checking desktop window subsystem (Electron)...
call npx electron -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] Installing desktop window environment (Electron)...
    call npm install electron --save-dev --no-audit --no-fund
)

echo [3/4] Building latest game assets and server bundle...
call npm run build

echo [3.5/4] Creating Desktop Shortcut...
:: Получаем директорию установки БЕЗ косой черты в конце, чтобы избежать ошибок экранирования в PowerShell
set "CURR_DIR=%~dp0"
if "%CURR_DIR:~-1%"=="\" set "CURR_DIR=%CURR_DIR:~0,-1%"

set "SHORTCUT_PATH=%USERPROFILE%\Desktop\ИГРА КЛИК КЛАН.lnk"
set "TARGET_PATH=%CURR_DIR%\start-desktop.bat"
set "WORKING_DIR=%CURR_DIR%"

echo Создаем ярлык: %SHORTCUT_PATH%
powershell -NoProfile -ExecutionPolicy Bypass -Command "$WShell = New-Object -ComObject WScript.Shell; $Shortcut = $WShell.CreateShortcut('%SHORTCUT_PATH%'); $Shortcut.TargetPath = '%TARGET_PATH%'; $Shortcut.WorkingDirectory = '%WORKING_DIR%'; $Shortcut.Description = 'Начать игру Клик Клан на полный экран!'; $Shortcut.Save()"
echo [INFO] Ярлык "ИГРА КЛИК КЛАН" успешно создан на вашем Рабочем Столе!

echo [4/4] Starting Game backend and raising Desktop Window...
echo --------------------------------------------------------------------
echo Desktop Window client is starting!
echo You can run this completely offline or connected to the Telegram Bot!
echo To shut down the game, simply close the desktop application window.
echo --------------------------------------------------------------------
echo.

npx electron desktop-main.cjs

echo.
echo Application shut down successfully.
pause
