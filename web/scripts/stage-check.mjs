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
// A scene may switch the ring (`ring`) after the page has settled. Not covered: hover states (with reduced motion a pointer move changes nothing on the canvases), flights of the camera, the intro, the dive and hero-frame copies.
export const SCENES = [
  { name: 'home', route: '/' },
  { name: 'home-night', route: '/', theme: 'night' },
  { name: 'home-phone', route: '/', ...PHONE },
  { name: 'story', route: '/story?id=1' },
  { name: 'story-night', route: '/story?id=1', theme: 'night' },
  { name: 'story-phone', route: '/story?id=1', ...PHONE },
  { name: 'story-outlets', route: '/story?id=1', ring: 'outlets' },
  { name: 'story-stance', route: '/story?id=1', ring: 'stance' },
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

// Wait until both canvases give the same pixels twice in a row, a second apart.
const settle = async (page) => {
  await page.evaluate(() => document.fonts.ready)
  let last = ''
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(1000)
    const now = (await readCanvases(page)).join('|')
    if (now.length > 200 && now === last) return
    last = now
  }
  throw new Error('the canvases did not stop changing in 30 s')
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
    return { pngs: urls.map(u => PNG.sync.read(Buffer.from(u.split(',')[1], 'base64'))), problems }
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
    console.log(`${parts.includes('same') && parts.every(p => p === 'same') && result.pngs.length === 2 ? 'ok  ' : baseline || result.pngs.length !== 2 ? 'FAIL' : 'saved'} ${scene.name}: ${result.pngs.length} canvases ${parts.join(', ')}${note}`)
  }
  await browser.close()
  server.close()
  process.exit(failed ? 1 : 0)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main()
