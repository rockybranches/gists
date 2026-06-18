#!/usr/bin/env sh

# build-windows-binary.sh

set -e

echo "🐳 Step 1: Generating local compilation container blueprint..."
docker build -t terrain-win-builder -f Dockerfile.build .

echo "🔀 Step 2: Launching sandbox environment container..."
# Mounts your local folder path directly to the isolated container internal storage
docker run --rm -v "$(pwd):/workspace" terrain-win-builder /bin/bash -c "
    echo '🐍 Initializing isolated project workspace via uv...'
    uv venv --platform windows
    
    echo '📦 Provisioning targeted Windows packages...'
    # Force uv to explicitly resolve Windows-compiled wheels (.whl) instead of Linux packages
    uv pip install --platform windows pyqt6 numpy scipy pyinstaller
    
    echo '🏗️ Compiling PyQt6 App with hidden submodules into Windows EXE...'
    # Run the Windows compiled PyInstaller inside the Wine virtualization shell
    wine .venv/Scripts/pyinstaller.exe --noconsole --onefile --collect-submodules scipy gui.py
"

echo "✨ Success! Your cross-compiled bundle is available in: $(pwd)/dist/gui.exe"
