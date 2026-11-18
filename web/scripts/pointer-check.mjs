// The pointer of PlegmaStage on a generated build: what it finds, what it says, and what stays on the screen after it leaves.
// Usage (in web/, after npm run generate):  npm run check:pointer [-- --only <name>] [-- --root <the .output/public of another build>]
// Checks (each one is a line of the output; exit code 1 when one fails):
//   phantom     Home under the hero, a pointer over a grid: a tooltip needs a drawn pixel of the stage within the reach of the pointer; a click on such a point opens nothing
//   stuck       story, theme, outlet: after the pointer leaves a node for a spot that says nothing when it is reached from the corner, no tooltip is left
//   window      the pointer leaves the window: no tooltip is left
//   scroll      Home: the page scrolls under a pointer that does not move: a tooltip that stays is one the stage finds again at that spot
//   navigate    a click on a theme web opens a story: the tooltip is gone on the story page
// Cards and controls answer for themselves, so the points on them are left out (the same list as the stage's own CAPTURES).
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
import { startServer } from './lib/static-server.mjs'

const CAPTURES = 'a, button, input, select, textarea, [role="dialog"], .dcard, .plegma-card, .plegma-day, .plegma-title, .plegma-dock, .kpi-tile, .page-head, .section-nav, .trail-bar, .header-bar, .sidebar, .page-footer, .tooltip'
const REACH = 14
const VIEWPORT = { width: 1440, height: 900 }

const tipOf = page => page.evaluate(() => document.querySelector('.tooltip .tooltip-title')?.textContent ?? null)
const onCard = (page, x, y) => page.evaluate(({ x, y, sel }) => !!document.elementFromPoint(x, y)?.closest(sel), { x, y, sel: CAPTURES })
// How many drawn pixels of the stage's canvases lie within `r` px of the point (page coordinates).
const inked = (page, x, y, r) => page.evaluate(({ x, y, r }) => {
  let n = 0
  for (const c of document.querySelectorAll('canvas.plegma-canvas:not(.plegma-dive-snap):not(.plegma-hero-snap)')) {
    const box = c.getBoundingClientRect()
    const k = c.width / box.width
    const x0 = Math.max(0, Math.floor((x - box.left - r) * k))
    const y0 = Math.max(0, Math.floor((y - box.top - r) * k))
    const w = Math.min(c.width - x0, Math.ceil(r * 2 * k))
    const h = Math.min(c.height - y0, Math.ceil(r * 2 * k))
    if (w <= 0 || h <= 0) continue
    const d = c.getContext('2d').getImageData(x0, y0, w, h).data
    for (let i = 3; i < d.length; i += 4) if (d[i] > 12) n++
  }
  return n
}, { x, y, r })
const gridOf = (cols, rows, top = 70) => {
  const out = []
  for (let gy = 0; gy < rows; gy++) for (let gx = 0; gx < cols; gx++) out.push([Math.round(((gx + 0.5) / cols) * VIEWPORT.width), top + Math.round(((gy + 0.5) / rows) * (VIEWPORT.height - top - 10))])
  return out
}
const reach = async (page, x, y) => {
  await page.mouse.move(2, 70)
  await page.waitForTimeout(30)
  await page.mouse.move(x - 2, y - 1)
  await page.mouse.move(x, y)
  await page.waitForTimeout(60)
}
const open = async (browser, base, route, reduced) => {
  const context = await browser.newContext({ viewport: VIEWPORT, reducedMotion: reduced ? 'reduce' : 'no-preference' })
  await context.addInitScript(() => { try { localStorage.setItem('proto-user', 'lolovios') } catch {} })
  const page = await context.newPage()
  await page.goto(`${base}${route}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(4500)
  return page
}
// The points of the page where the stage says something (reached from the corner), and a few where it says nothing.
// `probe(x, y)` runs right after the tooltip is read, because the dots drift and a later measure is of another frame.
const survey = async (page, grid, probe) => {
  const talk = []
  const quiet = []
  for (const [x, y] of grid) {
    if (await onCard(page, x, y)) continue
    await reach(page, x, y)
    const t = await tipOf(page)
    if (t) talk.push([x, y, t, probe ? await probe(x, y) : undefined])
    else quiet.push([x, y])
  }
  return { talk, quiet }
}
const nearest = (list, x, y, far) => list.filter(c => Math.hypot(c[0] - x, c[1] - y) > far).sort((p, q) => Math.hypot(p[0] - x, p[1] - y) - Math.hypot(q[0] - x, q[1] - y))[0]

const CHECKS = {
  async phantom (browser, base) {
    const page = await open(browser, base, '/', false)
    await page.mouse.move(700, 500)
    await page.mouse.wheel(0, 3000)
    await page.waitForTimeout(2500)
    const { talk } = await survey(page, gridOf(28, 14), (x, y) => inked(page, x, y, REACH))
    const lost = []
    for (const [x, y, t, ink] of talk) if (ink === 0) lost.push(`${x},${y} "${t.slice(0, 40)}"`)
    const clicked = []
    for (const [x, y] of talk.slice(0, 3)) {
      await reach(page, x, y)
      const before = page.url()
      await page.mouse.click(x, y)
      await page.waitForTimeout(1200)
      if (page.url() !== before) { clicked.push(`${x},${y} -> ${page.url()}`); await page.goBack(); await page.waitForTimeout(2500); await page.mouse.move(700, 500); await page.mouse.wheel(0, 3000); await page.waitForTimeout(1500) }
    }
    await page.context().close()
    const bad = [...lost.map(l => `tooltip with nothing drawn near: ${l}`), ...clicked.map(c => `click opened a story: ${c}`)]
    return { bad, note: `${talk.length} points with a tooltip, ${lost.length} with nothing drawn near, ${Math.min(3, talk.length)} clicks, ${clicked.length} opened a story` }
  },
  async stuck (browser, base) {
    const bad = []
    const notes = []
    for (const [name, route] of [['story', '/story?id=1'], ['theme', '/topic?i=3'], ['outlet', '/outlet']]) {
      const page = await open(browser, base, route, true)
      const { talk, quiet } = await survey(page, gridOf(36, 18))
      const clear = quiet.filter((_, i) => i % 6 === 0).slice(0, 12)
      let left = 0
      for (const [x, y, t] of talk) {
        const spot = nearest(clear, x, y, 100)
        if (!spot) continue
        await reach(page, x, y)
        await page.mouse.move(spot[0], spot[1], { steps: 4 })
        await page.waitForTimeout(80)
        const after = await tipOf(page)
        if (after) { left++; if (left <= 3) bad.push(`${name}: "${t.slice(0, 30)}" at ${x},${y} left "${after.slice(0, 30)}" at ${spot[0]},${spot[1]}`) }
      }
      notes.push(`${name} ${talk.length} points, ${left} left a tooltip`)
      await page.context().close()
    }
    return { bad, note: notes.join('; ') }
  },
  async window (browser, base) {
    const bad = []
    for (const [name, route] of [['story', '/story?id=1'], ['theme', '/topic?i=3']]) {
      const page = await open(browser, base, route, true)
      const { talk } = await survey(page, gridOf(26, 13))
      if (!talk.length) { bad.push(`${name}: no point with a tooltip`); await page.context().close(); continue }
      const [x, y] = talk[Math.floor(talk.length / 2)]
      await reach(page, x, y)
      // Out of the window the way a hand does: to its edge, then off it (the page gets pointerleave / pointerout on the document).
      await page.mouse.move(x, 0, { steps: 6 })
      await page.mouse.move(x, -20, { steps: 2 })
      await page.waitForTimeout(250)
      const after = await tipOf(page)
      if (after) bad.push(`${name}: "${after.slice(0, 30)}" stays after the pointer left the window`)
      await page.context().close()
    }
    return { bad, note: '2 pages' }
  },
  async scroll (browser, base) {
    const bad = []
    // Home under the hero is the page that scrolls over the stage (the stage is fixed behind it).
    const page = await open(browser, base, '/', false)
    await page.mouse.move(700, 500)
    await page.mouse.wheel(0, 3000)
    await page.waitForTimeout(2500)
    const { talk } = await survey(page, gridOf(28, 14))
    if (!talk.length) { await page.context().close(); return { bad: ['no point with a tooltip'], note: '' } }
    let moved = 0
    let kept = 0
    for (const [x, y, t] of talk.slice(0, 6)) {
      await reach(page, x, y)
      const before = await page.evaluate(() => window.scrollY)
      await page.mouse.wheel(0, -400)
      await page.waitForTimeout(700)
      if ((await page.evaluate(() => window.scrollY)) !== before) moved++
      const after = await tipOf(page)
      if (after) {
        kept++
        // A tooltip may stay only where the pointer would find it again: a small nudge on the spot asks the stage afresh.
        await page.mouse.move(x + 1, y)
        await page.mouse.move(x, y)
        await page.waitForTimeout(150)
        if (!(await tipOf(page))) bad.push(`"${t.slice(0, 30)}" at ${x},${y} stays after the page scrolled under the pointer`)
      }
      await page.mouse.move(700, 500)
      await page.mouse.wheel(0, 3000)
      await page.waitForTimeout(1200)
    }
    await page.context().close()
    return { bad, note: moved ? `${moved} scrolls, ${kept} kept a tooltip` : 'the page did not scroll (nothing to prove)' }
  },
  async navigate (browser, base) {
    const bad = []
    const page = await open(browser, base, '/topic?i=3', true)
    // A story node of the theme web opens its story on a click; which points are nodes is not in the tooltip, so each point with a tooltip is clicked until one opens a story.
    let opened = null
    for (const [x, y] of gridOf(36, 18)) {
      if (await onCard(page, x, y)) continue
      await reach(page, x, y)
      if (!(await tipOf(page))) continue
      await page.mouse.click(x, y)
      await page.waitForTimeout(400)
      if (page.url().includes('/story')) { opened = [x, y]; break }
    }
    if (!opened) { await page.context().close(); return { bad: ['no click on the theme web opened a story'], note: '' } }
    await page.waitForTimeout(2200)
    const tip = await tipOf(page)
    if (tip) bad.push(`"${tip.slice(0, 30)}" is on the screen after the page changed`)
    await page.context().close()
    return { bad, note: `clicked ${opened.join(',')} -> ${page.url().replace(/^.*?:\d+/, '')}` }
  }
}

const main = async () => {
  const args = process.argv.slice(2)
  const option = name => { const i = args.indexOf(`--${name}`); return i > -1 ? args[i + 1] : undefined }
  const only = option('only')
  const chrome = process.env.CHROME_PATH || '/usr/bin/google-chrome'
  if (!existsSync(chrome)) { console.error(`Chrome not found at ${chrome}. Install Google Chrome or set CHROME_PATH.`); process.exit(2) }
  const root = option('root') ? resolve(option('root')) : fileURLToPath(new URL('../.output/public/', import.meta.url))
  if (!existsSync(join(root, '_nuxt'))) { console.error('The Nuxt build is missing. Run npm run generate first.'); process.exit(2) }
  const port = Number(process.env.NUXT_PORT || 8795)
  const server = await startServer(root, port)
  const { chromium } = createRequire(import.meta.url)('playwright-core')
  const browser = await chromium.launch({ executablePath: chrome })
  let failed = false
  for (const [name, run] of Object.entries(CHECKS)) {
    if (only && only !== name) continue
    let result
    try { result = await run(browser, `http://localhost:${port}`) } catch (error) { result = { bad: [`error: ${String(error.message).split('\n')[0]}`], note: '' } }
    if (result.bad.length) failed = true
    console.log(`${result.bad.length ? 'FAIL' : 'ok  '} ${name}: ${result.note}`)
    result.bad.slice(0, 6).forEach(b => console.log(`     ${b}`))
  }
  await browser.close()
  server.close()
  process.exit(failed ? 1 : 0)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main()
