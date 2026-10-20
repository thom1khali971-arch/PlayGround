#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
export RELAY_PORT="${RELAY_PORT:-3003}"
export RELAY_REGION="${RELAY_REGION:-us-east-1}"
exec node relay/server.mjs
