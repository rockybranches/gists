/**
 * main.js — Electron main process.
 *
 * All terrain generation is now performed in-process using the compiled
 * TypeScript terrain engine (dist/terrain.js).  No Python backend or HTTP
 * server is needed.
 */

const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const fs = require('fs')

// Compiled terrain engine (TypeScript → CommonJS via tsc)
const { generateTerrain, generateStl } = require('./dist/terrain')

let mainWindow = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'Terrain Generator',
    backgroundColor: '#0f1117',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow.loadFile('index.html')
  mainWindow.on('closed', () => { mainWindow = null })
}

// ──────────────────────────────────────────────────────────────────────────────
// IPC: generate terrain heightmap data → return to renderer for Plotly
// ──────────────────────────────────────────────────────────────────────────────
ipcMain.handle('generate-terrain', (_event, params) => {
  try {
    const result = generateTerrain({
      width:       params.width       ?? 100,
      length:      params.length      ?? 100,
      heightScale: params.heightScale ?? 20,
      baseHeight:  params.baseHeight  ?? 5,
      scale:       params.scale       ?? 50,
      octaves:     params.octaves     ?? 4,
      roughness:   params.roughness   ?? 0.5,
      seed:        params.seed        ?? 42,
    })
    return { ok: true, data: result }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
})

// ──────────────────────────────────────────────────────────────────────────────
// IPC: export STL — opens a save dialog and writes binary STL
// ──────────────────────────────────────────────────────────────────────────────
ipcMain.handle('export-stl', async (_event, params) => {
  try {
    const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
      title: 'Export STL',
      defaultPath: `terrain_${params.seed ?? 42}.stl`,
      filters: [{ name: 'STL Files', extensions: ['stl'] }],
    })

    if (canceled || !filePath) return { ok: false, canceled: true }

    const stlBuf = generateStl({
      width:       params.width       ?? 100,
      length:      params.length      ?? 100,
      heightScale: params.heightScale ?? 20,
      baseHeight:  params.baseHeight  ?? 5,
      scale:       params.scale       ?? 50,
      octaves:     params.octaves     ?? 4,
      roughness:   params.roughness   ?? 0.5,
      seed:        params.seed        ?? 42,
    })

    fs.writeFileSync(filePath, stlBuf)
    return { ok: true, filePath }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
})

app.whenReady().then(() => {
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
