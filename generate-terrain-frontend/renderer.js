const webview = document.getElementById('terrain-view')
const generateBtn = document.getElementById('generate-btn')
const statusEl = document.getElementById('status')
const loadingOverlay = document.getElementById('loading-overlay')

const controls = {
  width: document.getElementById('width'),
  length: document.getElementById('length'),
  heightScale: document.getElementById('height-scale'),
  scale: document.getElementById('scale'),
  octaves: document.getElementById('octaves'),
  roughness: document.getElementById('roughness'),
  seed: document.getElementById('seed'),
}

const controlValues = {
  width: document.getElementById('width-value'),
  length: document.getElementById('length-value'),
  heightScale: document.getElementById('height-scale-value'),
  scale: document.getElementById('scale-value'),
  octaves: document.getElementById('octaves-value'),
  roughness: document.getElementById('roughness-value'),
}

let currentUrl = null
let initialLoadDone = false

function getParams() {
  return {
    width: parseInt(controls.width.value, 10),
    length: parseInt(controls.length.value, 10),
    heightScale: parseFloat(controls.heightScale.value),
    scale: parseFloat(controls.scale.value),
    octaves: parseInt(controls.octaves.value, 10),
    roughness: parseFloat(controls.roughness.value),
    seed: parseInt(controls.seed.value, 10),
  }
}

function setStatus(msg, type) {
  statusEl.textContent = msg
  statusEl.className = type || ''
}

for (const [key, el] of Object.entries(controls)) {
  if (controlValues[key]) {
    el.addEventListener('input', () => {
      controlValues[key].textContent = el.value
    })
  }
}

function loadTerrain(url) {
  if (!url || url === currentUrl) return
  currentUrl = url
  loadingOverlay.style.display = 'none'
  webview.src = url
}

window.electronAPI.getBackendUrl().then((url) => {
  if (url && !initialLoadDone) {
    initialLoadDone = true
    loadTerrain(url)
  }
})

window.electronAPI.onTerrainReady((url) => {
  initialLoadDone = true
  loadTerrain(url)
  generateBtn.disabled = false
  generateBtn.textContent = 'Generate'
  setStatus('Terrain loaded', 'success')
})

window.electronAPI.onStatus((msg) => {
  if (msg.includes('Generating')) {
    setStatus('Generating terrain...', 'loading')
  }
})

window.electronAPI.onError((msg) => {
  generateBtn.disabled = false
  generateBtn.textContent = 'Generate'
  setStatus(msg, 'error')
  loadingOverlay.textContent = 'Error generating terrain. Is the backend installed?'
  loadingOverlay.style.display = 'block'
})

generateBtn.addEventListener('click', () => {
  const params = getParams()
  generateBtn.disabled = true
  generateBtn.textContent = 'Generating...'
  setStatus('Generating terrain...', 'loading')
  loadingOverlay.textContent = 'Generating terrain...'
  loadingOverlay.style.display = 'block'
  currentUrl = null
  webview.src = 'about:blank'
  window.electronAPI.generateTerrain(params)
})

webview.addEventListener('did-finish-load', () => {
  setStatus('Terrain visualization ready', 'success')
  loadingOverlay.style.display = 'none'
})

webview.addEventListener('did-fail-load', () => {
  if (loadingOverlay.style.display !== 'none') {
    loadingOverlay.textContent = 'Loading terrain view...'
  }
})
