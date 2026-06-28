import { app, BrowserWindow, ipcMain, clipboard } from "electron";
import path from "path";
import fs from "fs";

const BACKEND_URL = process.env.PARLA_BACKEND_URL || "http://localhost:3001";
let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 400,
    height: 600,
    resizable: true,
    frame: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: "Parla",
  });
  mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
}

const RECORDINGS_DIR = path.join(app.getPath("temp"), "parla-recordings");
if (!fs.existsSync(RECORDINGS_DIR)) {
  fs.mkdirSync(RECORDINGS_DIR, { recursive: true });
}

ipcMain.handle("transcribe-audio", async (_event, audioBase64, mimeType, mode, language) => {
  const buffer = Buffer.from(audioBase64, "base64");
  const tempFile = path.join(RECORDINGS_DIR, `audio-${Date.now()}.webm`);
  fs.writeFileSync(tempFile, buffer);

  try {
    const formData = new FormData();
    const blob = new Blob([buffer], { type: mimeType });
    formData.append("audio", blob, "audio.webm");
    formData.append("mode", mode);
    formData.append("language", language);

    const response = await fetch(`${BACKEND_URL}/api/transcribe`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || "Error en el backend");
    }
    return await response.json();
  } finally {
    try { fs.unlinkSync(tempFile); } catch {}
  }
});

ipcMain.handle("copy-to-clipboard", async (_event, text) => {
  clipboard.writeText(text);
  return true;
});

app.whenReady().then(createWindow);
app.on("window-all-closed", () => { app.quit(); });
