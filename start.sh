#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

PROJECT_DIR="$(pwd)"
SOURCE_DIR="$PROJECT_DIR/android/assets"
DIST_DIR="$PROJECT_DIR/dist"
PORT="${PORT:-3000}"
export PORT

if [[ ! -f "$SOURCE_DIR/index.html" ]]; then
  echo "Missing static source at $SOURCE_DIR/index.html" >&2
  exit 1
fi

needs_build=false
if [[ ! -f "$DIST_DIR/index.html" ]]; then
  needs_build=true
elif [[ -n "$(find "$SOURCE_DIR" -type f -newer "$DIST_DIR/index.html" -print -quit)" ]]; then
  needs_build=true
fi

if [[ "$needs_build" == true ]]; then
  /usr/bin/time -p rm -rf "$DIST_DIR"
  /usr/bin/time -p mkdir -p "$DIST_DIR"
  /usr/bin/time -p cp -R "$SOURCE_DIR/." "$DIST_DIR/"
fi

if [[ ! -f "$DIST_DIR/index.html" ]]; then
  echo "Static build did not produce $DIST_DIR/index.html" >&2
  exit 1
fi

METADATA_DIR="${OPENCODE_WEB_DIR:-${RUNNER_TEMP:-/home/runner/work/_temp}/omgithub-web}"
/usr/bin/time -p mkdir -p "$METADATA_DIR"
/usr/bin/time -p node -e '
  const fs = require("node:fs");
  const [project, directory, output] = process.argv.slice(1);
  fs.writeFileSync(output, JSON.stringify({ project, directory }) + "\n");
' "$PROJECT_DIR" "$DIST_DIR" "$METADATA_DIR/deployment-output.json"

cd "$DIST_DIR"
OPENCODE_WEB_DIR= /usr/bin/time -p node "${RUNTIME_DIR:?}/scripts/default-start.mjs"
