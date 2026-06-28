const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('parla', {
  paste: (text) => ipcRenderer.invoke('parla:paste', text),
  recording: (val) => ipcRenderer.invoke('parla:recording', val),
});
