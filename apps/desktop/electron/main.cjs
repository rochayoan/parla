const { app, BrowserWindow, globalShortcut, clipboard, ipcMain } = require('electron');
const path = require('path');
const { exec } = require('child_process');

let mainWindow;

function createWindow() {
  const { screen } = require('electron');
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenW, height: screenH } = primaryDisplay.workAreaSize;

  mainWindow = new BrowserWindow({
    width: 340,
    height: 80,
    x: screenW - 360,
    y: screenH - 100,
    alwaysOnTop: true,
    skipTaskbar: true,
    frame: false,
    transparent: true,
    resizable: false,
    show: false,
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
    // Hide on blur so clicking away dismisses it
    if (mainWindow && mainWindow.isVisible()) {
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function toggleOverlay() {
  if (!mainWindow) return;
  if (mainWindow.isVisible()) {
    mainWindow.hide();
  } else {
    mainWindow.showInactive(); // show without stealing focus
  }
}

// Register global hotkey
app.whenReady().then(() => {
  createWindow();

  const registered = globalShortcut.register('CmdOrCtrl+Shift+P', toggleOverlay);
  if (!registered) {
    console.error('Failed to register global hotkey CmdOrCtrl+Shift+P');
  }
});

// IPC: paste text into active app
ipcMain.handle('parla:paste', (_event, text) => {
  clipboard.writeText(text);
  // Simulate paste keystroke
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
  // Auto-hide after paste
  setTimeout(() => {
    if (mainWindow) mainWindow.hide();
  }, 200);
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
