#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

ROOT="$(cd .. && pwd)"
GRADLE_BIN="${GRADLE_BIN:-gradle}"

/usr/bin/time -p cp "$ROOT/index.html" "$ROOT/stockfish.js" "$ROOT/chess.min.js" app/src/main/assets/

/usr/bin/time -p "$GRADLE_BIN" :app:assembleRelease --no-daemon

/usr/bin/time -p cp app/build/outputs/apk/release/app-release.apk "$ROOT/GrandmasterLab.apk"

echo "APK gerado: $ROOT/GrandmasterLab.apk"
