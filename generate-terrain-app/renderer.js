/**
 * renderer.js — Electron renderer process.
 *
 * Uses Plotly.js (loaded via CDN script tag in index.html) to render the
 * terrain heightmap as an interactive 3D surface — entirely in-process,
 * no Python backend or HTTP server required.
 */

/* global Plotly */

// ── DOM references ────────────────────────────────────────────────────────────
const plotEl        = document.getElementById('terrain-plot')
const generateBtn   = document.getElementById('generate-btn')
const exportBtn     = document.getElementById('export-btn')
const emptyState    = document.getElementById('empty-state')
const loadingOverlay = document.getElementById('loading-overlay')
const statusText    = document.getElementById('status-text')
const statusEl      = document.getElementById('status')

const controls = {
  width:       document.getElementById('width'),
  length:      document.getElementById('length'),
  heightScale: document.getElementById('height-scale'),
  scale:       document.getElementById('scale'),
  octaves:     document.getElementById('octaves'),
  roughness:   document.getElementById('roughness'),
  seed:        document.getElementById('seed'),
}

const controlValues = {
  width:       document.getElementById('width-value'),
  length:      document.getElementById('length-value'),
  heightScale: document.getElementById('height-scale-value'),
  scale:       document.getElementById('scale-value'),
  octaves:     document.getElementById('octaves-value'),
  roughness:   document.getElementById('roughness-value'),
}

// ── State ─────────────────────────────────────────────────────────────────────
let lastParams  = null
let plotInited  = false

// ── Helpers ───────────────────────────────────────────────────────────────────
function setStatus(msg, type) {
  statusText.textContent = msg
  statusEl.className = type || ''
}

function setLoading(active) {
  if (active) {
    loadingOverlay.classList.add('active')
    generateBtn.disabled = true
    generateBtn.textContent = '⏳ Generating…'
    exportBtn.disabled = true
  } else {
    loadingOverlay.classList.remove('active')
    generateBtn.disabled = false
    generateBtn.textContent = '⛰ Generate Terrain'
  }
}

function getParams() {
  return {
    width:       parseInt(controls.width.value, 10),
    length:      parseInt(controls.length.value, 10),
    heightScale: parseFloat(controls.heightScale.value),
    baseHeight:  5,
    scale:       parseFloat(controls.scale.value),
    octaves:     parseInt(controls.octaves.value, 10),
    roughness:   parseFloat(controls.roughness.value),
    seed:        parseInt(controls.seed.value, 10),
  }
}

// ── Slider live-update labels ─────────────────────────────────────────────────
for (const [key, el] of Object.entries(controls)) {
  if (controlValues[key]) {
    el.addEventListener('input', () => {
      const v = parseFloat(el.value)
      controlValues[key].textContent = Number.isInteger(v) ? String(v) : v.toFixed(2)
    })
  }
}

// ── Plotly 3D surface rendering ───────────────────────────────────────────────
const PLOTLY_LAYOUT = {
  paper_bgcolor: 'transparent',
  plot_bgcolor:  'transparent',
  margin:        { l: 0, r: 0, t: 0, b: 0 },
  scene: {
    bgcolor: 'transparent',
    xaxis: {
      title: '',
      showgrid: true,
      gridcolor: 'rgba(255,255,255,0.06)',
      zeroline: false,
      tickfont: { color: '#6b7299', size: 10 },
    },
    yaxis: {
      title: '',
      showgrid: true,
      gridcolor: 'rgba(255,255,255,0.06)',
      zeroline: false,
      tickfont: { color: '#6b7299', size: 10 },
    },
    zaxis: {
      title: 'Elevation',
      showgrid: true,
      gridcolor: 'rgba(255,255,255,0.06)',
      zeroline: false,
      tickfont: { color: '#6b7299', size: 10 },
      titlefont: { color: '#9ba3c5', size: 11 },
    },
    aspectratio: { x: 1, y: 1, z: 0.38 },
    camera: {
      eye: { x: 1.6, y: 1.6, z: 0.9 },
    },
  },
  font: { family: 'Inter, system-ui, sans-serif' },
}

const PLOTLY_CONFIG = {
  displayModeBar:  true,
  displaylogo:     false,
  modeBarButtonsToRemove: [
    'sendDataToCloud', 'select2d', 'lasso2d', 'toggleSpikelines',
  ],
  toImageButtonOptions: { format: 'png', filename: 'terrain', scale: 2 },
}

function renderPlot(z) {
  const trace = {
    type:        'surface',
    z,
    colorscale:  'Earth',
    contours: {
      z: {
        show:         true,
        usecolormap:  true,
        highlightcolor: '#6c5ce7',
        project:      { z: false },
      },
    },
    lighting: {
      ambient:    0.6,
      diffuse:    0.9,
      specular:   0.4,
      roughness:  0.5,
      fresnel:    0.4,
    },
    lightposition: { x: 1000, y: 1000, z: 2000 },
    showscale:  false,
  }

  if (!plotInited) {
    Plotly.newPlot(plotEl, [trace], PLOTLY_LAYOUT, PLOTLY_CONFIG)
    plotInited = true
  } else {
    Plotly.react(plotEl, [trace], PLOTLY_LAYOUT, PLOTLY_CONFIG)
  }
}

// ── Generate terrain ──────────────────────────────────────────────────────────
async function generate() {
  const params = getParams()
  lastParams   = params

  setLoading(true)
  setStatus('Generating terrain…', 'loading')

  // Yield to the event loop so the loading UI renders before the heavy compute
  await new Promise(r => setTimeout(r, 30))

  try {
    const result = await window.electronAPI.generateTerrain(params)

    if (!result.ok) {
      throw new Error(result.error || 'Unknown error')
    }

    const { z } = result.data

    emptyState.classList.add('hidden')
    renderPlot(z)

    exportBtn.disabled = false
    setStatus(`Generated ${params.width}×${params.length} terrain (seed ${params.seed})`, 'success')
  } catch (err) {
    setStatus(`Error: ${err.message}`, 'error')
    console.error(err)
  } finally {
    setLoading(false)
  }
}

// ── Export STL ────────────────────────────────────────────────────────────────
exportBtn.addEventListener('click', async () => {
  if (!lastParams) return
  exportBtn.disabled = true
  exportBtn.textContent = '⏳ Exporting…'
  setStatus('Exporting STL…', 'loading')

  try {
    const result = await window.electronAPI.exportStl(lastParams)

    if (result.canceled) {
      setStatus('Export cancelled', '')
    } else if (result.ok) {
      setStatus(`STL saved → ${result.filePath}`, 'success')
    } else {
      throw new Error(result.error || 'Export failed')
    }
  } catch (err) {
    setStatus(`Export error: ${err.message}`, 'error')
  } finally {
    exportBtn.disabled = false
    exportBtn.textContent = '⬇ Export STL'
  }
})

// ── Generate button ───────────────────────────────────────────────────────────
generateBtn.addEventListener('click', generate)

// ── Responsive plot resize ────────────────────────────────────────────────────
const resizeObserver = new ResizeObserver(() => {
  if (plotInited) Plotly.Plots.resize(plotEl)
})
resizeObserver.observe(plotEl)

// ── Auto-generate on load ─────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  generate()
})
