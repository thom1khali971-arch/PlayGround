#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

now_ms() {
  date +%s%3N
}

run() {
  local label="$1"
  shift
  local start
  start="$(now_ms)"
  echo "[capture] ${label}: start"
  local status=0
  "$@" || status=$?
  local end
  end="$(now_ms)"
  echo "[capture] ${label}: $((end - start))ms (exit ${status})"
  return "$status"
}

if [[ -z "${CAPTURE_URL:-}" ]]; then
  echo "[capture] CAPTURE_URL is required." >&2
  exit 1
fi
if [[ -z "${CAPTURE_DIR:-}" ]]; then
  echo "[capture] CAPTURE_DIR is required." >&2
  exit 1
fi

CAPTURE_DIR="$(mkdir -p "$CAPTURE_DIR" && cd "$CAPTURE_DIR" && pwd)"
export CAPTURE_URL CAPTURE_DIR

PLAYWRIGHT_RUNTIME="${OMGITHUB_PLAYWRIGHT_ROOT:-${HOME}/.local/share/omgithub-playwright}"
if [[ ! -d "${PLAYWRIGHT_RUNTIME}/node_modules/playwright" ]]; then
  echo "[capture] Playwright runtime is not installed at ${PLAYWRIGHT_RUNTIME}." >&2
  exit 75
fi
export OMGITHUB_PLAYWRIGHT_ROOT="$PLAYWRIGHT_RUNTIME"

if [[ "$(uname -s)" == "Linux" && -z "${DISPLAY:-}" ]]; then
  if [[ -s "${PLAYWRIGHT_RUNTIME}/display" ]]; then
    DISPLAY=":$(cat "${PLAYWRIGHT_RUNTIME}/display")"
    export DISPLAY
  fi
fi

TEMP_DIR="${RUNNER_TEMP:-/tmp}"
CAPTURE_SCRIPT="${TEMP_DIR}/omgithub-capture-$$.mjs"
trap 'rm -f "$CAPTURE_SCRIPT"' EXIT

cat > "$CAPTURE_SCRIPT" <<'NODE'
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { performance } from 'node:perf_hooks'

const runtime = process.env.OMGITHUB_PLAYWRIGHT_ROOT
const url = process.env.CAPTURE_URL
const outputDir = process.env.CAPTURE_DIR
if (!runtime || !url || !outputDir) {
  console.error('[capture] missing runtime, URL, or output directory')
  process.exit(1)
}

const require = createRequire(join(runtime, 'package.json'))
let chromium
try {
  ;({ chromium } = require('playwright'))
} catch (error) {
  console.error('[capture] unable to load Playwright:', error.message)
  process.exit(75)
}

const configFile = join(runtime, process.platform === 'darwin' ? 'metal.json' : 'linux.json')
const config = JSON.parse(readFileSync(configFile, 'utf8'))
if (process.platform === 'linux' && !process.env.DISPLAY) {
  process.env.DISPLAY = ':' + readFileSync(join(runtime, 'display'), 'utf8').trim()
}
mkdirSync(outputDir, { recursive: true })

const timing = async (label, fn) => {
  const started = performance.now()
  try {
    return await fn()
  } finally {
    console.log(`[capture] ${label}: ${Math.round(performance.now() - started)}ms`)
  }
}
const transient = (message, cause) => Object.assign(cause instanceof Error ? cause : new Error(message), { exitCode: 75 })
const defect = (message, cause) => Object.assign(cause instanceof Error ? cause : new Error(message), { exitCode: 1 })

let browser
try {
  browser = await timing('browser launch', () =>
    chromium.launch({ ...config.browser.launchOptions, timeout: 30000 })
      .catch(error => { throw transient('browser launch failed', error) })
  )

  for (const [name, width, height] of [['desktop', 1440, 900], ['mobile', 390, 844]]) {
    const page = await timing(`${name} page`, () =>
      browser.newPage({
        viewport: { width, height },
        deviceScaleFactor: 1,
      }).catch(error => { throw transient(`${name} page creation failed`, error) })
    )
    page.setDefaultTimeout(30000)
    page.on('pageerror', error => console.error(`[capture] ${name} page error: ${error.message}`))

    let response
    await timing(`${name} navigate`, async () => {
      try {
        response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 })
      } catch (error) {
        throw transient(`${name} navigation failed`, error)
      }
    })

    if (!response || !response.ok()) {
      const status = response?.status()
      const error = [408, 429, 500, 502, 503, 504].includes(status)
        ? transient(`HTTP ${status} loading preview`)
        : defect(`HTTP ${status} loading preview`)
      throw error
    }

    await timing(`${name} render wait`, async () => {
      try {
        await page.waitForFunction(() => {
          const root = document.querySelector('#root')
          return document.readyState === 'complete'
            && Boolean(root)
            && root.children.length > 0
            && document.body.innerText.trim().length > 0
        }, { timeout: 30000 })
        await page.waitForFunction(
          () => !document.fonts || document.fonts.status === 'loaded',
          { timeout: 15000 }
        )
      } catch (error) {
        throw defect(`${name} did not render`, error)
      }
    })

    await timing(`${name} settle`, () => page.waitForTimeout(1500))

    await timing(`${name} screenshot`, async () => {
      try {
        await page.screenshot({
          path: join(outputDir, `final-${name}.png`),
          timeout: 30000,
        })
      } catch (error) {
        throw transient(`${name} screenshot failed`, error)
      }
    })

    await timing(`${name} close`, () => page.close().catch(() => {}))
  }

  console.log(`[capture] wrote final-desktop.png and final-mobile.png to ${outputDir}`)
} catch (error) {
  console.error(error?.stack || error)
  process.exitCode = error?.exitCode || 1
} finally {
  if (browser) {
    await browser.close().catch(error => {
      console.error('[capture] browser close failed:', error.message)
      process.exitCode ||= 75
    })
  }
}
NODE

run "capture browser evidence" node "$CAPTURE_SCRIPT"
