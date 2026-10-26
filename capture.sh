#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-$(cd "$(dirname "$0")" && pwd)}"
CAPTURE_URL="${CAPTURE_URL:-}"
CAPTURE_DIR="${CAPTURE_DIR:-}"

now_ms() {
  date +%s%3N
}

run() {
  local label="$1"
  shift
  local started
  started="$(now_ms)"
  echo "[capture] ${label}: start"
  local status=0
  "$@" || status=$?
  local finished
  finished="$(now_ms)"
  echo "[capture] ${label}: $((finished - started))ms (exit ${status})"
  return "$status"
}

cd "$PROJECT_DIR"

if [[ -z "$CAPTURE_URL" || -z "$CAPTURE_DIR" ]]; then
  echo 'Set CAPTURE_URL and CAPTURE_DIR.' >&2
  exit 1
fi
case "$CAPTURE_URL" in
  http://* | https://*) ;;
  *)
    echo "CAPTURE_URL must be an http(s) URL: $CAPTURE_URL" >&2
    exit 1
    ;;
esac

run "create capture directory" mkdir -p "$CAPTURE_DIR"

STATUS="$(curl --silent --show-error --location --max-time 30 \
  --output /dev/null --write-out '%{http_code}' "$CAPTURE_URL" 2>/dev/null || printf '000')"
case "$STATUS" in
  2*)
    echo "[capture] preview HTTP ${STATUS}"
    ;;
  000 | 408 | 429 | 5*)
    echo "Temporary preview failure (HTTP ${STATUS})." >&2
    exit 75
    ;;
  *)
    echo "Preview rejected the capture request (HTTP ${STATUS})." >&2
    exit 1
    ;;
esac

set +e
node --input-type=module <<'NODE'
import { createRequire } from 'node:module'
import { readFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

const url = process.env.CAPTURE_URL
const output = process.env.CAPTURE_DIR
if (!url || !output) {
  console.error('Set CAPTURE_URL and CAPTURE_DIR.')
  process.exit(1)
}

const started = performance.now()
function timed(label, fn) {
  const begin = performance.now()
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      const seconds = ((performance.now() - begin) / 1000).toFixed(2)
      console.log(`[capture] ${label}: ${seconds}s`)
    })
}

mkdirSync(output, { recursive: true })

const runtime = join(homedir(), '.local/share/omgithub-playwright')
const require = createRequire(join(runtime, 'package.json'))
const { chromium } = require('playwright')
try {
  const captures = require(join(runtime, 'wip-screenshots.cjs'))
  captures.instrument({ chromium })
} catch (error) {
  console.error(`Capture instrumentation unavailable: ${error.message}`)
}

const configPath = join(runtime, process.platform === 'darwin' ? 'metal.json' : 'linux.json')
const config = JSON.parse(readFileSync(configPath, 'utf8'))
if (process.platform === 'linux') {
  process.env.DISPLAY ||= `:${readFileSync(join(runtime, 'display'), 'utf8').trim()}`
}

const transient = (error) => Object.assign(error, { exitCode: 75 })
let browser

try {
  browser = await timed('launch browser', () =>
    chromium.launch({ ...config.browser.launchOptions, timeout: 30000 }).catch(transient)
  )

  for (const [name, width, height] of [['desktop', 1440, 900], ['mobile', 390, 844]]) {
    const page = await timed(`open ${name} page`, () =>
      browser.newPage({ viewport: { width, height } }).catch(transient)
    )
    page.setDefaultTimeout(30000)
    page.on('pageerror', (error) => console.error(`${name} page error: ${error.message}`))

    const response = await timed(`navigate ${name}`, () =>
      page.goto(url, { waitUntil: 'load', timeout: 45000 }).catch(transient)
    )
    if (!response || !response.ok()) {
      const status = response ? response.status() : 0
      const error = new Error(`HTTP ${status || 'no response'} loading preview`)
      error.exitCode = !response || [408, 429, 500, 502, 503, 504].includes(status) ? 75 : 1
      throw error
    }

    await timed(`wait for rendered content (${name})`, () =>
      page.waitForFunction(() => {
        const ready = document.querySelector('[data-app-ready]')
        const text = (document.body?.innerText || '').trim()
        const media = document.querySelector('main, canvas, img, svg, picture, video')
        return document.readyState === 'complete' && Boolean(ready || (text.length > 20 && media))
      }, null, { timeout: 30000 })
    )
    await page.waitForFunction(() => document.fonts.status === 'loaded', null, { timeout: 15000 }).catch(() => {})
    await timed(`settle ${name}`, () => page.waitForTimeout(1000))

    const file = join(output, `final-${name}.png`)
    await timed(`screenshot ${name}`, () =>
      page.screenshot({ path: file, timeout: 30000 }).catch((error) => {
        if (error.name === 'TimeoutError' || !browser.isConnected()) transient(error)
        throw error
      })
    )
    const bytes = readFileSync(file)
    if (!bytes.length || bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') {
      const error = new Error(`Invalid PNG: ${file}`)
      error.exitCode = 1
      throw error
    }

    await timed(`close ${name} page`, () => page.close())
  }
} catch (error) {
  console.error(error.message)
  process.exitCode = error.exitCode || 1
} finally {
  if (browser) {
    await timed('close browser', () => browser.close()).catch((error) => {
      console.error(error.message)
      process.exitCode ||= 75
    })
  }
  const seconds = ((performance.now() - started) / 1000).toFixed(2)
  console.log(`[capture] total: ${seconds}s`)
}
NODE
CAPTURE_EXIT=$?
set -e

if [[ "$CAPTURE_EXIT" -ne 0 ]]; then
  exit "$CAPTURE_EXIT"
fi

run "verify desktop screenshot" test -s "$CAPTURE_DIR/final-desktop.png"
run "verify mobile screenshot" test -s "$CAPTURE_DIR/final-mobile.png"
echo "[capture] wrote ${CAPTURE_DIR}/final-desktop.png and ${CAPTURE_DIR}/final-mobile.png"
