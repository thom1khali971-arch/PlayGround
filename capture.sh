#!/usr/bin/env bash
set -euo pipefail

: "${CAPTURE_URL:?Set CAPTURE_URL to the exact page to capture.}"
: "${CAPTURE_DIR:?Set CAPTURE_DIR to the evidence directory.}"
: "${RUNTIME_DIR:?Set RUNTIME_DIR to the OMGithub runtime directory.}"

timed() { /usr/bin/time -p "$@"; }

timed mkdir -p "$CAPTURE_DIR"

export CAPTURE_URL CAPTURE_DIR
exec /usr/bin/time -p node "$RUNTIME_DIR/scripts/default-capture.mjs"
