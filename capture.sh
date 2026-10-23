#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

: "${RUNTIME_DIR:?Set RUNTIME_DIR for capture tooling.}"
: "${CAPTURE_URL:?Set CAPTURE_URL.}"
: "${CAPTURE_DIR:?Set CAPTURE_DIR.}"

export CAPTURE_READY_SELECTOR="${CAPTURE_READY_SELECTOR:-#viewport canvas}"

/usr/bin/time -p mkdir -p "$CAPTURE_DIR"
/usr/bin/time -p node "$RUNTIME_DIR/scripts/default-capture.mjs"
