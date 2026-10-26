#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-$(cd "$(dirname "$0")" && pwd)}"
WEB_DIR="${OPENCODE_WEB_DIR:-/home/runner/work/_temp/omgithub-web}"
PORT="${PORT:-3000}"
SOURCE_DIR="$PROJECT_DIR/web"
BUILD_DIR="$PROJECT_DIR/dist"

now_ms() {
  date +%s%3N
}

run() {
  local label="$1"
  shift
  local started
  started="$(now_ms)"
  echo "[start] ${label}: start"
  local status=0
  "$@" || status=$?
  local finished
  finished="$(now_ms)"
  echo "[start] ${label}: $((finished - started))ms (exit ${status})"
  return "$status"
}

cd "$PROJECT_DIR"

run "prepare worker metadata directory" mkdir -p "$WEB_DIR"

if [[ ! -f "$SOURCE_DIR/index.html" ]]; then
  echo "[start] missing static source entrypoint: $SOURCE_DIR/index.html" >&2
  exit 1
fi

run "clean build output" rm -rf "$BUILD_DIR"
run "create build output" mkdir -p "$BUILD_DIR"
run "copy static source" cp -R "$SOURCE_DIR/." "$BUILD_DIR/"

APK_PATH="$(find "$PROJECT_DIR" -maxdepth 1 -type f -name 'ChatBox-*.apk' | sort | head -n 1)"
if [[ -z "$APK_PATH" || ! -f "$APK_PATH" ]]; then
  echo "[start] missing updated ChatBox APK in $PROJECT_DIR" >&2
  exit 1
fi
run "copy updated APK" cp "$APK_PATH" "$BUILD_DIR/"

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
echo "[start] apk=$(basename "$APK_PATH")"
echo "[start] port=${PORT}"
echo "[start] serving on 0.0.0.0:${PORT}"

exec python3 -u -m http.server "$PORT" --bind 0.0.0.0 --directory "$BUILD_DIR"
