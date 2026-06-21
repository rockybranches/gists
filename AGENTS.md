# 🤖 AI Agent Development Context

Welcome, AI Agent! This document provides the necessary context, architecture, and workflows to help you understand and contribute effectively to the `gists` repository.

## 📁 Repository Overview

This repository acts as a workspace housing two primary projects related to 3D terrain generation.

1. **`generate-terrain.py`**: A Python command-line utility for generating parameterized, pseudorandom 3D terrain maps.
2. **`generate-terrain-app`**: An Electron-based desktop application frontend.

### 🏗️ Directory Structure

```text
/
├── .github/workflows/       # CI/CD pipelines (e.g., build.yml for standalone binaries)
├── generate-terrain.py/     # Python CLI / Core generation logic
│   ├── generate_terrain_py/ # Python package source code
│   ├── scripts/             # Build scripts (Linux, Windows binaries)
│   ├── pyproject.toml       # Python dependencies and project settings
│   ├── index.html           # Large standalone HTML file (possibly for Plotly web view)
│   └── README.md            # Backend specific documentation
├── generate-terrain-app/      # Standalone Electron GUI (no Python dependency)
│   ├── src/
│   │   └── terrain.ts       # TypeScript terrain engine (heightmap, mesh, STL)
│   ├── dist/                # Compiled JS output (gitignored, built via tsc)
│   ├── flake.nix            # Nix development shell environment
│   ├── tsconfig.json        # TypeScript compiler config
│   ├── package.json         # Node.js dependencies + build scripts
│   ├── main.js              # Electron main process entry point
│   ├── preload.js           # Electron preload script (IPC bridge)
│   ├── renderer.js          # Plotly 3D surface rendering + UI
│   └── index.html           # Electron renderer HTML
└── pyproject.toml           # Root workspace config for uv
```

---

## 🐍 Backend: `generate-terrain.py`

The core of the project is a Python tool that generates 3D terrain using layered noise interpolation. It supports:
- Outputting to manifold **STL** files for 3D printing.
- Terminal-based ASCII previews.
- Real-time terminal wireframe 3D orthographic projection viewers.
- Lightweight HTTP server hosting an interactive Plotly 3D surface map.

### 📦 Dependency Management (`uv`)
The project uses **`uv`** as its primary Python package and environment manager.
- No manual virtual environment activation is typically needed (`uv run` handles it).
- Configuration is found in `generate-terrain.py/pyproject.toml`.
- Dependencies include `click`, `numpy`, `plotly`, and `scipy`.
- GUI dependencies (`pyqt6`) and dev dependencies (`pyinstaller`) are specified in dependency groups.

### 🏃 Running the CLI
Execute the script using the `uv run` wrapper:
```bash
# General format
uv run generate-terrain [OPTIONS]

# Example: Generate STL
uv run generate-terrain --width 150 --length 150 --height-scale 35.0 --output rocky_mountains.stl

# Example: Serve interactive Plotly 3D plot
uv run generate-terrain --serve
```

### 🛠️ Building Binaries
The backend provides standalone executable builds for both Linux and Windows. 
- Build scripts are located in `generate-terrain.py/scripts/`.
- CI automation for building and uploading these binaries as artifacts is defined in `.github/workflows/build.yml`.
- Windows builds are achieved via a Docker container (`Dockerfile.win64`).

---

## 🖥️ Frontend: `generate-terrain-app`

A **fully standalone** Electron desktop application. All terrain generation logic is implemented in TypeScript (`src/terrain.ts`) — **no Python backend is required**.

### 🧠 TypeScript Terrain Engine (`src/terrain.ts`)
A faithful TypeScript port of the Python backend algorithms:
- **Seeded PRNG** (Mulberry32) — deterministic, replaces `np.random.seed`
- **Bilinear upsampling** — replaces `scipy.ndimage.zoom`
- **Octave FBM noise** — layered random grids, normalised 0→1
- **Closed manifold mesh** — top surface, base slab, and side walls
- **Binary STL writer** — in-memory `Buffer`, saved via Electron's `dialog.showSaveDialog`

The compiled output (`dist/terrain.js`) is loaded directly in the Electron main process via `require('./dist/terrain')`. Terrain data is returned to the renderer via IPC as a plain JS array; [Plotly.js](https://plotly.com/javascript/) (CDN) renders the interactive 3D surface in-page — no webview, no HTTP server.

### 📦 Environment & Dependencies (`Nix` + `npm`)
This directory utilizes a **Nix Flake** for a reproducible development environment.
- **Nix Shell**: The environment provisions Node.js and Electron natively. Run `nix develop` inside `generate-terrain-app/` to enter the shell.
- **npm**: Standard `package.json` setup. Dev dependencies: `electron`, `typescript`, `@types/node`.

### 🏃 Running the App
```bash
cd generate-terrain-app
# Enter Nix dev shell (optional but recommended for environment consistency)
nix develop
# Install dependencies
npm install
# Compile TypeScript + launch Electron
npm start
```

### 📜 npm Scripts
| Script | Description |
|---|---|
| `npm start` | Compile TypeScript then launch Electron |
| `npm run build` | Compile TypeScript only (`tsc`) |
| `npm run build:watch` | Watch mode recompilation |
| `npm run dev` | Alias for `npm start` |

---

## 📜 Agent Guidelines & Rules

1. **Prefer `uv` for Python**: Always use `uv` for dependency manipulation and running Python scripts inside the backend directory. Avoid raw `pip` unless absolutely necessary.
2. **Nix Environment First**: When interacting with the Electron frontend, be aware that system-level Electron installations might conflict. Assume the Nix shell (`nix develop`) is the source of truth for standardizing Node/Electron binaries.
3. **Always compile TypeScript**: The Electron app requires `npm run build` (or `npm start` which does it automatically) before launch. Never modify `dist/` files directly — edit `src/terrain.ts` and recompile.
4. **CI/CD Awareness**: Remember that changes to the Python backend might affect the standalone binary builds happening via `.github/workflows/build.yml` and `scripts/`. Keep the build configurations up to date if you modify core file structures or `pyproject.toml` entry points.
5. **Maintain Aesthetics**: If modifying any front-end UI (`index.html`, `renderer.js`, etc.), strive for modern, dynamic, and premium web design aesthetics rather than plain, placeholder UI.
6. **App Independence**: `generate-terrain-app` must remain fully independent of `generate-terrain.py`. Do not re-introduce any `child_process.spawn` calls that invoke `uv` or Python. All terrain logic must live in `src/terrain.ts`.
