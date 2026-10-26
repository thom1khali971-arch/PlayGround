#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
RUNTIME_DIR="${RUNTIME_DIR:-/home/runner/work/_temp/omgithub-runtime}"

if [[ -z "${CAPTURE_URL:-}" ]]; then
  echo "CAPTURE_URL is required." >&2
  exit 1
fi
if [[ -z "${CAPTURE_DIR:-}" ]]; then
  echo "CAPTURE_DIR is required." >&2
  exit 1
fi

export CAPTURE_URL CAPTURE_DIR

timed() {
  local label="$1"
  shift
  local started ended status
  started=$(date +%s%N)
  set +e
  "$@"
  status=$?
  set -e
  ended=$(date +%s%N)
  printf '[timing] %-32s %6d ms (exit %d)\n' "$label" "$(((ended - started) / 1000000))" "$status" >&2
  return "$status"
}

project_real="$(realpath -m "$PROJECT_DIR")"
capture_real="$(realpath -m "$CAPTURE_DIR")"
case "$capture_real/" in
  "$project_real/"*)
    echo "CAPTURE_DIR must be outside the project source: $capture_real" >&2
    exit 1
    ;;
esac

prepare_capture_dir() {
  mkdir -p "$CAPTURE_DIR"
  rm -f "$CAPTURE_DIR/final-desktop.png" "$CAPTURE_DIR/final-mobile.png"
}

capture_views() {
  local script="$RUNTIME_DIR/scripts/default-capture.mjs"
  [[ -f "$script" ]] || {
    echo "Capture runtime not found: $script" >&2
    return 1
  }
  node "$script"
}

verify_captures() {
  local name file size
  for name in desktop mobile; do
    file="$CAPTURE_DIR/final-$name.png"
    [[ -f "$file" ]] || {
      echo "Missing capture: $file" >&2
      return 1
    }
    size=$(stat -c%s "$file")
    [[ "$size" -gt 1024 ]] || {
      echo "Capture looks empty: $file ($size bytes)" >&2
      return 1
    }
  done
}

timed "prepare capture directory" prepare_capture_dir
timed "capture desktop and mobile" capture_views
timed "verify capture output" verify_captures
echo "Captures written to $CAPTURE_DIR" >&2
