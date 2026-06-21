@echo off
title Game Launcher
cls
echo ===================================================
echo             GAME DEV LAUNCHER
echo ===================================================
echo.
echo Checking for Node.js installation...
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed!
    echo Please install Node.js from https://nodejs.org/ first.
    echo.
    pause
    exit /b
)

if not exist node_modules (
    echo Installing project dependencies (this may take a minute)...
    call npm install
)

echo Starting the Клик Клан backend and frontend server...
echo Point your browser to https://ais-pre-hp7aptrk5b2jplq55aftoy-728480963619.europe-west2.run.app
echo.
start "" https://ais-pre-hp7aptrk5b2jplq55aftoy-728480963619.europe-west2.run.app
call npm run dev
pause
