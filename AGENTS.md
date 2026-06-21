# 🤖 AI Agent Development Context

Welcome, AI Agent! This document provides the necessary context, architecture, and workflows to help you understand and contribute effectively to the `gists` repository.

## 📁 Repository Overview

This repository acts as a workspace housing two primary projects related to 3D terrain generation.

1. **`generate-terrain.py`**: A Python command-line utility for generating parameterized, pseudorandom 3D terrain maps.
2. **`generate-terrain-frontend`**: An Electron-based desktop application frontend.

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
├── generate-terrain-frontend/ # Electron GUI
│   ├── flake.nix            # Nix development shell environment
│   ├── package.json         # Node.js dependencies
│   ├── main.js              # Electron main process entry point
│   ├── preload.js           # Electron preload script
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

## 🖥️ Frontend: `generate-terrain-frontend`

A thin Electron desktop wrapper meant to interact with or provide a visual interface for the terrain generation.

### 📦 Environment & Dependencies (`Nix` + `npm`)
This directory utilizes a **Nix Flake** for a reproducible development environment.
- **Nix Shell**: The environment provisions Node.js and Electron natively. Run `nix develop` inside `generate-terrain-frontend/` to enter the shell.
- **npm**: Standard `package.json` setup.

### 🏃 Running the Frontend
```bash
cd generate-terrain-frontend
# Enter Nix dev shell (optional but recommended for environment consistency)
nix develop
# Install dependencies
npm install
# Start the Electron app
npm start
```

---

## 📜 Agent Guidelines & Rules

1. **Prefer `uv` for Python**: Always use `uv` for dependency manipulation and running Python scripts inside the backend directory. Avoid raw `pip` unless absolutely necessary.
2. **Nix Environment First**: When interacting with the Electron frontend, be aware that system-level Electron installations might conflict. Assume the Nix shell (`nix develop`) is the source of truth for standardizing Node/Electron binaries.
3. **CI/CD Awareness**: Remember that changes to the Python backend might affect the standalone binary builds happening via `.github/workflows/build.yml` and `scripts/`. Keep the build configurations up to date if you modify core file structures or `pyproject.toml` entry points.
4. **Maintain Aesthetics**: If modifying any front-end UI (`index.html`, etc.), strive for modern, dynamic, and premium web design aesthetics rather than plain, placeholder UI.
