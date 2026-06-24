const { app, BrowserWindow, Menu, Tray } = require("electron");
const path = require("path");
const { fork } = require("child_process");

let serverProcess = null;
let mainWindow = null;
let tray = null;
let isQuitting = false;

function startServer() {
  // We locate the bundled production server created by 'npm run build'
  const serverPath = path.join(__dirname, "dist", "server.cjs");
  
  console.log("Launching clicker server background process from:", serverPath);
  
  serverProcess = fork(serverPath, [], {
    env: { 
      ...process.env, 
      NODE_ENV: "production", 
      PORT: "3000" 
    }
  });

  serverProcess.on("error", (err) => {
    console.error("Backend Server Error:", err);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "Клик Клан - ПК Версия",
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Connect to the live game server
  const liveUrl = "https://ais-pre-hp7aptrk5b2jplq55aftoy-728480963619.europe-west2.run.app";
  
  console.log("Launching Клик Клан desktop client. Connecting to central server:", liveUrl);
  mainWindow.loadURL(liveUrl);

  // Handle page failures (e.g. connectivity issues) with an automatic reload
  mainWindow.webContents.on("did-fail-load", () => {
    console.log("Live server connection failed, retrying...");
    setTimeout(() => {
      if (mainWindow) {
        mainWindow.loadURL("https://ais-pre-hp7aptrk5b2jplq55aftoy-728480963619.europe-west2.run.app");
      }
    }, 2000);
  });

  mainWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      console.log("Window hidden. Game engine and Telegram bot still running in background...");
    }
  });
}

function createTray() {
  // Use a sensible default icon or you can provide a base64 string
  // For simplicity, we just use a native image placeholder or default app icon
  // In Electron, we can leave the path empty and it uses the default executable icon on Windows.
  // We will create a simple color block icon using nativeImage instead of an external file
  const { nativeImage } = require('electron');
  // Create an empty 16x16 icon
  let trayIcon = nativeImage.createEmpty();
  
  tray = new Tray(trayIcon);
  tray.setToolTip("Кликер 24/7 (Сервер и Бот работают)");
  
  const contextMenu = Menu.buildFromTemplate([
    { label: "Открыть Игру", click: () => mainWindow.show() },
    { type: "separator" },
    { 
      label: "Выход (Отключить бота)", 
      click: () => {
        isQuitting = true;
        app.quit();
      } 
    }
  ]);
  
  tray.setContextMenu(contextMenu);
  tray.on('click', () => {
    mainWindow.show();
  });
}

app.whenReady().then(() => {
  createWindow();
  createTray();
});

app.on("window-all-closed", () => {
  // Do nothing. We want it to stay in tray.
});

app.on("before-quit", () => {
  isQuitting = true;
});
