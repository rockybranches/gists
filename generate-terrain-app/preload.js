const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,

  /** Generate terrain heightmap in the main process and return z-data */
  generateTerrain: (params) => ipcRenderer.invoke('generate-terrain', params),

  /** Open a save dialog and write a binary STL file */
  exportStl: (params) => ipcRenderer.invoke('export-stl', params),

  /** Generate simulated geochemistry element concentration grids */
  generateGeochemistry: (params) => ipcRenderer.invoke('generate-geochemistry', params),

  /** Export geochemistry data as a CSV file via save dialog */
  exportGeochemistryCsv: (params) => ipcRenderer.invoke('export-geochemistry-csv', params),
})
