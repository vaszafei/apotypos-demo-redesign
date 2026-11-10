// Compare a Nuxt page with the static page it replaced, pixel by pixel.
// Usage (in web/): npm run check:pixel -- /trends [--limit 0.05] [--out <dir>] [--nuxt-url <url>] [--static-url <url>]
// Both pages are loaded signed in as lolovios, with reduced motion, after the DOM stops changing.
// A pixel differs when a channel differs by more than 24 of 255. Screenshots and diff images go to --out
// (default: the temporary folder), never to the repo. Exit code 1 when a screen is over the limit or has another size.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
import { PNG } from 'pngjs'
import { startServer } from './lib/static-server.mjs'
import { staticUrlOf } from './lib/ported.mjs'

const THRESHOLD = 24
const GAP = 3

// Pure part: compare two decoded PNGs ({ width, height, data }).
export const compareImages = (a, b, threshold = THRESHOLD) => {
  if (a.width !== b.width || a.height !== b.height) return { sameSize: false, sizes: [[a.width, a.height], [b.width, b.height]] }
  const { width, height } = a
  const rows = new Map()
  const diff = new PNG({ width, height })
  let differ = 0
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const bad = Math.abs(a.data[i] - b.data[i]) > threshold || Math.abs(a.data[i + 1] - b.data[i + 1]) > threshold || Math.abs(a.data[i + 2] - b.data[i + 2]) > threshold
      if (bad) {
        differ++
        const row = rows.get(y) || { count: 0, x0: x, x1: x }
        row.count++; row.x0 = Math.min(row.x0, x); row.x1 = Math.max(row.x1, x)
        rows.set(y, row)
        diff.data[i] = 255; diff.data[i + 1] = 0; diff.data[i + 2] = 0; diff.data[i + 3] = 255
      } else {
        const grey = Math.round((a.data[i] + a.data[i + 1] + a.data[i + 2]) / 3 * 0.25 + 191)
        diff.data[i] = grey; diff.data[i + 1] = grey; diff.data[i + 2] = grey; diff.data[i + 3] = 255
      }
    }
  }
  const bands = []
  for (const y of [...rows.keys()].sort((m, n) => m - n)) {
    const row = rows.get(y)
    const last = bands[bands.length - 1]
    if (last && y - last.y1 <= GAP) { last.y1 = y; last.count += row.count; last.x0 = Math.min(last.x0, row.x0); last.x1 = Math.max(last.x1, row.x1) }
    else bands.push({ y0: y, y1: y, count: row.count, x0: row.x0, x1: row.x1 })
  }
  return { sameSize: true, width, height, differ, total: width * height, bands, diff }
}

// Wait until the DOM and the page height stop changing, then put every running animation at its end state,
// so the screenshot is not taken in the middle of an entrance (docs/solutions/workflow/prove-no-visual-change-with-settled-dom.md).
const settle = async (page) => {
  await page.evaluate(() => document.fonts.ready)
  let last = ''
  for (let i = 0; i < 40; i++) {
    const now = await page.evaluate(() => `${document.body.innerHTML.length}:${document.documentElement.scrollHeight}`)
    if (now === last) break
    last = now
    await page.waitForTimeout(300)
  }
  await page.evaluate(() => document.getAnimations().forEach((animation) => { try { animation.finish() } catch {} }))
  await page.waitForTimeout(300)
}

const SCREENS = [
  { name: '1440 full page', width: 1440, height: 900 },
  { name: '390 full page', width: 390, height: 844 },
  { name: '1440 date picker open', width: 1440, height: 900, picker: true },
  { name: '1440 hover on the first chart', width: 1440, height: 900, hover: true },
  { name: '1440 night theme', width: 1440, height: 900, theme: 'night' },
  { name: '390 night theme', width: 390, height: 844, theme: 'night' }
]

const shoot = async (browser, url, screen) => {
  const context = await browser.newContext({ viewport: { width: screen.width, height: screen.height }, reducedMotion: 'reduce' })
  // The theme is stored before the page loads (both shells read 'proto-theme'), so the page draws in it; setting data-theme afterwards leaves the colors a page computed in JS in the old theme.
  await context.addInitScript((theme) => { try { localStorage.setItem('proto-user', 'lolovios'); if (theme) localStorage.setItem('proto-theme', theme) } catch {} }, screen.theme)
  const page = await context.newPage()
  try {
    await page.goto(url, { waitUntil: 'networkidle' })
    await settle(page)
    if (screen.picker) {
      const trigger = page.locator('.dr-trigger').first()
      if (!(await trigger.count())) return { skipped: 'no date picker on the page' }
      await trigger.click(); await page.waitForTimeout(400)
    }
    if (screen.hover) {
      const chart = page.locator('svg.chart').first()
      if (!(await chart.count())) return { skipped: 'no chart on the page' }
      await chart.scrollIntoViewIfNeeded()
      const box = await chart.boundingBox()
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
      await page.waitForTimeout(400)
      return { png: PNG.sync.read(await page.screenshot()) }
    }
    return { png: PNG.sync.read(await page.screenshot({ fullPage: true })) }
  } finally {
    await context.close()
  }
}

const main = async () => {
  const args = process.argv.slice(2)
  const option = (name, fallback) => { const i = args.indexOf(`--${name}`); return i > -1 ? args[i + 1] : fallback }
  const route = args.find((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'))
  if (!route) { console.error('Usage: npm run check:pixel -- <route> (for example /trends)'); process.exit(2) }
  // A detail page has its id in the query (/story?id=100): the query goes to both pages.
  const [path, query] = route.split('?')
  const staticFile = staticUrlOf(path)
  const staticPage = staticFile && query ? `${staticFile}${staticFile.includes('?') ? '&' : '?'}${query}` : staticFile
  if (!staticPage) { console.error(`${route} is not in ported-pages.json, so there is no static page to compare with.`); process.exit(2) }
  const limit = Number(option('limit', 0.05))
  const out = resolve(option('out', join(tmpdir(), 'apotypos-pixel-diff')))
  const chrome = process.env.CHROME_PATH || '/usr/bin/google-chrome'
  if (!existsSync(chrome)) { console.error(`Chrome not found at ${chrome}. Install Google Chrome or set CHROME_PATH.`); process.exit(2) }

  const servers = []
  let nuxtUrl = option('nuxt-url')
  let staticUrl = option('static-url')
  if (!nuxtUrl) {
    const root = fileURLToPath(new URL('../.output/public/', import.meta.url))
    if (!existsSync(join(root, '_nuxt'))) { console.error('The Nuxt build is missing. Run npm run generate first, or pass --nuxt-url.'); process.exit(2) }
    servers.push(await startServer(root, Number(process.env.NUXT_PORT || 8791)))
    nuxtUrl = `http://localhost:${process.env.NUXT_PORT || 8791}`
  }
  if (!staticUrl) {
    servers.push(await startServer(fileURLToPath(new URL('../../docs/redesign/prototypes/', import.meta.url)), Number(process.env.STATIC_PORT || 8792)))
    staticUrl = `http://localhost:${process.env.STATIC_PORT || 8792}`
  }
  let chromium
  try { ({ chromium } = createRequire(import.meta.url)('playwright-core')) } catch { console.error('playwright-core is missing. Run npm install in web/.'); process.exit(2) }

  mkdirSync(out, { recursive: true })
  const browser = await chromium.launch({ executablePath: chrome })
  const slug = route.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '')
  let failed = false
  console.log(`${route} (Nuxt, ${nuxtUrl}) against ${staticPage} (static, ${staticUrl}). A pixel differs above ${THRESHOLD} of 255 in a channel. Limit ${limit}%.\n`)
  for (const screen of SCREENS) {
    const tag = `${slug}-${screen.name.replace(/[^a-z0-9]+/gi, '_')}`
    const sides = {}
    for (const [side, url] of [['nuxt', `${nuxtUrl}${route}`], ['static', `${staticUrl}/${staticPage}`]]) {
      try { sides[side] = await shoot(browser, url, screen) } catch (error) { sides[side] = { error: `${side} did not answer at ${url}: ${String(error.message).split('\n')[0]}` } }
    }
    const problem = sides.nuxt.error || sides.static.error
    if (problem) { console.log(`- ${screen.name}: ${problem}`); failed = true; continue }
    if (sides.nuxt.skipped || sides.static.skipped) { console.log(`- ${screen.name}: skipped (${sides.nuxt.skipped || sides.static.skipped})`); continue }
    writeFileSync(join(out, `${tag}-nuxt.png`), PNG.sync.write(sides.nuxt.png))
    writeFileSync(join(out, `${tag}-static.png`), PNG.sync.write(sides.static.png))
    const result = compareImages(sides.nuxt.png, sides.static.png)
    if (!result.sameSize) {
      const [[nw, nh], [sw, sh]] = result.sizes
      console.log(`- ${screen.name}: different size, Nuxt ${nw}x${nh}, static ${sw}x${sh}. Not compared.`)
      failed = true
      continue
    }
    writeFileSync(join(out, `${tag}-diff.png`), PNG.sync.write(result.diff))
    const percent = (result.differ / result.total) * 100
    const over = percent > limit
    if (over) failed = true
    console.log(`- ${screen.name}: ${result.differ} of ${result.total} pixels differ (${percent.toFixed(3)}%)${over ? ' OVER THE LIMIT' : ''}`)
    for (const band of result.bands.slice(0, 8)) console.log(`    rows ${band.y0}-${band.y1}, x ${band.x0}-${band.x1}: ${band.count} px`)
    if (result.bands.length > 8) console.log(`    and ${result.bands.length - 8} more bands`)
  }
  await browser.close()
  for (const server of servers) server.close()
  console.log(`\nImages: ${out}`)
  process.exit(failed ? 1 : 0)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main()
