#!/usr/bin/env sh

# build-windows-binary.sh

set -e

docker run \
  --volume "$(pwd):/src/" \
  batonogov/pyinstaller-windows:latest
