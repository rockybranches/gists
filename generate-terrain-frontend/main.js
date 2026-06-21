const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const { spawn } = require('child_process')

let mainWindow = null
let backendProcess = null
let backendUrl = null
let urlResolve = null
let urlPromise = null

const BACKEND_PORT = 8090
const BACKEND_HOST = `http://localhost:${BACKEND_PORT}`

function getProjectRoot() {
  return path.resolve(__dirname, '..')
}

function startBackend(params) {
  if (backendProcess) {
    backendProcess.kill()
    backendProcess = null
  }

  backendUrl = null
  urlPromise = new Promise((resolve) => { urlResolve = resolve })

  const args = [
    'run', 'generate-terrain',
    '--width', String(params.width),
    '--length', String(params.length),
    '--height-scale', String(params.heightScale),
    '--scale', String(params.scale),
    '--octaves', String(params.octaves),
    '--roughness', String(params.roughness),
    '--seed', String(params.seed),
    '-s',
  ]

  const backendDir = path.join(getProjectRoot(), 'generate-terrain.py')

  backendProcess = spawn('uv', args, {
    cwd: backendDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PYTHONUNBUFFERED: '1' },
  })

  let detected = false

  backendProcess.stdout.on('data', (data) => {
    const output = data.toString()
    if (!detected && output.includes('Local server live at')) {
      detected = true
      backendUrl = BACKEND_HOST
      if (urlResolve) {
        urlResolve(backendUrl)
        urlResolve = null
      }
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('terrain-ready', backendUrl)
      }
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('backend-status', output.trim())
    }
  })

  backendProcess.stderr.on('data', (data) => {
    const output = data.toString()
    if (!detected && output.includes('Error') && urlResolve) {
      urlResolve(null)
      urlResolve = null
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('backend-error', output.trim())
    }
  })

  backendProcess.on('close', (code) => {
    backendProcess = null
    if (!detected) {
      if (urlResolve) {
        urlResolve(null)
        urlResolve = null
      }
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('backend-error', `Backend exited with code ${code}`)
      }
    }
  })
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'Terrain Generator',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
    },
  })

  mainWindow.loadFile('index.html')
  mainWindow.on('closed', () => { mainWindow = null })
}

ipcMain.handle('generate-terrain', (_event, params) => {
  startBackend(params)
})

ipcMain.handle('get-backend-url', () => {
  return urlPromise || Promise.resolve(backendUrl || BACKEND_HOST)
})

app.whenReady().then(() => {
  createWindow()
  startBackend({
    width: 100,
    length: 100,
    heightScale: 20,
    scale: 50,
    octaves: 4,
    roughness: 0.5,
    seed: 42,
  })
})

app.on('window-all-closed', () => {
  if (backendProcess) backendProcess.kill()
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  if (backendProcess) backendProcess.kill()
})
