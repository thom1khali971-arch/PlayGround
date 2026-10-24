#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

# Per-command timing helper. Timings are written to the startup log.
now_ms() {
  date +%s%3N
}

run() {
  local label="$1"
  shift
  local start
  start="$(now_ms)"
  echo "[start] ${label}: start"
  local status=0
  "$@" || status=$?
  local end
  end="$(now_ms)"
  echo "[start] ${label}: $((end - start))ms (exit ${status})"
  return "$status"
}

PROJECT_DIR="$(pwd)"
SOURCE_DIR="${PROJECT_DIR}/android/assets"
BUILD_DIR="${PROJECT_DIR}/dist"
WEB_DIR="${OPENCODE_WEB_DIR:-/home/runner/work/_temp/omgithub-web}"
PORT="${PORT:-3000}"
export PORT

if [[ ! -d "$SOURCE_DIR" ]]; then
  echo "[start] missing static source directory: $SOURCE_DIR" >&2
  exit 1
fi
if [[ ! -f "$SOURCE_DIR/index.html" ]]; then
  echo "[start] missing static source entrypoint: $SOURCE_DIR/index.html" >&2
  exit 1
fi

run "prepare worker metadata directory" mkdir -p "$WEB_DIR"
run "clean build directory" rm -rf "$BUILD_DIR"
run "create build directory" mkdir -p "$BUILD_DIR"

# Build step: the site is a prebuilt static bundle kept in android/assets.
run "copy static site" cp -R "$SOURCE_DIR/." "$BUILD_DIR/"

if [[ ! -f "$BUILD_DIR/index.html" ]]; then
  echo "[start] build did not produce $BUILD_DIR/index.html" >&2
  exit 1
fi

write_deployment_output() {
  printf '{"project":"%s","directory":"%s"}\n' "$PROJECT_DIR" "$BUILD_DIR" \
    > "${WEB_DIR}/deployment-output.json"
}
run "write deployment-output.json" write_deployment_output

echo "[start] project=${PROJECT_DIR}"
echo "[start] static=${BUILD_DIR}"
echo "[start] port=${PORT}"
echo "[start] serving on 0.0.0.0:${PORT}"

# Serve in the foreground; the runtime launcher keeps this process in tmux.
exec python3 -u -m http.server "$PORT" --bind 0.0.0.0 --directory "$BUILD_DIR"
