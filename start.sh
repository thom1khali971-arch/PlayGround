#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIST_DIR="$PROJECT_DIR/dist"
cd "$PROJECT_DIR"

: "${OPENCODE_WEB_DIR:?Set OPENCODE_WEB_DIR for worker metadata.}"
PORT="${PORT:-3000}"
export PORT

timed() {
  local label="$1"
  shift
  printf '[timing] %s\n' "$label" >&2
  /usr/bin/time -p "$@"
}

timed "create web metadata directory" mkdir -p "$OPENCODE_WEB_DIR"
timed "write deployment output" node -e '
  const fs = require("node:fs")
  fs.writeFileSync(process.argv[1], JSON.stringify({ project: process.argv[2], directory: process.argv[3] }))
' "$OPENCODE_WEB_DIR/deployment-output.json" "$PROJECT_DIR" "$DIST_DIR"

if [ ! -x "$PROJECT_DIR/node_modules/.bin/vite" ]; then
  if [ -f "$PROJECT_DIR/package-lock.json" ]; then
    timed "install dependencies" npm ci --no-audit --no-fund
  else
    timed "install dependencies" npm install --no-audit --no-fund
  fi
else
  printf '[timing] install dependencies: cached\n' >&2
fi

timed "build" npm run build

printf '[timing] serve on port %s\n' "$PORT" >&2
exec /usr/bin/time -p node "$PROJECT_DIR/node_modules/vite/bin/vite.js" preview \
  --host 0.0.0.0 --port "$PORT" --strictPort
