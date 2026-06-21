# generate-terrain-app

An Electron desktop application that provides a graphical interface for the [`generate-terrain.py`](../generate-terrain.py/README.md) backend. Adjust terrain parameters via a sidebar of sliders, hit **Generate**, and view an interactive Plotly 3D surface map — all without touching the command line.

---

## Features

- **Live parameter controls** — sliders for Width, Length, Height Scale, Feature Scale, Octaves, and Roughness, plus a numeric Seed input
- **One-click generation** — spawns the `generate-terrain` backend via `uv run` and waits for its HTTP server to come up
- **Embedded 3D viewer** — renders the interactive Plotly surface directly inside the app via an Electron `<webview>`
- **Status bar** — real-time feedback (generating, ready, or error)
- **Auto-start** — a default terrain (100×100, seed 42) is generated on launch so the viewer is never empty

---

## Prerequisites

| Requirement | Notes |
|---|---|
| **Node.js** | v18+ recommended. Provided by the Nix dev shell. |
| **Electron** | v41. Installed as a dev dependency via `npm`, or provided by Nix. |
| **`generate-terrain.py` backend** | Must be present at `../generate-terrain.py/` relative to this directory. `uv` must be on `$PATH`. |

---

## Getting Started

### 1. Clone the repo (if you haven't already)

```bash
git clone <repo-url>
cd gists/generate-terrain-app
```

### 2. Install Node dependencies

```bash
npm install
```

### 3. Start the app

```bash
npm start
```

The app will launch, immediately spin up the backend with default parameters, and display the terrain once it's ready.

---

## Development Environment (Nix)

A `flake.nix` is included to provide a fully reproducible development shell with pinned versions of Node.js and Electron.

```bash
# Enter the Nix dev shell
nix develop

# Then run as normal
npm install
npm start
```

The shell hook sets `ELECTRON_OVERRIDE_DIST_PATH` so that the Nix-managed Electron binary is used instead of the one installed by npm, avoiding version mismatches on NixOS or Nix-managed systems.

> **Note:** `nix develop` requires Nix with flakes enabled (`experimental-features = nix-command flakes` in your Nix config).

---

## Available Scripts

| Script | Command | Description |
|---|---|---|
| `start` | `electron .` | Launch the Electron app directly |
| `start:nix` | `nix develop --command npm start` | Enter the Nix shell, then launch |

---

## Project Structure

```
generate-terrain-app/
├── flake.nix          # Nix flake for reproducible dev shell
├── flake.lock         # Pinned Nix dependency lockfile
├── package.json       # Node.js dependencies and scripts
├── main.js            # Electron main process — window creation & backend lifecycle
├── preload.js         # Context bridge exposing IPC APIs to the renderer
├── renderer.js        # Renderer logic — UI state, parameter collection, IPC calls
└── index.html         # App shell — sidebar controls & webview layout
```

### Architecture

```
┌─────────────────────────────────────────┐
│  Electron Main Process (main.js)        │
│  - Creates BrowserWindow                │
│  - Spawns `uv run generate-terrain -s`  │
│  - Detects backend ready on port 8090   │
│  - Relays IPC events to renderer        │
└───────────┬─────────────────────────────┘
            │ IPC (contextBridge)
┌───────────▼─────────────────────────────┐
│  Renderer Process (renderer.js)         │
│  - Reads slider/input values            │
│  - Calls `electronAPI.generateTerrain`  │
│  - Loads backend URL into <webview>     │
└───────────┬─────────────────────────────┘
            │ http://localhost:8090
┌───────────▼─────────────────────────────┐
│  Backend (generate-terrain.py)          │
│  - Plotly HTTP server                   │
│  - Interactive 3D surface map           │
└─────────────────────────────────────────┘
```

---

## Terrain Parameters

| Parameter | Range | Default | Description |
|---|---|---|---|
| **Width** | 20 – 300 | 100 | Number of grid points along the X axis |
| **Length** | 20 – 300 | 100 | Number of grid points along the Y axis |
| **Height Scale** | 1 – 100 | 20 | Vertical exaggeration of the terrain |
| **Feature Scale** | 5 – 200 | 50 | Horizontal frequency of terrain features |
| **Octaves** | 1 – 10 | 4 | Noise layers; higher = more detail |
| **Roughness** | 0.1 – 1.0 | 0.5 | Persistence of each noise octave |
| **Seed** | 0 – 999999 | 42 | Random seed for reproducible terrain |

---

## Troubleshooting

**The terrain viewer stays blank / shows "Generate terrain to visualize"**

- Ensure the `generate-terrain.py` backend directory exists at `../generate-terrain.py/`.
- Confirm `uv` is installed and available on your `$PATH` (`which uv`).
- Check the status bar at the bottom of the sidebar for error messages.

**`electron` not found when running `npm start`**

- Run `npm install` first, or use the Nix dev shell (`nix develop`) which provides Electron via Nixpkgs.

**Port 8090 already in use**

- The backend binds to `localhost:8090`. Stop any other process using that port before launching.
