// The behavior of the shared parts on pages.html (#2): parts A-F, the report frame, a redraw of the route table, the keyboard focus.
// Usage: pnpm check:parts (in web/) or node docs/redesign/prototypes/scripts/parts-check.mjs
// Env: CHROME_PATH (default /usr/bin/google-chrome), PORT (default 8766). Exit code 1 if a test fails.
import { createServer } from 'node:http'
import { readFileSync, existsSync, statSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const root = fileURLToPath(new URL('../', import.meta.url))
const port = Number(process.env.PORT || 8766)
const chrome = process.env.CHROME_PATH || '/usr/bin/google-chrome'
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ico': 'image/x-icon' }
const server = createServer((req, res) => {
  const path = normalize(join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname)))
  if (!path.startsWith(root) || !existsSync(path) || !statSync(path).isFile()) { res.writeHead(404); res.end('not found'); return }
  res.writeHead(200, { 'content-type': types[extname(path)] || 'application/octet-stream' })
  res.end(req.method === 'HEAD' ? undefined : readFileSync(path))
})
await new Promise((resolve) => server.listen(port, resolve))

let chromium
try { ({ chromium } = createRequire(new URL('../../../../web/package.json', import.meta.url))('playwright-core')) } catch { console.error('playwright-core is missing. Run pnpm install in web/.'); server.close(); process.exit(2) }
if (!existsSync(chrome)) { console.error(`Chrome not found at ${chrome}. Install Google Chrome or set CHROME_PATH.`); server.close(); process.exit(2) }
const browser = await chromium.launch({ executablePath: chrome })
let fails = 0
const known = new Set()
const ok = (cond, name, extra = '') => { if (!cond) fails++; console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ` (${extra})` : ''}`) }
const short = (url) => url.replace(/^https?:\/\/[^/]+\//, '')

// Signed in, so pages.html shows the parts. The beacon of the framed report (cdn-cgi/rum) answers 404 on a local server: it is listed, not failed.
async function open (theme, width, lang = 'el') {
  const context = await browser.newContext({ viewport: { width, height: width <= 500 ? 844 : 900 }, reducedMotion: 'reduce' })
  await context.addInitScript(([th, lg]) => { try { localStorage.setItem('proto-theme', th); localStorage.setItem('proto-user', 'lolovios'); localStorage.setItem('apotypos-locale', lg) } catch {} }, [theme, lang])
  const page = await context.newPage()
  const problems = []
  const heads = []
  page.on('console', (m) => { if (m.type() !== 'error') return; const at = m.location().url || ''; if (at.includes('/cdn-cgi/rum')) { known.add(`console 404 ${short(at)}`); return } problems.push(`${m.text().slice(0, 160)} @ ${at}`) })
  page.on('pageerror', (e) => problems.push(e.message.slice(0, 160)))
  page.on('request', (r) => { if (r.method() === 'HEAD') heads.push(short(r.url())) })
  page.on('response', (r) => { if (r.status() >= 400 && r.url().includes('/cdn-cgi/rum')) { known.add(short(r.url())); return } if (r.status() >= 400) problems.push(`HTTP ${r.status()} ${short(r.url())}`) })
  await page.goto(`http://localhost:${port}/pages.html`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  return { context, page, problems, heads }
}

// A Period of the test's own, with a counter of change events.
const addPeriod = (page) => page.evaluate(() => {
  const dates = Array.from({ length: 61 }, (_, i) => new Date(Date.UTC(2026, 7, 1 + i)).toISOString().slice(0, 10))
  const presets = UI.periodPresets(dates)
  window.changes = []
  const el = Parts.Period({ title: 'test', dates, presets, from: presets[0].from, to: presets[0].to, values: dates.map(() => 10), onChange: (r) => window.changes.push(r) })
  el.id = 'brush-test'
  document.querySelector('.page-parts .dash-grid').prepend(el)
})

for (const [theme, width] of [['paper', 1440], ['night', 1440], ['paper', 390], ['night', 390]]) {
  const { context, page, problems } = await open(theme, width)
  const tag = `${theme} ${width}`
  const scroll = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  ok(scroll <= 1, `${tag}: no horizontal page scroll`, `${scroll}px`)
  if (theme === 'paper' && width === 1440) {
    // A: the empty summary shows the empty line, not an empty list.
    const empty = await page.evaluate(() => { const c = document.querySelectorAll('.page-parts .sum')[1]; return { ol: !!c.querySelector('ol'), state: c.querySelector('[data-state="empty"]')?.textContent } })
    ok(!empty.ol && !!empty.state, 'A: 0 findings renders the empty line', empty.state)
    // E: «Δείτε παραδείγματα» opens and closes the quotes; an external link has rel=noopener.
    const btn = page.locator('.hlq .dcard-link')
    const before = await page.evaluate(() => document.querySelector('.hlq-quotes').hidden)
    await btn.click()
    const opened = await page.evaluate(() => ({ hidden: document.querySelector('.hlq-quotes').hidden, exp: document.querySelector('.hlq .dcard-link').getAttribute('aria-expanded') }))
    await btn.click()
    const closed = await page.evaluate(() => document.querySelector('.hlq-quotes').hidden)
    ok(before && !opened.hidden && opened.exp === 'true' && closed, 'E: examples expand and collapse', JSON.stringify({ before, opened, closed }))
    const rels = await page.evaluate(() => [...document.querySelectorAll('.hlq a[href^="http"]')].map((a) => `${a.rel}|${a.target}`))
    ok(rels.length === 3 && rels.every((r) => r === 'noopener|_blank'), 'E: external links have rel=noopener and a new tab', rels.join(','))
    // F: a chip sets aria-pressed and the filter; the switch works from the keyboard. The summary line stays one node.
    await page.evaluate(() => { window.pickedLine = document.querySelector('.fchip-card [aria-live]') })
    await page.locator('.fchip', { hasText: 'Υγεία' }).click()
    const pressed = await page.evaluate(() => [...document.querySelectorAll('.fchip-card .fchip[aria-pressed="true"]')].map((b) => b.textContent))
    const line1 = await page.locator('.fchip-card .dcard-sub').last().textContent()
    ok(pressed.length === 1 && pressed[0].startsWith('Υγεία') && line1.includes('Υγεία'), 'F: a chip sets aria-pressed and calls the handler with its key', `${pressed} / ${line1}`)
    await page.locator('.fchip-card .segmented button').first().focus()
    await page.keyboard.press('Tab')
    await page.keyboard.press('Enter')
    const sw = await page.evaluate(() => ({ line: document.querySelector('.fchip-card [aria-live]').textContent, same: document.querySelector('.fchip-card [aria-live]') === window.pickedLine, focus: document.activeElement.closest('.fchip-card .segmented') ? document.activeElement.textContent : document.activeElement.tagName }))
    ok(sw.line.includes('Ισραήλ'), 'F: the switch is reachable and works by keyboard', sw.line)
    ok(sw.focus === 'Ισραήλ', 'F: the switch keeps the focus after Enter', sw.focus)
    ok(sw.same, 'F: the summary line is the same node after a change, so it is announced')
    await page.locator('.fchip-card .fchip', { hasText: 'Υγεία' }).focus()
    await page.keyboard.press('Tab')
    await page.keyboard.press('Enter')
    const chipFocus = await page.evaluate(() => ({ focus: document.activeElement.className, pressed: document.activeElement.getAttribute('aria-pressed') }))
    ok(chipFocus.focus === 'fchip' && chipFocus.pressed === 'true', 'F: a chip pressed with Enter keeps the focus', JSON.stringify(chipFocus))
    // B: the method block opens.
    await page.locator('.method-summary').click()
    ok(await page.evaluate(() => document.querySelector('.method-details').open), 'B: the method block opens')
    const sizes = await page.evaluate(() => Object.fromEntries(['.sum-text', '.method-heading', '.method-text', '.hlq-list li', '.hlq-angle', '.fchip', '.fchip-n'].map((s) => { const c = getComputedStyle(document.querySelector(s)); return [s, `${c.fontSize} ${c.fontWeight}`] })))
    console.log(`sizes ${JSON.stringify(sizes)}`)
  }
  ok(problems.length === 0, `${tag}: no console errors or 4xx`, problems.join(' | '))
  await context.close()
}

// C: drag, chips and picker set one period; the keyboard focus stays on the pressed control.
{
  const { context, page, problems } = await open('paper', 1440)
  await addPeriod(page)
  await page.waitForTimeout(300)
  const geo = async () => page.evaluate(() => {
    const svg = document.querySelector('#brush-test svg.bar-chart'); const r = svg.getBoundingClientRect(); const f = UI.CHART_FRAME
    const z = parseFloat(getComputedStyle(document.documentElement).zoom) || 1 // the test mouse moves in screen pixels
    return { left: (r.left + f.left) * z, slot: (r.width - f.left - f.right) / 61 * z, y: (r.top + r.height / 2) * z }
  })
  const drag = async (a, b) => {
    const g = await geo()
    await page.mouse.move(g.left + (a + 0.5) * g.slot, g.y); await page.mouse.down()
    await page.mouse.move(g.left + (b + 0.5) * g.slot, g.y, { steps: 5 }); await page.mouse.up()
    await page.waitForTimeout(150)
  }
  await page.locator('#brush-test').scrollIntoViewIfNeeded()
  await page.evaluate(() => { window.sumLine = document.querySelector('#brush-test [aria-live]') })
  await drag(2, 8)
  let c = await page.evaluate(() => window.changes)
  ok(c.length === 1 && c[0].from === '2026-08-03' && c[0].to === '2026-08-09', 'C: dragging over days 3 to 9 sets 3 Aug to 9 Aug, one change event', JSON.stringify(c))
  await drag(20, 12)
  c = await page.evaluate(() => window.changes)
  ok(c.length === 2 && c[1].from === '2026-08-13' && c[1].to === '2026-08-21', 'C: a backwards drag is normalized', JSON.stringify(c[1]))
  ok(await page.locator('#brush-test .fchip').count() === 0, 'C: the presets are only in the picker, not on the card')
  // A preset of the picker, chosen and applied from the keyboard: the brush follows and the focus goes to the picker's button.
  await page.locator('#brush-test .dr-trigger').click()
  await page.locator('#brush-test .dr-preset', { hasText: /Σεπ|Sep/ }).click()
  await page.locator('#brush-test .dr-foot .button-primary').focus()
  await page.keyboard.press('Enter')
  await page.waitForTimeout(150)
  const s = await page.evaluate(() => ({ last: window.changes.at(-1), muted: document.querySelectorAll('#brush-test .bar-col.is-muted').length, trigger: document.querySelector('#brush-test .dr-text').textContent, focus: document.activeElement.className }))
  ok(s.last.from === '2026-09-01' && s.last.to === '2026-09-30' && s.muted === 31, 'C: a preset of the picker updates the brush (31 August columns muted)', JSON.stringify(s))
  ok(s.focus === 'dr-trigger', 'C: after a preset applies, the focus is on the picker\'s button', s.focus)
  // The picker's days: pick 5 to 7 September, apply.
  await page.locator('#brush-test .dr-trigger').click()
  await page.locator('#brush-test .dr-day[data-day="2026-09-05"]').click()
  await page.locator('#brush-test .dr-day[data-day="2026-09-07"]').click()
  await page.locator('#brush-test .dr-foot .button-primary').focus()
  await page.keyboard.press('Enter')
  await page.waitForTimeout(150)
  const p = await page.evaluate(() => ({ last: window.changes.at(-1), n: window.changes.length, muted: document.querySelectorAll('#brush-test .bar-col.is-muted').length, focus: document.activeElement.className, same: document.querySelector('#brush-test [aria-live]') === window.sumLine }))
  ok(p.last.from === '2026-09-05' && p.last.to === '2026-09-07' && p.n === 4 && p.muted === 58, 'C: the picker\'s days update the brush', JSON.stringify(p))
  ok(p.focus === 'dr-trigger', 'C: after the picker applies, the focus is on the picker\'s button', p.focus)
  ok(p.same, 'C: the summary line is the same node after every change, so it is announced')
  // D: a cell under the minimum is masked, with no tooltip value; the others have one.
  const d = await page.evaluate(() => {
    const cells = [...document.querySelectorAll('.hmx td')]
    const masked = cells.filter((td) => td.classList.contains('hmx-masked'))
    return { total: cells.length, masked: masked.length, maskedText: [...new Set(masked.map((td) => td.textContent))], maskedLabel: masked.filter((td) => td.hasAttribute('aria-label')).length, shownLabel: cells.filter((td) => !td.classList.contains('hmx-masked') && td.getAttribute('aria-label')).length }
  })
  ok(d.total === 96 && d.masked > 0 && d.maskedText.join() === '—' && d.maskedLabel === 0 && d.shownLabel === d.total - d.masked, 'D: masked cells show — and no tooltip value', JSON.stringify(d))
  const td = page.locator('.hmx td:not(.hmx-masked)').first()
  await td.hover()
  await page.waitForTimeout(100)
  const tip = await page.evaluate(() => { const t = document.querySelector('.tooltip'); return t && !t.hidden ? t.textContent : null })
  ok(Boolean(tip), 'D: a value cell shows the shared tooltip', tip)
  ok(problems.length === 0, 'C and D: no console errors', problems.join(' | '))
  await context.close()
  for (const theme of ['paper', 'night']) {
    const o = await open(theme, 390)
    const m = await o.page.evaluate(() => { const w = document.querySelector('.hmx .matrix-wrap'); return { inner: w.scrollWidth > w.clientWidth, page: document.documentElement.scrollWidth - window.innerWidth } })
    ok(m.inner && m.page <= 1, `D ${theme} 390: 12 × 8 scrolls inside the card, not the page`, JSON.stringify(m))
    await o.context.close()
  }
}

// The report frame: the sample loads, takes its height, shrinks again after a narrow window, and a missing document shows the error state.
{
  const { context, page, problems } = await open('paper', 1440)
  await page.locator('.frame').scrollIntoViewIfNeeded()
  await page.waitForTimeout(1500)
  const geom = () => page.evaluate(() => { const fr = document.querySelector('.frame iframe.frame-doc'); return { h: Math.round(fr.getBoundingClientRect().height), doc: Math.round(fr.contentDocument.documentElement.getBoundingClientRect().height) } })
  const f = await page.evaluate(() => { const fr = document.querySelector('.frame iframe.frame-doc'); const a = document.querySelector('.frame .dcard-link'); const b = document.querySelector('.frame .back-button')
    return { src: fr && fr.getAttribute('src'), href: a.getAttribute('href'), target: a.target, rel: a.rel, back: b.getAttribute('href'), backLabel: b.getAttribute('aria-label') } })
  const g1 = await geom()
  ok(f.src === 'reports/france-riots/compare.html' && Math.abs(g1.h - g1.doc) <= 2, 'Frame: the sample report loads and the frame takes its height', JSON.stringify({ ...f, ...g1 }))
  ok(f.href === f.src && f.target === '_blank' && f.rel === 'noopener', 'Frame: «open alone» opens the same URL in a new tab with rel=noopener', JSON.stringify(f))
  ok(f.back === '/analysis/france' && Boolean(f.backLabel), 'Frame: the back arrow has its link and its label', JSON.stringify(f))
  await page.setViewportSize({ width: 700, height: 900 })
  await page.waitForTimeout(800)
  const g2 = await geom()
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.waitForTimeout(800)
  const g3 = await geom()
  ok(g2.h > g1.h && Math.abs(g3.h - g1.h) <= 2, 'Frame: the frame grows in a narrow window and shrinks back in a wide one', JSON.stringify({ g1, g2, g3 }))
  ok(problems.length === 0, 'Frame: no console errors or 4xx beside the known beacon', problems.join(' | '))
  const missing = []
  page.on('response', (r) => { if (r.url().endsWith('/reports/missing.html')) missing.push(r.request().method()) })
  await page.evaluate(() => { const el = Parts.Frame({ src: 'reports/missing.html', title: 'missing', back: '#' }); el.id = 'frame-missing'; document.querySelector('.page-parts .dash-grid').prepend(el) })
  await page.waitForTimeout(500)
  const e1 = await page.evaluate(() => ({ err: !!document.querySelector('#frame-missing [data-state="error"]'), iframe: !!document.querySelector('#frame-missing iframe') }))
  await page.locator('#frame-missing [data-state="error"] button').click()
  await page.waitForTimeout(500)
  const e2 = await page.evaluate(() => !!document.querySelector('#frame-missing [data-state="error"]'))
  ok(e1.err && !e1.iframe && e2 && missing.join() === 'HEAD,HEAD', 'Frame: a missing document shows the error state, and retry asks again', JSON.stringify({ e1, e2, missing }))
  await context.close()
}

// The route table's type filter draws only the filter bar and the table: the parts keep their state, the frame does not reload,
// and the bar keeps its place in the document. (Its place on screen can change: a shorter table makes the page shorter, as on main.)
{
  const { context, page, problems, heads } = await open('paper', 1440)
  await page.locator('.fchip-card .fchip', { hasText: 'Υγεία' }).click()
  await page.evaluate(() => { window.frameNode = document.querySelector('.frame iframe.frame-doc') })
  const barAt = () => page.evaluate(() => Math.round([...document.querySelectorAll('.filter-bar')].at(-1).getBoundingClientRect().top * (parseFloat(getComputedStyle(document.documentElement).zoom) || 1) + window.scrollY))
  await page.evaluate(() => { const b = [...document.querySelectorAll('.filter-bar')].at(-1); window.scrollTo(0, window.scrollY + b.getBoundingClientRect().top * (parseFloat(getComputedStyle(document.documentElement).zoom) || 1)) })
  await page.waitForTimeout(200)
  const before = { at: await barAt(), heads: heads.length }
  await page.locator('.filter-bar').last().locator('.segmented button').nth(1).click()
  await page.waitForTimeout(1500)
  const after = await page.evaluate(() => ({ sameFrame: document.querySelector('.frame iframe.frame-doc') === window.frameNode, chip: document.querySelector('.fchip-card .fchip[aria-pressed="true"]')?.textContent }))
  const at = await barAt()
  ok(after.sameFrame && heads.length === before.heads, 'Table filter: the report frame is not rebuilt and sends no new request', JSON.stringify({ ...after, heads: heads.length - before.heads }))
  ok(Math.abs(at - before.at) <= 2, 'Table filter: the filter bar keeps its place in the document', `${before.at} → ${at}`)
  ok(after.chip?.startsWith('Υγεία'), 'Table filter: the parts keep their state', after.chip)
  ok(problems.length === 0, 'Table filter: no console errors', problems.join(' | '))
  await context.close()
}

// English: every part has its text.
{
  const { context, page, problems } = await open('paper', 1440, 'en')
  const raw = await page.evaluate(() => [...document.querySelectorAll('.page-parts *')].map((e) => [...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('')).filter((x) => /\b(parts|pages)\.[a-z]/.test(x)))
  ok(raw.length === 0, 'en: no raw message keys in the parts section', raw.slice(0, 3).join(' | '))
  const heading = await page.locator('.page-parts h2#page-parts-title').textContent()
  ok(heading === 'Parts', 'en: the section heading is English', heading)
  ok(problems.length === 0, 'en: no console errors', problems.join(' | '))
  await context.close()
}

await browser.close()
server.close()
console.log(`Known 4xx, not ours: ${[...known].join(', ') || 'none'}`)
console.log(fails ? `${fails} failed` : 'All parts checks pass.')
process.exit(fails ? 1 : 0)
