#!/usr/bin/env bash
set -euo pipefail

# Once-per-worker browser prerequisite. Keep this hook idempotent: later
# workers reuse the Playwright cache when Chromium is already installed.
if [[ "$(uname -s)" == Linux ]]; then
  if ! find "$HOME/.cache/ms-playwright" -type f -path '*/chrome-linux64/chrome' -executable -print -quit 2>/dev/null | grep -q .; then
    /usr/bin/time -p playwright-cli install-browser chromium
  fi
fi
