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

// ── Geochemistry DOM references ───────────────────────────────────────────────
const geochemBtn     = document.getElementById('geochem-btn')
const exportCsvBtn   = document.getElementById('export-csv-btn')
const elementSelect  = document.getElementById('geochem-element')
const geochemSection = document.getElementById('geochem-section')

// ── State ─────────────────────────────────────────────────────────────────────
let lastParams    = null
let lastZ         = null
let geochemData   = null
let currentElement = ''
let plotInited    = false

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
    geochemBtn.disabled = true
    exportCsvBtn.disabled = true
  } else {
    loadingOverlay.classList.remove('active')
    generateBtn.disabled = false
    generateBtn.textContent = '⛰ Generate Terrain'
    geochemBtn.disabled = false
    exportCsvBtn.disabled = !geochemData
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

const GEO_CHEM_SCALE = [
  [0,    '#1a0a3e'],
  [0.25, '#4a1a6b'],
  [0.5,  '#c44d34'],
  [0.75, '#e8a838'],
  [1,    '#fce8a8'],
]

function renderPlot(z, surfacecolor, colorLabel) {
  const trace = {
    type:        'surface',
    z,
    colorscale:  surfacecolor ? GEO_CHEM_SCALE : 'Earth',
    contours: {
      z: {
        show:         !surfacecolor,
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
    showscale:  !!surfacecolor,
    colorbar: surfacecolor ? {
      title: { text: colorLabel || '', font: { color: '#9ba3c5', size: 10 } },
      tickfont: { color: '#6b7299', size: 9 },
      bgcolor: 'rgba(15,20,32,0.85)',
      bordercolor: '#252d45',
      borderwidth: 1,
    } : undefined,
  }

  if (surfacecolor) trace.surfacecolor = surfacecolor

  const layout = { ...PLOTLY_LAYOUT }
  if (surfacecolor) {
    layout.scene = { ...layout.scene }
    layout.scene.zaxis = { ...layout.scene.zaxis, title: colorLabel || 'Concentration' }
  }

  if (!plotInited) {
    Plotly.newPlot(plotEl, [trace], layout, PLOTLY_CONFIG)
    plotInited = true
  } else {
    Plotly.react(plotEl, [trace], layout, PLOTLY_CONFIG)
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
    lastZ = z

    emptyState.classList.add('hidden')

    // Re-apply geochem surfacecolor if an element is selected
    if (geochemData && currentElement && geochemData.elementGrids[currentElement]) {
      const elemDef = geochemData.elements.find(e => e.name === currentElement)
      renderPlot(z, geochemData.elementGrids[currentElement], `${elemDef.label} (${elemDef.units})`)
    } else {
      renderPlot(z)
    }

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

// ── Generate Geochemistry ─────────────────────────────────────────────────────
async function generateGeochemistry() {
  if (!lastParams) return
  setLoading(true)
  setStatus('Generating geochemistry…', 'loading')

  await new Promise(r => setTimeout(r, 30))

  try {
    const params = { ...lastParams }
    const result = await window.electronAPI.generateGeochemistry(params)

    if (!result.ok) {
      throw new Error(result.error || 'Unknown error')
    }

    geochemData = result.data
    geochemSection.classList.remove('hidden')
    // Enable the CSV export button immediately
    exportCsvBtn.disabled = false

    // Select the first element and color the terrain
    currentElement = geochemData.elements[0].name
    elementSelect.value = currentElement
    const elemDef = geochemData.elements[0]
    renderPlot(lastZ, geochemData.elementGrids[currentElement], `${elemDef.label} (${elemDef.units})`)

    setStatus(`Geochemistry generated — ${geochemData.elements.length} elements`, 'success')
  } catch (err) {
    setStatus(`Error: ${err.message}`, 'error')
    console.error(err)
  } finally {
      console.log("Enabling geochem (setup completed successfully)...");
      geochemBtn.disabled = false
      setLoading(false)
  }
}

geochemBtn.addEventListener('click', generateGeochemistry)

// ── Element selector ──────────────────────────────────────────────────────────
elementSelect.addEventListener('change', () => {
  const el = elementSelect.value
  currentElement = el
  if (!el || !geochemData || !lastZ) {
    renderPlot(lastZ)
    exportCsvBtn.disabled = !geochemData
    return
  }
  const grid = geochemData.elementGrids[el]
  if (!grid) return
  const elemDef = geochemData.elements.find(e => e.name === el)
  renderPlot(lastZ, grid, `${elemDef.label} (${elemDef.units})`)
  exportCsvBtn.disabled = false
})

// ── Export Geochemistry CSV ────────────────────────────────────────────────────
exportCsvBtn.addEventListener('click', async () => {
  if (!lastParams || !geochemData) return
  exportCsvBtn.disabled = true
  exportCsvBtn.textContent = '⏳ Exporting…'
  setStatus('Exporting CSV…', 'loading')

  try {
    const result = await window.electronAPI.exportGeochemistryCsv(lastParams)

    if (result.canceled) {
      setStatus('Export cancelled', '')
    } else if (result.ok) {
      setStatus(`CSV saved → ${result.filePath}`, 'success')
    } else {
      throw new Error(result.error || 'Export failed')
    }
  } catch (err) {
    setStatus(`Export error: ${err.message}`, 'error')
  } finally {
    exportCsvBtn.disabled = false
    exportCsvBtn.textContent = '⬇ Export CSV'
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
