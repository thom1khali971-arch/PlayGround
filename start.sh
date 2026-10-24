#!/usr/bin/env bash
# Build the static app bundled in the APK and serve it on PORT (default 3000).
set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-$(cd "$(dirname "$0")" && pwd)}"
WEB_DIR="${OPENCODE_WEB_DIR:-/home/runner/work/_temp/omgithub-web}"
DIST_DIR="$PROJECT_DIR/dist"
BUILD_DIR="$PROJECT_DIR/.build"
STAGE_DIR="$BUILD_DIR/apk-assets"
PORT="${PORT:-3000}"

cd "$PROJECT_DIR"

/usr/bin/time -p printf 'Project: %s\n' "$PROJECT_DIR"
/usr/bin/time -p printf 'Static output: %s\n' "$DIST_DIR"
/usr/bin/time -p printf 'Port: %s\n' "$PORT"

if [[ ! -d "$BUILD_DIR" ]]; then
  /usr/bin/time -p mkdir -p "$BUILD_DIR"
fi

# Install package dependencies only when this project actually has a package.
if [[ -f "$PROJECT_DIR/package.json" ]]; then
  if [[ -f "$PROJECT_DIR/package-lock.json" ]]; then
    /usr/bin/time -p npm ci --no-audit --no-fund
  else
    /usr/bin/time -p npm install --no-audit --no-fund
  fi
fi

apks=("$PROJECT_DIR"/*.apk)
if [[ ! -e "${apks[0]}" ]]; then
  echo 'No APK source found in the project directory.' >&2
  exit 1
fi
APK_PATH="${apks[0]}"
/usr/bin/time -p printf 'APK source: %s\n' "$APK_PATH"

SOURCE_HASH="$(/usr/bin/time -p sha256sum "$APK_PATH" | awk '{print $1}')"
CURRENT_HASH=""
if [[ -f "$DIST_DIR/.source-sha256" ]]; then
  CURRENT_HASH="$(/usr/bin/time -p cat "$DIST_DIR/.source-sha256")"
fi

if [[ ! -f "$DIST_DIR/index.html" || "$CURRENT_HASH" != "$SOURCE_HASH" ]]; then
  /usr/bin/time -p rm -rf "$DIST_DIR"
  /usr/bin/time -p mkdir -p "$DIST_DIR"
  /usr/bin/time -p rm -rf "$STAGE_DIR"
  /usr/bin/time -p mkdir -p "$STAGE_DIR"
  /usr/bin/time -p unzip -q -o "$APK_PATH" 'assets/*' -d "$STAGE_DIR"
  /usr/bin/time -p cp -R "$STAGE_DIR/assets/." "$DIST_DIR/"
  /usr/bin/time -p rm -rf "$BUILD_DIR"
  /usr/bin/time -p printf '%s\n' "$SOURCE_HASH" > "$DIST_DIR/.source-sha256"
else
  /usr/bin/time -p printf 'Static build is up to date; skipping extraction.\n'
fi

if [[ ! -f "$DIST_DIR/index.html" ]]; then
  echo 'Build failed: static output has no index.html.' >&2
  exit 1
fi

/usr/bin/time -p mkdir -p "$WEB_DIR"
/usr/bin/time -p printf '{"project":"%s","directory":"%s"}\n' "$PROJECT_DIR" "$DIST_DIR" \
  > "$WEB_DIR/deployment-output.json"
/usr/bin/time -p cat "$WEB_DIR/deployment-output.json"

echo "Serving $DIST_DIR on http://0.0.0.0:$PORT"
exec /usr/bin/time -p python3 -m http.server "$PORT" --bind 0.0.0.0 --directory "$DIST_DIR"
