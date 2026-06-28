import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("parla", {
  transcribeAudio: (audioBase64, mimeType, mode, language) =>
    ipcRenderer.invoke("transcribe-audio", audioBase64, mimeType, mode, language),
  copyToClipboard: (text) =>
    ipcRenderer.invoke("copy-to-clipboard", text),
});
