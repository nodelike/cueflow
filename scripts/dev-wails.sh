#!/bin/sh
set -eu

echo "Cueflow debug host: Wails desktop + Vite HMR"
exec "${WAILS:-wails}" dev \
  -nogorebuild \
  -skipbindings \
  -m \
  -loglevel Debug \
  -debounce 150
