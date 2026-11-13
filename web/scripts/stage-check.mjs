// The canvases of PlegmaStage at fixed moments, to prove that a change to the stage does not change what it draws.
// Usage (in web/, after npm run generate):
//   npm run check:stage -- --out <dir>                      save the canvases of every scene to <dir>
//   npm run check:stage -- --out <dir> --baseline <dir>     save them, then compare each with the same file in the baseline
// Every scene is loaded signed in as lolovios with reduced motion (no clock in the drawing), then waited on until both canvases stop changing.
// The canvases are read with toDataURL, so the page's cards are not in the image. A pixel differs when any channel differs at all.
// Exit code 1 when a canvas differs, has another size, or is missing from the baseline.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
import { PNG } from 'pngjs'
import { startServer } from './lib/static-server.mjs'
import { compareImages } from './pixel-diff.mjs'

const PHONE = { width: 390, height: 844 }
const DESKTOP = { width: 1440, height: 900 }

// The scenes: one for each mode of the stage (hero, story, theme, outlet, backdrop), a ring switch, the night theme and the phone.
// A scene may click first (`click`, on the hero), switch the ring (`ring`), or sweep the pointer over a grid and keep what the tooltip says at each point (`sweep`; hover does not change the canvases with reduced motion, so the tooltip is what proves the pointer code). Not covered: how hover looks on the canvas, clicks that open a story, flights of the camera, the intro, the dive and hero-frame copies.
export const SCENES = [
  { name: 'home', route: '/' },
  { name: 'home-night', route: '/', theme: 'night' },
  { name: 'home-phone', route: '/', ...PHONE },
  { name: 'story', route: '/story?id=1' },
  { name: 'story-night', route: '/story?id=1', theme: 'night' },
  { name: 'story-phone', route: '/story?id=1', ...PHONE },
  { name: 'story-outlets', route: '/story?id=1', ring: 'outlets' },
  { name: 'story-stance', route: '/story?id=1', ring: 'stance' },
  { name: 'home-explored', route: '/', click: { x: 720, y: 450 }, sweep: true },
  { name: 'story-sweep', route: '/story?id=1', sweep: true },
  { name: 'theme-sweep', route: '/topic?i=3', sweep: true },
  { name: 'outlet-sweep', route: '/outlet', sweep: true },
  { name: 'theme', route: '/topic?i=3' },
  { name: 'theme-night', route: '/topic?i=3', theme: 'night' },
  { name: 'theme-phone', route: '/topic?i=3', ...PHONE },
  { name: 'outlet', route: '/outlet' },
  { name: 'outlet-phone', route: '/outlet', ...PHONE },
  { name: 'backdrop-trends', route: '/trends' },
  { name: 'backdrop-stories', route: '/stories' },
  { name: 'backdrop-media', route: '/media' }
]

const CANVASES = 'canvas.plegma-canvas:not(.plegma-hero-snap):not(.plegma-dive-snap)'
const readCanvases = page => page.evaluate((selector) => [...document.querySelectorAll(selector)].map(c => c.toDataURL('image/png')), CANVASES)

// Wait until both canvases give the same pixels three times in a row, a second apart, and at least three seconds have passed: the fixtures load lazily after the network is idle,
// and a late redraw after two equal reads made a scene differ from itself now and then.
const settle = async (page) => {
  await page.evaluate(() => document.fonts.ready)
  let last = ''
  let same = 0
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(1000)
    const now = (await readCanvases(page)).join('|')
    same = now.length > 200 && now === last ? same + 1 : 0
    if (same >= 2 && i >= 2) return
    last = now
  }
  throw new Error('the canvases did not stop changing in 30 s')
}

// The pointer over a grid of points across the page: what the tooltip says at each (the map's own hover, with the cards and controls excluded by the stage).
// Hover does not change the canvases with reduced motion, so the tooltip is what proves the pointer code. Cards and controls answer too, so the text is the same on both sides of a change.
const sweep = async (page, viewport) => {
  const tips = []
  const read = () => page.evaluate(() => {
    const t = document.querySelector('.tooltip')
    if (!t || getComputedStyle(t).opacity === '0' || getComputedStyle(t).visibility === 'hidden' || getComputedStyle(t).display === 'none') return null
    return t.textContent.trim().replace(/\s+/g, ' ')
  })
  await page.mouse.move(2, 2)
  for (let gy = 0; gy < 12; gy++) {
    for (let gx = 0; gx < 24; gx++) {
      const x = Math.round(((gx + 0.5) / 24) * viewport.width)
      const y = Math.round(((gy + 0.5) / 12) * viewport.height)
      // Two moves, a pixel apart: a single one is now and then not answered before the tooltip is read.
      await page.mouse.move(x - 1, y)
      await page.mouse.move(x, y)
      await page.waitForTimeout(120)
      let tip = await read()
      // Nothing yet: one more look a little later (a point is now and then answered after the first read).
      if (tip === null) { await page.waitForTimeout(100); tip = await read() }
      tips.push(`${x},${y} ${tip}`)
    }
  }
  return tips
}

const shoot = async (browser, base, scene) => {
  const viewport = { width: scene.width || DESKTOP.width, height: scene.height || DESKTOP.height }
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce' })
  await context.addInitScript((theme) => { try { localStorage.setItem('proto-user', 'lolovios'); if (theme) localStorage.setItem('proto-theme', theme) } catch {} }, scene.theme)
  const page = await context.newPage()
  const problems = []
  page.on('pageerror', e => problems.push(String(e.message).split('\n')[0]))
  page.on('console', m => { if (m.type() === 'error') problems.push(m.text().split('\n')[0]) })
  try {
    await page.goto(`${base}${scene.route}`, { waitUntil: 'networkidle' })
    await settle(page)
    if (scene.click) {
      // A click on the hero explores: the wave clears the ground around it (at once with reduced motion) and the camera takes a step.
      await page.mouse.click(scene.click.x, scene.click.y)
      await settle(page)
    }
    if (scene.ring) {
      // The ring switch of the story page: three buttons, in the order outlets, groups, stance.
      const button = page.locator('.orbit-ring-tabs button').nth(['outlets', 'groups', 'stance'].indexOf(scene.ring))
      if (!(await button.count())) return { error: `no ring switch for ${scene.ring}` }
      await button.click()
      // With reduced motion the stage does not redraw for a ring change (it only watches articles, highlight, hover, related and theme stories),
      // so the motion setting is flipped for a moment: the stage redraws when it changes, and settles on the new ring at once.
      // It stays free for longer than the morph of the nodes to their new sectors (MORPH_MS, 900 ms in PlegmaStage), so the morph is over when the picture is taken.
      await page.emulateMedia({ reducedMotion: 'no-preference' })
      await page.waitForTimeout(1500)
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await settle(page)
    }
    const urls = await readCanvases(page)
    const tips = scene.sweep ? await sweep(page, viewport) : undefined
    return { tips, pngs: urls.map(u => PNG.sync.read(Buffer.from(u.split(',')[1], 'base64'))), problems }
  } finally {
    await context.close()
  }
}

const main = async () => {
  const args = process.argv.slice(2)
  const option = name => { const i = args.indexOf(`--${name}`); return i > -1 ? args[i + 1] : undefined }
  const out = option('out') && resolve(option('out'))
  const baseline = option('baseline') && resolve(option('baseline'))
  const only = option('only')
  if (!out) { console.error('Usage: npm run check:stage -- --out <dir> [--baseline <dir>] [--only <scene>]'); process.exit(2) }
  const chrome = process.env.CHROME_PATH || '/usr/bin/google-chrome'
  if (!existsSync(chrome)) { console.error(`Chrome not found at ${chrome}. Install Google Chrome or set CHROME_PATH.`); process.exit(2) }
  const root = fileURLToPath(new URL('../.output/public/', import.meta.url))
  if (!existsSync(join(root, '_nuxt'))) { console.error('The Nuxt build is missing. Run npm run generate first.'); process.exit(2) }
  const port = Number(process.env.NUXT_PORT || 8794)
  const server = await startServer(root, port)
  const { chromium } = createRequire(import.meta.url)('playwright-core')
  const browser = await chromium.launch({ executablePath: chrome })
  mkdirSync(out, { recursive: true })
  let failed = false
  for (const scene of SCENES.filter(s => !only || s.name === only)) {
    let result
    try { result = await shoot(browser, `http://localhost:${port}`, scene) } catch (error) { result = { error: String(error.message).split('\n')[0] } }
    if (result.error) { console.log(`FAIL ${scene.name}: ${result.error}`); failed = true; continue }
    const note = result.problems.length ? `  (console: ${result.problems.slice(0, 2).join(' | ')})` : ''
    const parts = []
    if (result.tips) {
      const file = `${scene.name}-tips.txt`
      writeFileSync(join(out, file), result.tips.join('\n') + '\n')
      const seen = result.tips.filter(t => !t.endsWith(' null')).length
      if (!baseline) parts.push(`${seen} of ${result.tips.length} points with a tooltip`)
      else if (!existsSync(join(baseline, file))) { failed = true; parts.push('TIPS NOT IN BASELINE') }
      else if (readFileSync(join(baseline, file), 'utf8') !== result.tips.join('\n') + '\n') { failed = true; parts.push('TOOLTIPS DIFFER') }
      else parts.push(`tooltips same (${seen} points)`)
    }
    result.pngs.forEach((png, i) => {
      const file = `${scene.name}-${i}.png`
      writeFileSync(join(out, file), PNG.sync.write(png))
      if (!baseline) return parts.push(`${png.width}x${png.height}`)
      if (!existsSync(join(baseline, file))) { failed = true; return parts.push('NOT IN BASELINE') }
      const compared = compareImages(png, PNG.sync.read(readFileSync(join(baseline, file))), 0)
      if (!compared.sameSize) { failed = true; return parts.push('SIZE DIFFERS') }
      if (compared.differ) { failed = true; writeFileSync(join(out, `${scene.name}-${i}-diff.png`), PNG.sync.write(compared.diff)); return parts.push(`${compared.differ} px DIFFER`) }
      parts.push('same')
    })
    if (result.pngs.length !== 2) failed = true
    console.log(`${parts.every(p => p === 'same' || p.startsWith('tooltips same')) && result.pngs.length === 2 ? 'ok  ' : baseline || result.pngs.length !== 2 ? 'FAIL' : 'saved'} ${scene.name}: ${result.pngs.length} canvases ${parts.join(', ')}${note}`)
  }
  await browser.close()
  server.close()
  process.exit(failed ? 1 : 0)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main()
