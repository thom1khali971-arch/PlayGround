#!/usr/bin/env bash
# Captures the deployed preview as desktop and mobile evidence.
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd -P)"
: "${CAPTURE_URL:?Set CAPTURE_URL to the exact preview URL.}"
: "${CAPTURE_DIR:?Set CAPTURE_DIR to an output directory outside the source.}"

case "$CAPTURE_URL" in
  http://*|https://*) ;;
  *) echo "CAPTURE_URL must be an http(s) URL, got: $CAPTURE_URL" >&2; exit 1 ;;
esac

timed() {
  printf '[capture] %s\n' "$*"
  /usr/bin/time -p "$@"
}

timed mkdir -p "$CAPTURE_DIR"
CAPTURE_DIR="$(cd "$CAPTURE_DIR" && pwd -P)"
export CAPTURE_URL CAPTURE_DIR

# Never leave a previous run's screenshots behind as false evidence.
timed rm -f "$CAPTURE_DIR/final-desktop.png" "$CAPTURE_DIR/final-mobile.png" "$CAPTURE_DIR/capture-result.json"

set +e
timed node "$PROJECT_DIR/scripts/capture.mjs"
status=$?
set -e

if [[ "$status" -ne 0 ]]; then
  [[ "$status" -eq 75 ]] || status=1
  echo "[capture] failed with exit $status" >&2
  exit "$status"
fi

echo "[capture] screenshots ready in $CAPTURE_DIR"
