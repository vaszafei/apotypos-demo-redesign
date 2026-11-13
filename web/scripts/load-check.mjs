// What a visitor sees while a Nuxt page loads: the layout shift of the first load, and (with --out) a screenshot of every change on the way.
// Usage (in web/, after npm run generate): npm run check:load -- [/ /media ...] [--limit 0.05] [--cpu 4] [--out <dir>]
// The shift is Chrome's own layout-shift entries (the sum, as CLS). Exit code 1 when a page is over the limit. The pixel check only looks after the page has settled.
import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { startServer } from './lib/static-server.mjs'

const args = process.argv.slice(2)
const option = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback }
const flagValues = new Set(['--limit', '--cpu', '--out'].flatMap(f => { const i = args.indexOf(f); return i >= 0 ? [i + 1] : [] }))
const routes = args.filter((a, i) => !a.startsWith('--') && !flagValues.has(i))
const limit = Number(option('limit', 0.05)), cpu = Number(option('cpu', 4)), out = option('out')
const chrome = process.env.CHROME_PATH || '/usr/bin/google-chrome'

const root = fileURLToPath(new URL('../.output/public/', import.meta.url))
if (!existsSync(join(root, '_nuxt'))) { console.error('The Nuxt build is missing. Run npm run generate first.'); process.exit(2) }
const port = Number(process.env.NUXT_PORT || 8793)
const server = await startServer(root, port)
const { chromium } = createRequire(import.meta.url)('playwright-core')
const browser = await chromium.launch({ executablePath: chrome })
let failed = false
for (const route of routes.length ? routes : ['/']) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu })
  await page.addInitScript(() => {
    window.__shifts = []
    new PerformanceObserver(list => list.getEntries().forEach(e => { if (!e.hadRecentInput) window.__shifts.push({ at: Math.round(e.startTime), value: e.value, nodes: e.sources.map(s => `${s.node?.className || s.node?.nodeName}`.slice(0, 40)) }) })).observe({ type: 'layout-shift', buffered: true })
  })
  const frames = []
  if (out) {
    mkdirSync(out, { recursive: true })
    cdp.on('Page.screencastFrame', f => { frames.push(f.metadata.timestamp); writeFileSync(join(out, `${route.replace(/[^a-z0-9]+/gi, '_') || 'home'}-${String(frames.length - 1).padStart(3, '0')}.jpg`), Buffer.from(f.data, 'base64')); cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }) })
    await page.goto('about:blank')
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 45, everyNthFrame: 1 })
  }
  await page.goto(`http://localhost:${port}${route}`, { waitUntil: 'commit' })
  await page.waitForTimeout(4500)
  const shifts = await page.evaluate(() => window.__shifts)
  const total = shifts.reduce((s, e) => s + e.value, 0)
  const bad = total > limit
  if (bad) failed = true
  console.log(`${bad ? 'FAIL' : 'ok  '} ${route}  shift ${total.toFixed(3)} (limit ${limit}, CPU x${cpu})${frames.length ? `, ${frames.length} frames in ${out}` : ''}`)
  for (const e of shifts) console.log(`       ${e.at} ms  ${e.value.toFixed(3)}  ${e.nodes.join(' | ')}`)
  await page.close()
}
await browser.close()
server.close()
process.exit(failed ? 1 : 0)
