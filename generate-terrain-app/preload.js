const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  generateTerrain: (params) => ipcRenderer.invoke('generate-terrain', params),
  getBackendUrl: () => ipcRenderer.invoke('get-backend-url'),
  onTerrainReady: (callback) => {
    ipcRenderer.on('terrain-ready', (_event, url) => callback(url))
  },
  onStatus: (callback) => {
    ipcRenderer.on('backend-status', (_event, msg) => callback(msg))
  },
  onError: (callback) => {
    ipcRenderer.on('backend-error', (_event, msg) => callback(msg))
  },
})
