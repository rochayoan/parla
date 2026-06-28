const { app, BrowserWindow, globalShortcut, clipboard, ipcMain } = require('electron');
const path = require('path');
const { exec } = require('child_process');

let mainWindow;

function createWindow() {
  const { screen } = require('electron');
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenW, height: screenH } = primaryDisplay.workAreaSize;

  mainWindow = new BrowserWindow({
    width: 200,
    height: 32,
    x: Math.round(screenW / 2 - 100),
    y: screenH - 60,
    alwaysOnTop: true,
    skipTaskbar: true,
    frame: false,
    transparent: true,
    resizable: false,
    show: false,
    hasShadow: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
    backgroundColor: '#00000000',
  });

  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.on('blur', () => {
    if (mainWindow && mainWindow.isVisible() && !recording) {
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

let recording = false;

// Expose recording state for blur logic
ipcMain.handle('parla:recording', (_e, val) => {
  recording = val;
});

function toggleOverlay() {
  if (!mainWindow) return;
  if (mainWindow.isVisible()) {
    mainWindow.hide();
  } else {
    // Reposition near cursor
    const { screen } = require('electron');
    const cursor = screen.getCursorScreenPoint();
    const disp = screen.getDisplayNearestPoint(cursor);
    const barW = 200;
    mainWindow.setPosition(
      Math.max(0, Math.min(cursor.x - Math.round(barW / 2), disp.workArea.x + disp.workArea.width - barW)),
      disp.workArea.y + disp.workArea.height - 60
    );
    mainWindow.showInactive();
  }
}

app.whenReady().then(() => {
  createWindow();
  globalShortcut.register('CmdOrCtrl+Shift+P', toggleOverlay);
});

ipcMain.handle('parla:paste', (_event, text) => {
  clipboard.writeText(text);
  const platform = process.platform;
  let cmd;
  if (platform === 'darwin') {
    cmd = `osascript -e 'tell application "System Events" to keystroke "v" using command down'`;
  } else if (platform === 'win32') {
    cmd = `powershell -command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^v')"`;
  } else {
    cmd = `xdotool key ctrl+v 2>/dev/null || wtype -M ctrl v -m ctrl`;
  }
  exec(cmd, (err) => {
    if (err) console.error('Paste failed:', err.message);
  });
  setTimeout(() => {
    if (mainWindow) mainWindow.hide();
  }, 300);
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
