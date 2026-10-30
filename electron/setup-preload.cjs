const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('siteSetup', {
  save: value => ipcRenderer.invoke('save-site-url', value)
});
