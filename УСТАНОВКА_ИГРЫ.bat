@echo off
:: Enable UTF-8 encoding in Windows command line for beautiful Russian text
chcp 65001 >nul
title УСТАНОВЩИК ИГРЫ: КЛИК КЛАН (ПК ВЕРСИЯ)
color 0B
cls

echo ====================================================================
echo             АВТОМАТИЧЕСКАЯ УСТАНОВКА ИГРЫ "КЛИК КЛАН"
echo ====================================================================
echo.
echo Добро пожаловать! Этот легкий установщик подготовит полноценную ПК-версию
echo игры, настроит ускоренный запуск и создаст ярлык на вашем Рабочем Столе.
echo.
echo --------------------------------------------------------------------
echo [Шаг 1 из 4] Проверка готовности системы...
echo --------------------------------------------------------------------

node -v >nul 2>&1
if %errorlevel% equ 0 goto :node_already_installed

echo [ВНИМАНИЕ] Платформа Node.js не обнаружена.
echo Установщик сейчас сам настроит её на вашем компьютере совершенно бесплатно!
echo Пожалуйста, подождите, идет автоматическое скачивание...
echo.

:: Попытка установить через winget (встроенный в Win10/11)
winget -v >nul 2>&1
if %errorlevel% neq 0 goto :download_manual

echo [Установка] Скачиваем Node.js через официальный магазин Microsoft...
winget install OpenJS.NodeJS --silent --accept-source-agreements --accept-package-agreements >nul 2>&1
node -v >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Node.js успешно установлен через winget.
    goto :dependencies
)

:download_manual
:: Альтернативный вариант: скачивание msi-установщика через PowerShell
echo [Установка] Скачиваем официальный пакет установки Node.js LTS...
powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; (New-Object System.Net.WebClient).DownloadFile('https://nodejs.org/dist/v20.12.2/node-v20.12.2-x64.msi', 'node-install.msi')"

if exist node-install.msi goto :install_msi

echo.
echo [ОШИБКА] Не удалось скачать Node.js автоматически!
echo Пожалуйста, скачайте и установите Node.js LTS вручную с официального сайта:
echo https://nodejs.org/
echo После завершения установки перезапустите этот установщик.
echo.
pause
exit /b

:install_msi
echo [Установка] Запускаем автоматическую настройку. Пожалуйста, следуйте инструкциям в открывшемся окне...
msiexec /i node-install.msi /passive
del node-install.msi
goto :node_verify

:node_verify
:: Проверим установку повторно
node -v >nul 2>&1
if %errorlevel% equ 0 goto :dependencies

echo.
echo [ВНИМАНИЕ] Для завершения установки Node.js может потребоваться перезапуск системы или терминала.
echo Попробуйте запустить этот файл снова от имени Администратора.
echo Если это не помогло, скачайте Node.js вручную с https://nodejs.org/
echo.
pause
exit /b

:node_already_installed
echo [OK] Платформа Node.js уже установлена. Версия:
node -v
goto :dependencies

:dependencies
echo.
echo --------------------------------------------------------------------
echo [Шаг 2 из 4] Установка пакетов и движка игры...
echo --------------------------------------------------------------------
echo Пожалуйста, подождите, идет распаковка ресурсов и настройка модулей...
echo Это займет около 30-60 секунд. Командная строка может временно замереть.
echo.

call npm install --no-audit --no-fund

echo.
echo [Настройка] Устанавливаем защищенную оконную подсистему (Electron)...
call npm install electron --save-dev --no-audit --no-fund

echo.
echo --------------------------------------------------------------------
echo [Шаг 3 из 4] Сборка оптимизированных игровых файлов...
echo --------------------------------------------------------------------
call npm run build

echo.
echo --------------------------------------------------------------------
echo [Шаг 4 из 4] Создание Ярлыка на Рабочем Столе...
echo --------------------------------------------------------------------

:: Получаем директорию установки БЕЗ косой черты в конце, чтобы избежать багов экранирования в PowerShell
set "CURR_DIR=%~dp0"
if "%CURR_DIR:~-1%"=="\" set "CURR_DIR=%CURR_DIR:~0,-1%"

set "SHORTCUT_PATH=%USERPROFILE%\Desktop\ИГРА КЛИК КЛАН.lnk"
set "TARGET_PATH=%CURR_DIR%\start-desktop.bat"
set "WORKING_DIR=%CURR_DIR%"

echo Создаем ярлык: %SHORTCUT_PATH%
powershell -NoProfile -ExecutionPolicy Bypass -Command "$WShell = New-Object -ComObject WScript.Shell; $Shortcut = $WShell.CreateShortcut('%SHORTCUT_PATH%'); $Shortcut.TargetPath = '%TARGET_PATH%'; $Shortcut.WorkingDirectory = '%WORKING_DIR%'; $Shortcut.Description = 'Начать игру Клик Клан на полный экран!'; $Shortcut.Save()"

if exist "%SHORTCUT_PATH%" (
    echo [OK] Ярлык "ИГРА КЛИК КЛАН" успешно создан на вашем Рабочем Столе!
) else (
    echo [ИНФО] Не удалось создать ярлык на Рабочем Столе, но игра полностью готова к запуску!
    echo Вы можете запустить её вручную кликом по start-desktop.bat в этой папке.
)

echo.
echo ====================================================================
echo             ПОЗДРАВЛЯЕМ! ИГРА КЛИК КЛАН УСПЕШНО УСТАНОВЛЕНА!
echo ====================================================================
echo.
echo • Мы сейчас попробуем запустить игру на вашем компьютере.
echo • В случае проблем - просто откройте ярлык "ИГРА КЛИК КЛАН" на Рабочем Столе.
echo.
pause

echo Запуск полноценного клиента игры...
npx electron desktop-main.cjs
if %errorlevel% neq 0 (
    echo.
    echo [ВНИМАНИЕ] Не удалось запустить игру напрямую через Electron.
    echo Пожалуйста, зайдите в папку с игрой и запустите start-desktop.bat вручную.
    pause
)
exit
