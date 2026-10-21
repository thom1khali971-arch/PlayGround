#!/usr/bin/env bash
# Capture: exakte CAPTURE_URL im eigenen Browser oeffnen, auf Rendering warten,
# Desktop- und Mobilansicht als final-desktop.png / final-mobile.png in CAPTURE_DIR speichern.
# Exit 75 = temporaere Navigation-/Browser-Infrastrukturfehler, Exit 1 = Skript-/Renderingfehler.
# App bleibt laufen; Ausgabe liegt ausserhalb des Sources.
set -euo pipefail
cd "$(dirname "$0")"

: "${CAPTURE_URL:?Set CAPTURE_URL.}"
: "${CAPTURE_DIR:?Set CAPTURE_DIR.}"
: "${RUNTIME_DIR:?Set RUNTIME_DIR.}"

/usr/bin/time -p mkdir -p "$CAPTURE_DIR"
/usr/bin/time -p bash -c 'case "$CAPTURE_DIR" in "$PWD"/*) echo "CAPTURE_DIR muss ausserhalb des Projekts liegen: $CAPTURE_DIR" >&2; exit 1;; esac'
/usr/bin/time -p node "$RUNTIME_DIR/scripts/default-capture.mjs"
/usr/bin/time -p test -s "$CAPTURE_DIR/final-desktop.png"
/usr/bin/time -p test -s "$CAPTURE_DIR/final-mobile.png"
/usr/bin/time -p ls -la "$CAPTURE_DIR"
echo "Capture OK: $CAPTURE_DIR/final-desktop.png + final-mobile.png von $CAPTURE_URL"
