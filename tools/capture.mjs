#!/usr/bin/env node
// Capture desktop and mobile screenshots with the worker's Playwright runtime.
// Exit 75 for transient navigation/browser failures, 1 for script/render defects.
import { createRequire } from 'node:module'
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve, sep } from 'node:path'

const url = process.env.CAPTURE_URL
const output = process.env.CAPTURE_DIR
const projectRoot = resolve(process.cwd())

const fail = (message, code = 1) => {
  const error = message instanceof Error ? message : new Error(message)
  error.exitCode = code
  throw error
}

if (!url || !output) fail('Set CAPTURE_URL and CAPTURE_DIR before running capture.sh.', 1)

let target
try {
  target = new URL(url)
} catch {
  fail(`CAPTURE_URL is not a valid URL: ${url}`, 1)
}
if (!/^https?:$/.test(target.protocol)) fail(`CAPTURE_URL must be http(s): ${url}`, 1)

const outputDir = resolve(output)
if (outputDir === projectRoot || outputDir.startsWith(projectRoot + sep)) {
  fail('CAPTURE_DIR must be outside the project source tree.', 1)
}
mkdirSync(outputDir, { recursive: true })

const runtime = process.env.PLAYWRIGHT_RUNTIME || join(homedir(), '.local/share/omgithub-playwright')
const require = createRequire(join(runtime, 'package.json'))
let chromium
try {
  ({ chromium } = require('playwright'))
} catch (error) {
  fail(`Cannot load Playwright from ${runtime}: ${error.message}`, 75)
}

let launchOptions = { headless: true }
const configPath = join(runtime, process.platform === 'darwin' ? 'metal.json' : 'linux.json')
if (existsSync(configPath)) {
  try {
    const config = JSON.parse(readFileSync(configPath, 'utf8'))
    launchOptions = { ...(config.browser?.launchOptions || launchOptions) }
  } catch (error) {
    console.error(`Ignoring unreadable Playwright config: ${error.message}`)
  }
}
if (process.platform === 'linux') {
  const displayFile = join(runtime, 'display')
  if (!process.env.DISPLAY && existsSync(displayFile)) {
    process.env.DISPLAY = ':' + readFileSync(displayFile, 'utf8').trim()
  }
}

const transients = new Set(['408', '425', '429', '500', '502', '503', '504'])
const isDisconnected = (error) => /Target (page|browser).*closed|browser has been closed|Browser closed/i.test(error?.message || '')

const transient = (error) => {
  error.exitCode = 75
  throw error
}

const readySelector = process.env.CAPTURE_READY_SELECTOR || 'body[data-rendered="true"]'
const viewports = [
  ['desktop', 1440, 900, 1],
  ['mobile', 390, 844, 2]
]

let browser
const startedAt = Date.now()
try {
  browser = await chromium.launch({ ...launchOptions, timeout: 30000 }).catch(transient)
  console.log(`Capture target: ${url}`)
  console.log(`Capture output: ${outputDir}`)

  for (const [name, width, height, scale] of viewports) {
    const viewportStart = Date.now()
    const context = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: scale,
      isMobile: name === 'mobile',
      hasTouch: name === 'mobile',
      colorScheme: 'dark'
    }).catch(transient)
    const page = await context.newPage().catch(transient)
    page.setDefaultTimeout(30000)
    page.on('pageerror', (error) => console.error(`[${name}] page error: ${error.message}`))
    page.on('console', (message) => {
      if (message.type() === 'error') console.error(`[${name}] console: ${message.text()}`)
    })

    let response
    try {
      response = await page.goto(url, { waitUntil: 'load', timeout: 45000 })
    } catch (error) {
      transient(error)
    }

    if (!response) transient(new Error(`No HTTP response from ${url}`))
    const status = String(response.status())
    if (!response.ok()) {
      if (transients.has(status)) fail(`HTTP ${status} loading ${url}`, 75)
      fail(`HTTP ${status} loading ${url}`, 1)
    }

    try {
      await page.locator(readySelector).first().waitFor({ state: 'visible', timeout: 30000 })
    } catch (error) {
      if (isDisconnected(error)) transient(error)
      fail(`Rendered content selector "${readySelector}" did not appear: ${error.message}`, 1)
    }

    await page.evaluate(async () => {
      await document.fonts.ready
      await Promise.all(Array.from(document.images).filter((image) => !image.complete).map((image) =>
        new Promise((done) => {
          image.addEventListener('load', done, { once: true })
          image.addEventListener('error', done, { once: true })
        })))
      window.scrollTo(0, 0)
    }).catch((error) => {
      if (isDisconnected(error)) transient(error)
    })

    await page.waitForTimeout(500)
    const file = join(outputDir, `final-${name}.png`)
    await page.screenshot({ path: file, timeout: 30000 }).catch((error) => {
      if (error.name === 'TimeoutError' || isDisconnected(error)) transient(error)
      throw error
    })

    const bytes = statSync(file).size
    if (bytes < 1024) fail(`Screenshot ${file} is suspiciously small (${bytes} bytes).`, 1)
    console.log(`Captured ${name} ${width}x${height} @${scale}x → ${file} (${(bytes / 1024).toFixed(1)} KiB, ${Date.now() - viewportStart} ms)`)

    await context.close().catch((error) => {
      if (isDisconnected(error)) transient(error)
    })
  }

  console.log(`Capture complete in ${Date.now() - startedAt} ms.`)
} catch (error) {
  console.error(error?.stack || error)
  process.exitCode = error?.exitCode || 1
} finally {
  await browser?.close().catch((error) => {
    console.error(`Browser close failed: ${error.message}`)
    if (!process.exitCode) process.exitCode = 75
  })
}
