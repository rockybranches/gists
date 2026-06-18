#!/usr/bin/env sh

set -e

# run-pyinstaller.sh

. ./.venv/bin/activate

pyinstaller 
      --noconsole 
      --onefile 
      --collect-submodules scipy 
      /generate_terrain_py/gui.py
