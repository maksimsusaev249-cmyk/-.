const fs = require('fs');
let content = fs.readFileSync('start.bat', 'utf8');

content = content.replace(
  /if %errorlevel% neq 0 \([\s\S]*?exit \/b\s*\)/,
  `if %errorlevel% neq 0 (
    echo [INFO] Платформа Node.js не найдена!
    echo [INFO] Запускаем веб-версию игры в вашем браузере по умолчанию...
    start https://ais-pre-hp7aptrk5b2jplq55aftoy-728480963619.europe-west2.run.app
    echo [INFO] Для установки Desktop-клиента, пожалуйста, установите Node.js
    timeout /t 5 >nul
    exit /b
)`
);

fs.writeFileSync('start.bat', content, 'utf8');
console.log('Successfully updated start.bat');
