#!/usr/bin/env bash
# Captura: abrir a CAPTURE_URL exata no próprio navegador, aguardar a renderização,
# salvar as visualizações desktop e mobile como final-desktop.png / final-mobile.png em CAPTURE_DIR.
# Saída 75 = erro temporário de navegação/navegador, saída 1 = erro de script/renderização.
# O app continua em execução; a saída fica fora dos sources.
set -euo pipefail
cd "$(dirname "$0")"

: "${CAPTURE_URL:?Set CAPTURE_URL.}"
: "${CAPTURE_DIR:?Set CAPTURE_DIR.}"
RUNTIME_DIR="${RUNTIME_DIR:-${RUNNER_TEMP:-/home/runner/work/_temp}/omgithub-runtime}"

/usr/bin/time -p mkdir -p "$CAPTURE_DIR"
/usr/bin/time -p bash -c 'case "$CAPTURE_DIR" in "$PWD"/*) echo "CAPTURE_DIR deve ficar fora do projeto: $CAPTURE_DIR" >&2; exit 1;; esac'
/usr/bin/time -p node "$RUNTIME_DIR/scripts/default-capture.mjs"
/usr/bin/time -p test -s "$CAPTURE_DIR/final-desktop.png"
/usr/bin/time -p test -s "$CAPTURE_DIR/final-mobile.png"
/usr/bin/time -p ls -la "$CAPTURE_DIR"
echo "Captura OK: $CAPTURE_DIR/final-desktop.png + final-mobile.png de $CAPTURE_URL"
