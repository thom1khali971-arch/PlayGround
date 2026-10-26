#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
PROJECT_DIR="$(cd "$PROJECT_DIR" && pwd -P)"
cd "$PROJECT_DIR"

PORT="${PORT:-3000}"
export PORT

WEB_DIR="${OPENCODE_WEB_DIR:-/home/runner/work/_temp/omgithub-web}"
STATIC_DIR="$PROJECT_DIR/dist"

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

install_dependencies() {
  [[ -f "$PROJECT_DIR/package.json" ]] || return 0
  [[ -d "$PROJECT_DIR/node_modules" ]] && return 0
  if [[ -f "$PROJECT_DIR/package-lock.json" ]]; then
    npm ci --no-audit --no-fund
  else
    npm install --no-audit --no-fund
  fi
}

has_build_script() {
  [[ -f "$PROJECT_DIR/package.json" ]] || return 1
  node --input-type=commonjs -e \
    'const p = require(process.argv[1]); process.exit(p.scripts && p.scripts.build ? 0 : 1)' \
    "$PROJECT_DIR/package.json"
}

build_app() {
  if [[ -f "$PROJECT_DIR/package.json" ]] && has_build_script; then
    npm run build
    local candidate
    for candidate in dist build out; do
      if [[ -f "$PROJECT_DIR/$candidate/index.html" ]]; then
        STATIC_DIR="$PROJECT_DIR/$candidate"
        return 0
      fi
    done
  fi

  if [[ -f "$PROJECT_DIR/src/index.html" ]]; then
    rm -rf "$PROJECT_DIR/dist"
    mkdir -p "$PROJECT_DIR/dist"
    cp -R "$PROJECT_DIR/src/." "$PROJECT_DIR/dist/"
  elif [[ -f "$PROJECT_DIR/index.html" ]]; then
    rm -rf "$PROJECT_DIR/dist"
    mkdir -p "$PROJECT_DIR/dist"
    cp "$PROJECT_DIR/index.html" "$PROJECT_DIR/dist/index.html"
    local directory
    for directory in assets public static; do
      [[ -d "$PROJECT_DIR/$directory" ]] && cp -R "$PROJECT_DIR/$directory" "$PROJECT_DIR/dist/"
    done
  else
    echo "No buildable web app found. Add src/index.html, index.html, or a package build script." >&2
    return 1
  fi

  STATIC_DIR="$PROJECT_DIR/dist"
  [[ -f "$STATIC_DIR/index.html" ]] || {
    echo "Build output is missing index.html in $STATIC_DIR" >&2
    return 1
  }
}

write_deployment_metadata() {
  mkdir -p "$WEB_DIR"
  node --input-type=commonjs -e '
    const { writeFileSync } = require("node:fs")
    const [project, directory, output] = process.argv.slice(1)
    writeFileSync(output, JSON.stringify({ project, directory }))
  ' "$PROJECT_DIR" "$STATIC_DIR" "$WEB_DIR/deployment-output.json"
}

timed "install dependencies" install_dependencies
timed "build application" build_app

STATIC_DIR="$(cd "$STATIC_DIR" && pwd -P)"
case "$STATIC_DIR/" in
  "$PROJECT_DIR/"*) ;;
  *)
    echo "Static output must stay inside PROJECT_DIR: $STATIC_DIR" >&2
    exit 1
    ;;
esac

timed "write deployment metadata" write_deployment_metadata
echo "Deployment output: $STATIC_DIR" >&2
timed "serve static application" node "$PROJECT_DIR/scripts/serve-static.mjs" "$STATIC_DIR"
