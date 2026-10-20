#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

RELAY_PID=""
cleanup() {
  if [ -n "$RELAY_PID" ]; then
    kill "$RELAY_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

if [ -f relay/server.mjs ]; then
  RELAY_PORT="${RELAY_PORT:-3003}" RELAY_REGION="${RELAY_REGION:-us-east-1}" \
    node relay/server.mjs >/tmp/thom-relay.log 2>&1 &
  RELAY_PID=$!
fi

/usr/bin/time -p node "${RUNTIME_DIR:?}/scripts/default-start.mjs"
