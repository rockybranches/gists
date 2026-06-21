const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,

  /** Generate terrain heightmap in the main process and return z-data */
  generateTerrain: (params) => ipcRenderer.invoke('generate-terrain', params),

  /** Open a save dialog and write a binary STL file */
  exportStl: (params) => ipcRenderer.invoke('export-stl', params),
})
