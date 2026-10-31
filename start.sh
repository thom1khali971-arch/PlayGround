#!/usr/bin/env bash
# Builds the static preview and serves it in the foreground.
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd -P)"
cd "$PROJECT_DIR"

WEB_DIR="${OPENCODE_WEB_DIR:-/home/runner/work/_temp/omgithub-web}"
PORT="${PORT:-3000}"
DIST_DIR="$PROJECT_DIR/dist"
SOURCE_HTML="$PROJECT_DIR/miikacord-chat.html"
SCREEN_HTML="$PROJECT_DIR/miikacord-screen.html"
LOGIN_HTML="$PROJECT_DIR/miikacord-login.html"
DEPLOYMENT_OUTPUT="$WEB_DIR/deployment-output.json"

export PORT

# Print the command and its wall/user/sys time so startup logs stay diagnostic.
timed() {
  printf '[start] %s\n' "$*"
  /usr/bin/time -p "$@"
}

[[ "$PORT" =~ ^[0-9]+$ ]] || {
  echo "PORT must be numeric, got: $PORT" >&2
  exit 1
}

timed mkdir -p "$WEB_DIR" "$DIST_DIR"

# Install and build only when the project actually declares an npm workflow.
if [[ -f "$PROJECT_DIR/package.json" ]]; then
  if [[ -f "$PROJECT_DIR/package-lock.json" ]]; then
    timed npm ci --no-audit --no-fund
  else
    timed npm install --no-audit --no-fund
  fi
  if node -e 'const p=require("./package.json");process.exit(p.scripts?.build?0:1)'; then
    timed npm run build
  fi
fi

[[ -f "$SOURCE_HTML" ]] || {
  echo "Missing source file: $SOURCE_HTML" >&2
  exit 1
}

[[ -f "$SCREEN_HTML" ]] || echo "Warning: missing optional page $SCREEN_HTML" >&2
[[ -f "$LOGIN_HTML" ]] || echo "Warning: missing optional page $LOGIN_HTML" >&2

# Rebuild only when a source page is newer than any published entry point.
rebuild=false
[[ -f "$DIST_DIR/index.html" ]] || rebuild=true
[[ -f "$DIST_DIR/miikacord-chat.html" ]] || rebuild=true
[[ ! -f "$SOURCE_HTML" || "$SOURCE_HTML" -nt "$DIST_DIR/index.html" ]] && rebuild=true

if [[ -f "$SCREEN_HTML" ]]; then
  [[ -f "$DIST_DIR/miikacord-screen.html" ]] || rebuild=true
  [[ "$SCREEN_HTML" -nt "$DIST_DIR/miikacord-screen.html" ]] && rebuild=true
fi

if [[ -f "$LOGIN_HTML" ]]; then
  [[ -f "$DIST_DIR/miikacord-login.html" ]] || rebuild=true
  [[ "$LOGIN_HTML" -nt "$DIST_DIR/miikacord-login.html" ]] && rebuild=true
fi

if [[ "$rebuild" == true ]]; then
  timed cp "$SOURCE_HTML" "$DIST_DIR/index.html"
  timed cp "$SOURCE_HTML" "$DIST_DIR/miikacord-chat.html"
  [[ ! -f "$SCREEN_HTML" ]] || timed cp "$SCREEN_HTML" "$DIST_DIR/miikacord-screen.html"
  [[ ! -f "$LOGIN_HTML" ]] || timed cp "$LOGIN_HTML" "$DIST_DIR/miikacord-login.html"
else
  echo '[start] static build is up to date'
fi

# Publish the absolute static directory for the controller.
timed node -e '
  const fs = require("node:fs");
  const [project, directory, file] = process.argv.slice(1);
  const temporary = file + ".tmp";
  fs.writeFileSync(temporary, JSON.stringify({ project, directory }) + "\n");
  fs.renameSync(temporary, file);
' "$PROJECT_DIR" "$DIST_DIR" "$DEPLOYMENT_OUTPUT"

# The launcher owns the process lifecycle; keep the server in the foreground.
timed python3 -m http.server "$PORT" --bind 0.0.0.0 --directory "$DIST_DIR"
