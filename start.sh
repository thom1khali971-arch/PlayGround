#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)}"
cd "$PROJECT_DIR"

PORT="${PORT:-3000}"
DIST="$PROJECT_DIR/dist"
SRC="$PROJECT_DIR/src"

timed() { /usr/bin/time -p "$@"; }

build_static=true
if [[ -f "$PROJECT_DIR/package.json" ]]; then
  if [[ -f "$PROJECT_DIR/package-lock.json" ]]; then
    timed npm ci --no-audit --no-fund
  else
    timed npm install --no-audit --no-fund
  fi
  if node -e 'const p=require("./package.json");process.exit(p.scripts&&p.scripts.build?0:1)'; then
    timed npm run build
    build_static=false
  fi
fi

if [[ "$build_static" == true ]]; then
  timed rm -rf "$DIST"
  timed mkdir -p "$DIST"
  if [[ -f "$SRC/index.html" ]]; then
    timed cp -a "$SRC/." "$DIST/"
  elif [[ -f "$PROJECT_DIR/index.html" ]]; then
    timed cp -a "$PROJECT_DIR/index.html" "$DIST/index.html"
  else
    echo "No static entry point: add src/index.html, index.html, or a package.json build script." >&2
    exit 1
  fi
fi

if [[ ! -f "$DIST/index.html" ]]; then
  echo "Build output is missing $DIST/index.html." >&2
  exit 1
fi

if [[ -n "${OPENCODE_WEB_DIR:-}" ]]; then
  timed mkdir -p "$OPENCODE_WEB_DIR"
  PROJECT_DIR="$PROJECT_DIR" DIST="$DIST" OPENCODE_WEB_DIR="$OPENCODE_WEB_DIR" \
    timed node -e 'const fs=require("node:fs"),path=require("node:path");const project=path.resolve(process.env.PROJECT_DIR);const directory=path.resolve(process.env.DIST);fs.writeFileSync(path.join(process.env.OPENCODE_WEB_DIR,"deployment-output.json"),JSON.stringify({project,directory}));'
fi

echo "Serving $DIST on http://0.0.0.0:$PORT"
exec /usr/bin/time -p python3 -m http.server "$PORT" --bind 0.0.0.0 --directory "$DIST"
