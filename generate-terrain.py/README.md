# 🗺️ Parametric 3D Terrain Generator CLI

A self-contained Python command-line utility to generate parameterized, pseudorandom 3D terrain maps. The tool supports exporting to fully solid **STL files** (manifold and ready for 3D printing), previewing directly inside your terminal, or hosting an interactive, hardware-accelerated 3D plot over local HTTP.

Built with performance and simplicity in mind, this project uses **`uv`** for frictionless workspace and dependency management.

## 🚀 Features

- **Procedural Generation**: Uses layered, multi-octave noise interpolation to build realistic rolling hills, jagged peaks, or flat plateaus.
- **3D Printable Output**: Generates closed manifold meshes with a flat bottom base and clean side walls, ready to drop straight into any 3D printer slicer.
- **Terminal Previews**: Includes a quick, text-based ASCII topographic visualization that scales to fit your terminal window.
- **Interactive Terminal Viewer**: Features a real-time, wireframe 3D orthographic projection viewer that lets you rotate and tilt the landscape using keyboard controls.
- **Web-Based Interactive 3D Plot**: Spins up a lightweight, background local HTTP server hosting an interactive, smooth Plotly 3D surface map.

---

## 🛠️ Installation & Quick Start

Because this project supports `uv`, you don't even need to manually activate a virtual environment. `uv` handles isolated environment provisioning seamlessly on the fly.

Ensure you have [`uv`](https://github.com) installed, then choose one of the options below:

### Option A: Run Instantly (No Setup Required)
You can execute the script along with its required environments directly in a single command line wrapper:
```bash
uv run --with click --with numpy --with scipy --with plotly generate_terrain.py [OPTIONS]
```

### Option B: Local Project Initialization
If you want to manage the dependencies locally for development:
```bash
# Initialize a uv project structure (if starting clean)
uv init

# Add required dependencies to the project
uv add click numpy scipy plotly
```

Once added, you can run your application simply using:
```bash
uv run generate_terrain.py [OPTIONS]
```

---

## 🎮 Usage Guide

Run the script using `uv run`. By default, it generates a `terrain.stl` file in your current working directory.

### 📋 Available CLI Options

| Flag | Short | Default | Description |
| :--- | :--- | :--- | :--- |
| `--width` | | `100` | Grid resolution along the X-axis. |
| `--length` | | `100` | Grid resolution along the Y-axis. |
| `--height-scale`| | `20.0` | Vertical multiplier determining peak-to-valley height. |
| `--base-height` | | `5.0` | Thickness of the flat solid floor underneath the landscape. |
| `--scale` | | `50.0` | Horizontal feature scale (larger values make smoother plains). |
| `--octaves` | | `4` | Number of stacked noise layers (adds erosion/roughness). |
| `--roughness` | | `0.5` | Intensity weight of secondary high-detail octaves. |
| `--seed` | | `42` | Random seed integer for landscape reproducibility. |
| `--output` | `-o` | `terrain.stl`| Output filename for your binary STL model. |
| `--visualize` | `-v` | *None* | Toggles a static ASCII character printout map. |
| `--interactive`| `-i` | *None* | Launches real-time terminal wireframe rotation view. |
| `--serve` | `-s` | *None* | Spawns a local HTTP server and opens a 3D web plot. |

---

## 💡 Code Examples

### 1. Simple 3D Print Export
Generate a detailed 150x150 terrain grid with custom mountain peaks and export it as an STL:
```bash
uv run generate_terrain.py --width 150 --length 150 --height-scale 35.0 --output rocky_mountains.stl
```

### 2. Static Terminal Preview
Verify how the seed texture and horizontal scale look without leaving your terminal shell:
```bash
uv run generate_terrain.py --scale 30.0 --seed 8812 --visualize
```

### 3. Interactive Terminal 3D Wireframe
Launch a real-time, non-blocking viewport loop inside your bash console:
```bash
uv run generate_terrain.py --interactive
```
* **Controls**: Type `W` / `S` to tilt up/down, `A` / `D` to spin left/right, and press `Enter` to apply. Type `Q` and hit `Enter` to close the viewer.

### 4. Serve Interactive Browser Plot
Generate the mesh, host it locally over HTTP, and immediately open your native browser to spin, pan, and inspect the landscape smoothly:
```bash
uv run generate_terrain.py --serve
```
* Close the server safely by pressing `Ctrl + C` in your terminal shell.

---

## 🛠️ Modifying parameters

- **Want jagged peaks?** Increase `--octaves` to `6` or `7`, and bump `--roughness` to `0.65`.
- **Want rolling sand dunes?** Lower `--octaves` to `2` and bump the `--scale` up to `80.0`.
- **Need it to print faster?** Lower `--height-scale` or reduce the `--base-height` to save 3D printing filament.
