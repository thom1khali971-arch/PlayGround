import { createRequire } from 'node:module'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const url = process.env.CAPTURE_URL
const output = process.env.CAPTURE_DIR

function fail(message, exitCode = 1) {
  throw Object.assign(new Error(message), { exitCode })
}

if (!url || !output) fail('Set CAPTURE_URL and CAPTURE_DIR.')

let parsed
try {
  parsed = new URL(url)
} catch {
  fail(`Invalid CAPTURE_URL: ${url}`)
}
if (!/^https?:$/.test(parsed.protocol)) fail(`CAPTURE_URL must use http(s): ${url}`)

mkdirSync(output, { recursive: true })

const runtime = join(process.env.HOME, '.local/share/omgithub-playwright')
const require = createRequire(join(runtime, 'package.json'))

let chromium
try {
  ({ chromium } = require('playwright'))
} catch (error) {
  console.error(`Playwright is unavailable: ${error.message}`)
  process.exit(75)
}

const configFile = join(runtime, process.platform === 'darwin' ? 'metal.json' : 'linux.json')
let config
try {
  config = JSON.parse(readFileSync(configFile, 'utf8'))
} catch (error) {
  console.error(`Browser configuration is unavailable: ${error.message}`)
  process.exit(75)
}

if (process.platform === 'linux') {
  try {
    process.env.DISPLAY ||= ':' + readFileSync(join(runtime, 'display'), 'utf8').trim()
  } catch (error) {
    console.error(`Display configuration is unavailable: ${error.message}`)
    process.exit(75)
  }
}

const views = [
  ['desktop', 1440, 900],
  ['mobile', 390, 844],
]
const transientStatuses = new Set([408, 425, 429, 500, 502, 503, 504])
const result = { url, capturedAt: new Date().toISOString(), views: {} }
let browser

try {
  browser = await chromium.launch({
    ...config.browser.launchOptions,
    timeout: 30000,
  }).catch((error) => {
    fail(`Could not launch browser: ${error.message}`, 75)
  })

  for (const [name, width, height] of views) {
    let context
    let page
    try {
      context = await browser.newContext({
        viewport: { width, height },
        deviceScaleFactor: 1,
      }).catch((error) => {
        fail(`Could not create ${name} browser context: ${error.message}`, 75)
      })

      page = await context.newPage().catch((error) => {
        fail(`Could not create ${name} page: ${error.message}`, 75)
      })
      page.setDefaultTimeout(30000)

      const renderingFailures = []
      page.on('pageerror', (error) => renderingFailures.push(`page error: ${error.message}`))
      page.on('response', (response) => {
        try {
          if (response.status() >= 400 && new URL(response.url()).origin === parsed.origin) {
            renderingFailures.push(`HTTP ${response.status()}: ${response.url()}`)
          }
        } catch {}
      })

      let response
      try {
        response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 })
      } catch (error) {
        fail(`Could not navigate to ${url}: ${error.message}`, 75)
      }

      if (!response) fail(`No response from ${url}.`, 75)
      if (!response.ok()) {
        fail(`HTTP ${response.status()} loading ${url}.`, transientStatuses.has(response.status()) ? 75 : 1)
      }

      // Wait for the application shell and webfonts, then let entrance
      // animations settle before taking immutable evidence.
      await page.locator('body').waitFor({ state: 'visible' })
      await page.locator('h1').waitFor({ state: 'visible' })
      await page.waitForFunction(() => document.fonts?.status === 'loaded', null, { timeout: 15000 })
        .catch(() => {})
      await page.waitForTimeout(900)

      const rendered = await page.evaluate(() => ({
        title: document.title.trim(),
        heading: document.querySelector('h1')?.textContent?.trim() || '',
        text: document.body.innerText.trim(),
        width: window.innerWidth,
        height: window.innerHeight,
      }))

      if (renderingFailures.length) fail(`Rendering failed: ${renderingFailures.join('; ')}`, 1)
      if (!rendered.title) fail('Rendering failed: missing document title.', 1)
      if (!rendered.heading || rendered.text.length < 40) fail('Rendering failed: page content is empty.', 1)
      if (rendered.width < width - 1 || rendered.height < height - 1) {
        fail(`Rendering failed: viewport is ${rendered.width}x${rendered.height}, expected ${width}x${height}.`, 1)
      }

      const screenshot = join(output, `final-${name}.png`)
      try {
        await page.screenshot({ path: screenshot, fullPage: false, timeout: 30000 })
      } catch (error) {
        fail(`Could not capture ${name} screenshot: ${error.message}`, /timeout|disconnected|closed/i.test(error.message) ? 75 : 1)
      }

      result.views[name] = { path: screenshot, width, height, title: rendered.title }
      console.log(`[capture] ${name}: ${screenshot} (${width}x${height})`)
    } finally {
      if (page) await page.close().catch(() => {})
      if (context) await context.close().catch(() => {})
    }
  }

  writeFileSync(join(output, 'capture-result.json'), JSON.stringify(result, null, 2) + '\n')
} catch (error) {
  console.error(`[capture] ${error.stack || error.message}`)
  process.exitCode = error.exitCode || 1
} finally {
  if (browser) {
    await browser.close().catch((error) => {
      console.error(`[capture] browser close failed: ${error.message}`)
      process.exitCode ||= 75
    })
  }
}
