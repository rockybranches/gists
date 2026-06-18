#!/usr/bin/env sh

# build-standalone-binary.sh

uv run \
   pyinstaller \
   --noconsole \
   --onefile \
   --collect-submodules scipy \
   generate_terrain_py/gui.py
