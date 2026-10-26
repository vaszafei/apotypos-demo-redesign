// Checks of APO-151, APO-161, APO-168 and APO-180 "Done when". Usage:
//   python3 -m http.server 8765 --bind 127.0.0.1 --directory docs/redesign/prototypes
//   PW_CORE=<path to playwright-core> node docs/redesign/prototypes/scripts/check.mjs http://127.0.0.1:8765 docs/redesign/prototypes/checks
// Needs Chrome (channel "chrome"). Writes results.json and the screenshots in the out folder.
import fs from 'node:fs'
import path from 'node:path'

const { chromium } = await import(process.env.PW_CORE ? path.resolve(process.env.PW_CORE, 'index.mjs') : 'playwright-core')
const [base, outDir] = process.argv.slice(2)
const PAGES = ['index', 'gaza', 'groups', 'group', 'outlet', 'fingerprints', 'media', 'methodology', 'entities', 'topics-v2', 'stories-v2']
const WIDTHS = [1440, 390]
fs.mkdirSync(path.join(outDir, 'screenshots'), { recursive: true })

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const results = { base, checkedAt: new Date().toISOString(), checks: [] }
const record = (name, pass, detail = {}) => { results.checks.push({ name, pass, ...detail }); console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${pass ? '' : ' ' + JSON.stringify(detail).slice(0, 400)}`) }

async function open (url, width = 1440) {
  const context = await browser.newContext({ viewport: { width, height: 900 } })
  const page = await context.newPage()
  const requests = []
  const errors = []
  page.on('request', (r) => requests.push(r.url()))
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(200)
  return { page, context, requests, errors }
}

// Text size and contrast of each visible element that has its own text.
const TEXT_AUDIT = () => {
  const parse = (c) => { const m = c.match(/[\d.]+/g).map(Number); return { r: m[0], g: m[1], b: m[2], a: m[3] ?? 1 } }
  const lum = ({ r, g, b }) => [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0)
  const blend = (top, under) => ({ r: top.r * top.a + under.r * (1 - top.a), g: top.g * top.a + under.g * (1 - top.a), b: top.b * top.a + under.b * (1 - top.a), a: 1 })
  const backgroundOf = (el) => {
    const layers = []
    for (let n = el; n; n = n.parentElement) {
      const bg = parse(getComputedStyle(n).backgroundColor)
      if (bg.a > 0) { layers.push(bg); if (bg.a === 1) break }
    }
    return layers.reduceRight((under, top) => blend(top, under), { r: 255, g: 255, b: 255, a: 1 })
  }
  const small = []
  const low = []
  let count = 0
  const all = [...document.querySelectorAll('body *')]
  for (const el of all) {
    const own = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim()).map((n) => n.textContent.trim()).join(' ')
    if (!own) continue
    const style = getComputedStyle(el)
    const box = el.getBoundingClientRect()
    if (style.visibility === 'hidden' || style.display === 'none' || box.width === 0 || box.height === 0 || el.closest('[hidden], .visually-hidden, .tooltip')) continue
    count++
    const size = parseFloat(style.fontSize)
    const scale = el instanceof SVGElement && el.ownerSVGElement ? el.ownerSVGElement.getBoundingClientRect().width / (el.ownerSVGElement.viewBox.baseVal?.width || el.ownerSVGElement.getBoundingClientRect().width) : 1
    if (size * scale < 12) small.push({ text: own.slice(0, 40), size: size * scale })
    const fg = parse(el instanceof SVGElement ? style.fill : style.color)
    const bg = backgroundOf(el)
    const color = blend(fg, bg)
    const ratio = (Math.max(lum(color), lum(bg)) + 0.05) / (Math.min(lum(color), lum(bg)) + 0.05)
    if (ratio < 4.5) low.push({ text: own.slice(0, 40), ratio: Math.round(ratio * 100) / 100, color: style.color, tag: el.tagName })
  }
  return { count, small, low, scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth }
}

// document.fonts.check() is true for a family that does not exist, so read the FontFace status,
// and compare the width of a Greek text with the width in the fallback font.
const FONT_AUDIT = () => {
  const status = (family) => [...document.fonts].find((f) => f.family.replace(/"/g, '') === family)?.status ?? 'missing'
  const ctx = document.createElement('canvas').getContext('2d')
  const width = (font) => { ctx.font = font; return ctx.measureText('Αποτύπωμα ελληνικών μέσων 205.204').width }
  const first = (el) => getComputedStyle(el).fontFamily.split(',')[0].replace(/"/g, '').trim()
  const text = first(document.body)
  const heading = first(document.querySelector('h1'))
  return {
    choice: document.documentElement.dataset.font, text, heading,
    textStatus: status(text), headingStatus: status(heading),
    textDiffers: width(`16px "${text}", monospace`) !== width('16px monospace'),
    headingDiffers: width(`16px "${heading}", monospace`) !== width('16px monospace')
  }
}
const FONT_OK = (f) => f.textStatus === 'loaded' && f.headingStatus === 'loaded' && f.textDiffers && f.headingDiffers

// 1. Screenshots, text size, contrast, network and horizontal scroll for each page and width.
for (const name of PAGES) {
  for (const width of WIDTHS) {
    const { page, context, requests, errors } = await open(`${base}/${name}.html`, width)
    await page.screenshot({ path: path.join(outDir, 'screenshots', `${name}-${width}.png`), fullPage: true })
    const audit = await page.evaluate(TEXT_AUDIT)
    const outside = requests.filter((u) => !u.startsWith(base + '/') && !u.startsWith('data:'))
    record(`${name} ${width}px: no script error`, errors.length === 0, { errors })
    record(`${name} ${width}px: no text below 12 px`, audit.small.length === 0, { textElements: audit.count, small: audit.small })
    record(`${name} ${width}px: text contrast 4.5 to 1 or more`, audit.low.length === 0, { textElements: audit.count, low: audit.low })
    record(`${name} ${width}px: no request outside the prototype folder`, outside.length === 0, { requests: requests.length, outside })
    record(`${name} ${width}px: no horizontal page scroll`, audit.scrollWidth <= audit.innerWidth, { scrollWidth: audit.scrollWidth, innerWidth: audit.innerWidth })
    const fonts = await page.evaluate(FONT_AUDIT)
    record(`${name} ${width}px: the default typeface (IBM Plex Sans) loaded and used for Greek`, FONT_OK(fonts) && fonts.text === 'IBM Plex Sans', fonts)
    await context.close()
  }
}

// 1b. Text size and contrast on the other pages and variants at 1440 px and 390 px.
{
  const variants = ['pages.html', '404.html', 'index.html?lang=en', 'outlet.html?lang=en', 'methodology.html?lang=en',
    ...PAGES.flatMap((n) => [`${n}.html?state=empty`, `${n}.html?state=error`]), 'outlet.html?state=bad', 'group.html?state=bad', 'group.html?g=skai', 'groups.html?lang=en', 'fingerprints.html?lang=en']
  const failed = []
  let elements = 0
  for (const url of variants) {
    for (const width of WIDTHS) {
      const { page, context, errors } = await open(`${base}/${url}`, width)
      const audit = await page.evaluate(TEXT_AUDIT)
      elements += audit.count
      if (audit.small.length || audit.low.length || errors.length || audit.scrollWidth > audit.innerWidth) failed.push({ url, width, small: audit.small, low: audit.low, errors })
      await context.close()
    }
  }
  // The Media tabs render on click.
  for (const width of WIDTHS) {
    const { page, context } = await open(`${base}/media.html`, width)
    for (const tab of [2, 3, 4]) {
      await page.click(`.filter-bar .segmented button:nth-child(${tab})`)
      const audit = await page.evaluate(TEXT_AUDIT)
      elements += audit.count
      if (audit.small.length || audit.low.length || audit.scrollWidth > audit.innerWidth) failed.push({ url: `media.html tab ${tab}`, width, small: audit.small, low: audit.low })
    }
    await context.close()
  }
  record('variants (pages, 404, English, states, Media tabs): text 12 px or more, contrast 4.5 to 1, no page scroll', failed.length === 0, { variants: variants.length * WIDTHS.length + 6, textElements: elements, failed })
}

// 2. Phone: the sidebar is a drawer, closed and inert. The menu button opens it. The rest of the page is inert while it is open.
{
  const { page, context } = await open(`${base}/index.html`, 390)
  const closed = await page.evaluate(() => { const s = document.getElementById('sidebar'); return { right: s.getBoundingClientRect().right, inert: s.inert } })
  await page.click('.menu-button')
  await page.waitForTimeout(400)
  const open_ = await page.evaluate(() => { const s = document.getElementById('sidebar'); return { left: s.getBoundingClientRect().left, inert: s.inert, mainInert: document.querySelector('.main-column').inert, focus: document.activeElement.className } })
  await page.screenshot({ path: path.join(outDir, 'screenshots', 'index-390-drawer.png') })
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  const after = await page.evaluate(() => ({ inert: document.getElementById('sidebar').inert, focus: document.activeElement.className }))
  const ok = closed.right <= 0 && closed.inert && open_.left >= 0 && !open_.inert && open_.mainInert && open_.focus.includes('sidebar-close') && after.inert && after.focus.includes('menu-button')
  record('390px: the sidebar is a drawer that keeps the focus, and Escape closes it', ok, { closed, open: open_, after })
  await context.close()
}

// 3. The sidebar has 6 items and the footer group, with no section heading. Each item has a bundled icon and opens a page or its row in pages.html.
{
  const { page, context } = await open(`${base}/index.html`)
  const nav = await page.evaluate(() => [...document.querySelectorAll('#sidebar .nav-link')].map((a) => ({ href: a.getAttribute('href'), icon: !!a.querySelector('svg') })))
  const headings = await page.evaluate(() => document.querySelectorAll('#sidebar h2, #sidebar .nav-section-label').length)
  const main = await page.evaluate(() => document.querySelectorAll('#sidebar .nav-main .nav-link').length)
  record('sidebar: 6 items, 3 footer links and no section heading', main === 6 && nav.length === 9 && headings === 0, { main, total: nav.length, headings })
  const heights = await page.evaluate(() => [...document.querySelectorAll('#sidebar .nav-main .nav-link')].map((a) => Math.round(a.getBoundingClientRect().height)))
  record('sidebar: each item is 40 px high or more', heights.every((x) => x >= 40), { heights })
  const top = await page.evaluate(() => ({ header: getComputedStyle(document.querySelector('.header-bar')).display, crumbs: !!document.querySelector('.breadcrumbs') }))
  record('1440px: no top bar, and no breadcrumbs on Home', top.header === 'none' && !top.crumbs, top)
  record('sidebar: text only, no icon in a sidebar item', nav.every((n) => !n.icon), { items: nav.length, withIcon: nav.filter((n) => n.icon).length })
  const broken = []
  for (const { href } of nav) {
    const target = await open(`${base}/${href}`)
    const hash = href.split('#')[1]
    const ok = await target.page.evaluate((id) => (id ? !!document.getElementById(id) : !!document.querySelector('h1')), hash)
    if (!ok || target.errors.length) broken.push({ href, errors: target.errors })
    await target.context.close()
  }
  record('sidebar: each item opens a page or its row in pages.html', broken.length === 0, { items: nav.length, broken })
  await context.close()
}

// 3b. The tab bar. A tab page shows the tabs of its sidebar item, and the item and the tab are current. A detail page has no tab bar.
{
  const expected = { 'media.html': ['media', 3], 'fingerprints.html': ['media', 3], 'groups.html': ['media', 3], 'gaza.html': ['world', 4] }
  const problems = []
  let tabs = 0
  for (const [file, [, count]] of Object.entries(expected)) {
    const { page, context, errors } = await open(`${base}/${file}`)
    const info = await page.evaluate(() => ({
      links: [...document.querySelectorAll('.section-tabs a')].map((a) => ({ href: a.getAttribute('href'), current: a.getAttribute('aria-current') })),
      itemsCurrent: [...document.querySelectorAll('#sidebar .nav-main [aria-current="page"]')].length
    }))
    tabs += info.links.length
    if (info.links.length !== count || info.links.filter((l) => l.current).length !== 1 || info.itemsCurrent !== 1 || errors.length) problems.push({ file, info, errors })
    for (const { href } of info.links) {
      const target = await open(`${base}/${href}`)
      const hash = href.split('#')[1]
      const ok = await target.page.evaluate((id) => (id ? !!document.getElementById(id) : !!document.querySelector('h1')), hash)
      if (!ok || target.errors.length) problems.push({ file, href, errors: target.errors })
      await target.context.close()
    }
    await context.close()
  }
  for (const file of ['outlet.html', 'group.html']) {
    const detail = await open(`${base}/${file}`)
    const d = await detail.page.evaluate(() => ({ tabBar: !!document.querySelector('.section-tabs'), current: document.querySelector('#sidebar .nav-main [aria-current="page"]')?.textContent }))
    if (d.tabBar || d.current !== 'Μέσα') problems.push({ file, d })
    await detail.context.close()
  }
  const home = await open(`${base}/index.html`)
  const hasTabs = await home.page.evaluate(() => !!document.querySelector('.section-tabs'))
  if (hasTabs) problems.push({ file: 'index.html', hasTabs })
  await home.context.close()
  record('tab bar: tabs and current item on 4 tab pages, none on the 2 detail pages and on Home, and each tab opens', problems.length === 0, { tabs, problems })
}

// 4. The table of pages: 58 routes, 40 with a type, 18 removed.
{
  const { page, context } = await open(`${base}/pages.html`)
  // Count the rows in the DOM. The second cell is the page type.
  const count = () => page.evaluate(() => document.querySelectorAll('.data-table tbody tr').length)
  const all = await count()
  await page.click('.segmented button:last-child')
  const removed = await count()
  record('pages.html: 58 of 58 routes, 40 with a type and 18 removed', all === 58 && removed === 18 && all - removed === 40, { rows: all, removed, typed: all - removed })
  await context.close()
}

// 4b. The entities page (APO-167): 7 cards, a link for each of the 7 entity types, the 7 persons and the 12 owners of the data.
// A built page opens from its link, and a page that is not built opens the 404 page. pages.html links to the page.
{
  const { page, context } = await open(`${base}/entities.html`)
  const info = await page.evaluate(() => ({
    cards: [...document.querySelectorAll('.entity-card[data-entity]')].map((c) => c.dataset.entity),
    links: [...document.querySelectorAll('.entity-link')].map((a) => ({ type: a.dataset.entity, page: a.dataset.page, href: a.getAttribute('href'), text: a.textContent.trim() })),
    persons: document.querySelectorAll('.entity-card[data-entity="person"] .entity-link[data-entity="person"]').length,
    owners: document.querySelectorAll('.entity-card[data-entity="owner"] .entity-link[data-entity="owner"]').length
  }))
  const types = new Set(info.links.map((l) => l.type))
  const wanted = ['outlet', 'group', 'owner', 'topic', 'story', 'article', 'person']
  record('entities.html: 7 entity cards, a link for each of 7 entity types, the 7 persons and the 12 owners of the data',
    info.cards.join() === 'outlet,group,owner,topic,story,article,person' && wanted.every((x) => types.has(x)) && info.persons === 7 && info.owners === 12, { cards: info.cards, types: [...types], persons: info.persons, owners: info.owners })
  const built = info.links.find((l) => l.page === 'built' && l.type === 'group')
  const missing = info.links.find((l) => l.page === 'missing')
  let builtTitle = ''
  let missingTitle = ''
  if (built) { await page.goto(`${base}/${built.href}`, { waitUntil: 'networkidle' }); builtTitle = await page.title() }
  if (missing) { await page.goto(`${base}/${missing.href}`, { waitUntil: 'networkidle' }); missingTitle = await page.title() }
  record('entities.html: a built page opens from its link and a page that is not built opens the 404 page',
    Boolean(built && missing) && builtTitle.startsWith(built.text) && missingTitle.startsWith('Η σελίδα δεν υπάρχει'), { built, builtTitle, missing, missingTitle })
  const pagesPage = await open(`${base}/pages.html`)
  const linked = await pagesPage.page.locator('a[href="entities.html"]').count()
  record('pages.html links to entities.html', linked === 1, { links: linked })
  await pagesPage.context.close()
  await context.close()
}

// 5. The period rule: Home shows the RangeControl and the update date. Gaza shows no date, and each KPI hint shows the period.
{
  const home = await open(`${base}/index.html`)
  const h = await home.page.evaluate(() => ({ range: !!document.querySelector('[data-testid="range-control"]'), updated: document.querySelector('[data-testid="updated-at"]')?.textContent }))
  record('Home: RangeControl and update date in the header', h.range && !!h.updated, h)
  await home.page.click('.segmented button:nth-child(3)')
  const sep = await home.page.evaluate(() => document.querySelector('[data-kpi="K01"] .kpi-value').textContent)
  record('Home: the range changes the KPIs', sep !== '205.204', { september: sep })
  await home.context.close()
  const gaza = await open(`${base}/gaza.html`)
  const g = await gaza.page.evaluate(() => ({
    range: !!document.querySelector('[data-testid="range-control"]'),
    updated: !!document.querySelector('[data-testid="updated-at"]'),
    hints: [...document.querySelectorAll('.kpi-tile .kpi-hint')].map((x) => x.textContent)
  }))
  record('Gaza: no date in the header, and each KPI hint shows the period', !g.range && !g.updated && g.hints.length === 3 && g.hints.every((x) => x.includes('1 Αυγ 2026 – 30 Σεπ 2026')), g)
  await gaza.context.close()
}

// 6. Empty and error states. A Detail page shows ErrorPage. The body {} gives ErrorPage 500, not a crash (S3).
{
  const cases = []
  for (const name of PAGES) {
    for (const state of ['empty', 'error']) {
      if (name === 'methodology' && state === 'empty') continue
      cases.push([`${name}.html?state=${state}`, state === 'empty' ? '[data-state="empty"]' : (['outlet', 'group', 'methodology'].includes(name) ? '[data-state="error-500"]' : '[data-state="error"]')])
    }
  }
  cases.push(['outlet.html?state=bad', '[data-state="error-500"]'], ['outlet.html?state=notfound', '[data-state="error-404"]'], ['group.html?state=bad', '[data-state="error-500"]'], ['group.html?state=notfound', '[data-state="error-404"]'], ['group.html?g=nope', '[data-state="error-404"]'], ['404.html', '[data-state="error-404"]'])
  const failed = []
  for (const [url, selector] of cases) {
    const { page, context, errors } = await open(`${base}/${url}`)
    if (!(await page.$(selector)) || errors.length) failed.push({ url, selector, errors })
    if (url.endsWith('state=empty') || url.endsWith('state=error')) await page.screenshot({ path: path.join(outDir, 'screenshots', url.replace(/\.html\?state=/, '-state-') + '.png') })
    await context.close()
  }
  record('each page shows its empty state and its error state', failed.length === 0, { cases: cases.length, failed })
}

// 6b. Prototype only: each font candidate of the switch loads and covers the Greek text.
{
  const failed = []
  const seen = []
  for (const key of ['plex', 'manrope', 'commissioner', 'inter']) {
    const { page, context } = await open(`${base}/index.html?font=${key}`)
    const f = await page.evaluate(FONT_AUDIT)
    seen.push(f)
    if (!FONT_OK(f) || f.choice !== key) failed.push(f)
    await context.close()
  }
  record('font switch: the 4 candidates load and are used for Greek', failed.length === 0, { seen, failed })
}

// 8. APO-161: Media and Ownership are one item. Display rules, links between outlet and group, one count, the three views.
{
  // 8a. At most 3 KPI tiles on each page of Media.
  const tiles = {}
  for (const file of ['media.html', 'groups.html', 'group.html', 'outlet.html', 'fingerprints.html']) {
    const { page, context } = await open(`${base}/${file}`)
    tiles[file] = await page.evaluate(() => document.querySelectorAll('.kpi-tile').length)
    await context.close()
  }
  record('Media pages: 3 KPI tiles at most, and exactly 3 on Overview, Ownership, group and outlet pages', Object.values(tiles).every((n) => n <= 3) && ['media.html', 'groups.html', 'group.html', 'outlet.html'].every((f) => tiles[f] === 3), { tiles })
  {
    const { page, context, requests } = await open(`${base}/group.html?g=skai`)
    const ids = await page.evaluate(() => [...document.querySelectorAll('.kpi-tile')].map((x) => x.dataset.kpi))
    const api = requests.filter((u) => u.includes('/api/'))
    record('group page: shows K50, K51 and K52, and makes no API request', ids.join() === 'K50,K51,K52' && api.length === 0, { ids, requests: requests.length, api })
    await context.close()
  }

  // 8b. K05 and K06 count the same outlets (36), and the Overview table lists a group link for an outlet with a group.
  {
    const { page, context } = await open(`${base}/media.html`)
    const k = await page.evaluate(() => ({ k05: document.querySelector('[data-kpi="K05"] .kpi-value').textContent, k06: document.querySelector('[data-kpi="K06"] .kpi-value').textContent, header: [...document.querySelectorAll('.data-table th')].map((x) => x.textContent) }))
    await page.click('.table-more button')
    const rows = await page.evaluate(() => [...document.querySelectorAll('.data-table tbody tr')].map((r) => ({ outlet: r.children[1].textContent, group: r.children[2].textContent, link: r.children[2].querySelector('a')?.getAttribute('href') })))
    const withLink = rows.filter((r) => r.link)
    const ownerless = rows.filter((r) => !r.link)
    record('Overview: K05 and K06 count 36 outlets, a column Όμιλος, and "not recorded" for an outlet without a group', k.k05 === '36' && k.k06 === '202.253' && k.header.includes('Όμιλος') && rows.length === 36 && withLink.length === 21 && ownerless.length === 15 && ownerless.every((r) => r.group === 'δεν έχει καταγραφεί'), { k, rows: rows.length, withLink: withLink.length, ownerless: ownerless.length })
    // 8c. The link opens the group page, and the group page lists the outlets and links back to the table of groups.
    await page.goto(`${base}/${withLink[0].link}`, { waitUntil: 'networkidle' })
    const g = await page.evaluate(() => ({ h1: document.querySelector('h1').textContent, outlets: document.querySelectorAll('.data-table')[0]?.querySelectorAll('tbody tr').length, crumb: document.querySelector('.breadcrumbs a[href="groups-v2.html"]')?.textContent }))
    record('group page: opens from the outlet table, lists its outlets and has a breadcrumb to the table of groups', !!g.h1 && g.outlets > 0 && g.crumb === 'Ιδιοκτησία ΜΜΕ', g)
    await context.close()
  }

  // 8d. The outlet page links to its group and lists the other outlets of the group.
  {
    const { page, context } = await open(`${base}/outlet.html`)
    const o = await page.evaluate(() => ({ link: document.querySelector('.fact-list a')?.getAttribute('href'), siblings: document.querySelectorAll('.plain-list')[0]?.querySelectorAll('li').length, tiles: document.querySelectorAll('.kpi-tile').length }))
    record('outlet page: group link, 6 other outlets of Politis Group, 3 tiles', o.link === 'group.html?g=politis' && o.siblings === 6 && o.tiles === 3, o)
    await context.close()
  }

  // 8e. The table of groups: 3 KPIs from the static files, the share of known owners, the switch and the map (desktop only).
  for (const width of WIDTHS) {
    const { page, context } = await open(`${base}/groups.html`, width)
    const info = await page.evaluate(() => ({
      kpis: [...document.querySelectorAll('.kpi-tile')].map((x) => [x.dataset.kpi, x.querySelector('.kpi-value')?.textContent]),
      switchShown: !!document.querySelector('.view-controls') && getComputedStyle(document.querySelector('.view-controls')).display !== 'none',
      rows: document.querySelectorAll('.data-table tbody tr').length,
      banner: !!document.querySelector('.data-notice'),
      listShown: getComputedStyle(document.querySelector('.view-list')).display !== 'none'
    }))
    let mapOk = true
    if (width === 1440) {
      await page.click('.view-controls .segmented button:nth-child(2)')
      mapOk = await page.evaluate(() => getComputedStyle(document.querySelector('.view-map')).display !== 'none' && getComputedStyle(document.querySelector('.view-list')).display === 'none' && document.querySelectorAll('.owner-row').length === 9)
      const audit = await page.evaluate(TEXT_AUDIT)
      record(`groups map ${width}px: 9 owner rows, text 12 px or more, contrast 4.5 to 1, no page scroll`, mapOk && audit.small.length === 0 && audit.low.length === 0 && audit.scrollWidth <= audit.innerWidth, { small: audit.small, low: audit.low })
      await page.screenshot({ path: path.join(outDir, 'screenshots', 'groups-map-1440.png'), fullPage: true })
    }
    const kv = Object.fromEntries(info.kpis)
    record(`groups ${width}px: 3 KPIs (8 groups, 67,2% known owner, 42,6% top-3), 8 rows, no banner, switch on desktop only, list on a phone`,
      info.kpis.length === 3 && kv.K35 === '8' && kv.K49 === '67,2%' && kv.K37 === '42,6%' && info.rows === 8 && !info.banner && info.switchShown === (width === 1440) && info.listShown, info)
    await context.close()
  }

  // 8f. Fingerprints: three views, each with its own line (persons, period, source). The two person views have two measures.
  for (const width of WIDTHS) {
    const { page, context } = await open(`${base}/fingerprints.html`, width)
    const seen = []
    const read = () => page.evaluate(() => ({ line: document.querySelector('[data-testid="view-line"]')?.textContent, cols: document.querySelectorAll('.matrix thead th').length - 1, rows: document.querySelectorAll('.matrix tbody tr').length }))
    seen.push(['people attention', await read()])
    await page.click('.view-controls .segmented:nth-child(2) button:nth-child(2)')
    seen.push(['people stance', await read()])
    await page.click('.view-controls .segmented:nth-child(1) button:nth-child(2)')
    seen.push(['extended stance', await read()])
    const stanceHeads = await page.evaluate(() => [...document.querySelectorAll('.matrix thead th')].slice(1).map((x) => x.textContent))
    await page.click('.view-controls .segmented:nth-child(2) button:nth-child(1)')
    seen.push(['extended attention', await read()])
    const attentionHeads = await page.evaluate(() => [...document.querySelectorAll('.matrix thead th')].slice(1).map((x) => x.textContent))
    await page.click('.view-controls .segmented:nth-child(1) button:nth-child(3)')
    seen.push(['interests', await read()])
    const hasMode = await page.evaluate(() => document.querySelectorAll('.view-controls .segmented').length)
    const audit = await page.evaluate(TEXT_AUDIT)
    const [pa, ps, es, ea, ints] = seen.map((x) => x[1])
    const ok = pa.cols === 7 && pa.rows === 30 && pa.line.includes('7 πρόσωπα') && pa.line.includes('1 Αυγ 2026 – 30 Σεπ 2026') && ps.cols === 7
      && ea.cols === 15 && ea.rows === 33 && es.cols === 15 && es.rows > 0 && stanceHeads.join() === attentionHeads.join() && ps.rows === 30 && ea.line.includes('15 πρόσωπα') && ea.line.includes('90 ημέρες έως 30 Σεπ 2026') && es.line.includes('365 ημέρες έως 30 Σεπ 2026')
      && ints.cols === 4 && ints.rows === 7 && ints.line.includes('365 ημέρες έως 12 Ιουλ 2026') && hasMode === 1
      && audit.small.length === 0 && audit.low.length === 0 && audit.scrollWidth <= audit.innerWidth
    record(`fingerprints ${width}px: 3 views with their persons, period and source, and the measure switch`, ok, { seen, hasMode, small: audit.small, low: audit.low, scroll: [audit.scrollWidth, audit.innerWidth] })
    if (width === 1440) await page.screenshot({ path: path.join(outDir, 'screenshots', 'fingerprints-interests-1440.png'), fullPage: true })
    await context.close()
  }
}

// 9. APO-168: the Topics page shows each measure one time, and the stories have their own tab.
{
  const HEIGHT_BEFORE = { 1440: 2335, 390: 4024 }
  for (const width of WIDTHS) {
    const { page, context } = await open(`${base}/topics-v2.html`, width)
    // #68: «Θέματα σε άνοδο και πτώση» is the last card of Επισκόπηση, and the old ?tab=time opens it.
    const movers = await open(`${base}/topics-v2.html?tab=time`, width)
    const m = await movers.page.evaluate(() => {
      // #60: the title of the card states its finding, so the card is found by its name.
      const mover = document.querySelector('.dcard[data-card="movers"]')
      return {
        movers: [...mover.querySelectorAll('.row-name')].map((n) => n.textContent),
        changes: [...mover.querySelectorAll('.row-value')].map((n) => parseFloat(n.textContent.replace('−', '-').replace(',', '.'))),
        up: mover.querySelectorAll('.tri-up').length,
        down: mover.querySelectorAll('.tri-down').length
      }
    })
    await movers.context.close()
    const r = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('.dcard')]
      return {
        height: document.documentElement.scrollHeight,
        titles: cards.map((c) => c.querySelector('h2')?.textContent),
        stats: document.querySelectorAll('.dstat').length,
        columns: [...document.querySelectorAll('.data-table th')].map((th) => th.textContent),
        rows: document.querySelectorAll('.data-table tbody tr').length,
        tabs: [...document.querySelectorAll('.section-tabs a')].map((a) => a.textContent)
      }
    })
    Object.assign(r, m)
    record(`topics ${width}px: 3 cards in the new order, with no stat card and no repeated card`, r.titles.length === 3 && r.titles[0] === 'Όλα τα θέματα' && r.titles[1] === 'Τάσεις' && r.titles[2].startsWith('Πιο πολύ ανεβαίνει') && r.stats === 0, { titles: r.titles, stats: r.stats })
    record(`topics ${width}px: the table has 12 rows and no change column`, r.rows === 12 && !r.columns.some((c) => c.includes('Αλλαγή')), { rows: r.rows, columns: r.columns })
    record(`topics ${width}px: one column of 5 rises and 5 falls in falling order, and no catch-all topic`, r.up === 5 && r.down === 5 && r.changes.length === 10 && r.changes.every((v, i) => i === 0 || v <= r.changes[i - 1]) && !r.movers.includes('Άλλα'), { up: r.up, down: r.down, changes: r.changes, movers: r.movers })
    record(`topics ${width}px: the page is shorter than before (${HEIGHT_BEFORE[width]} px)`, r.height < HEIGHT_BEFORE[width], { height: r.height })
    record(`topics ${width}px: the tabs are Επισκόπηση and Overton, and no story card`, r.tabs.join() === 'Επισκόπηση,Overton', { tabs: r.tabs })
    await context.close()
  }
  // APO-180: the tab Ιστορίες lists the stories of the data, with sort, filters and 25 rows at a time.
  {
    const { page, context } = await open(`${base}/stories-v2.html`)
    const read = () => page.evaluate(() => ({
      count: Number(document.querySelector('.dash-meta').textContent.split(' ')[0].replace(/\./g, '')),
      rows: document.querySelectorAll('.data-table tbody tr').length,
      first: document.querySelector('.data-table tbody tr td:nth-child(2)')?.textContent,
      current: document.querySelector('.section-tabs [aria-current]')?.textContent,
      built: [...document.querySelectorAll('.data-table tbody tr td:nth-child(2) a')].every((a) => /^story-v2\.html\?id=\d+$/.test(a.getAttribute('href')))
    }))
    const data = await page.evaluate(() => window.FIXTURES.stories.stories.filter((x) => !x.generic).length)
    const first = await read()
    record('stories tab: the top bar count equals the stories of the data, 25 rows show, and the tab is current', first.count === data && first.rows === 25 && first.current === 'Ιστορίες', { data, ...first })
    record('stories tab: each story name is a link to the Story page', first.built, first)
    await page.click('.table-more button')
    const more = await read()
    record('stories tab: "Show 25 more" adds 25 rows', more.rows === 50, { rows: more.rows })
    await page.selectOption('.dash-actions select >> nth=0', 'start')
    const sorted = await read()
    const sizes = await page.evaluate(() => [...document.querySelectorAll('.dash-actions .field-inline')].flatMap((l) => [getComputedStyle(l).fontSize, getComputedStyle(l.querySelector('select')).fontSize, Math.round(l.querySelector('select').getBoundingClientRect().height)]))
    record('stories tab: the 3 controls have one text size and one height', new Set(sizes.filter((v, i) => i % 3 < 2)).size === 1 && new Set(sizes.filter((v, i) => i % 3 === 2)).size === 1, { sizes })
    record('stories tab: sort by start date changes the first row', sorted.first !== first.first && sorted.rows === 25, { before: first.first, after: sorted.first })
    await page.selectOption('.dash-actions select >> nth=2', '10')
    const min = await read()
    await page.selectOption('.dash-actions select >> nth=1', { index: 2 })
    const topic = await read()
    record('stories tab: the size filter and the topic filter change the count and combine', min.count < first.count && topic.count < min.count && topic.count > 0, { all: first.count, min10: min.count, topic: topic.count })
    await context.close()
  }

  // The Story page and the tabs Ηχώ, Ομοιότητα, Πρωτοτυπία and Καμπάνιες (News spread).
  {
    const { page, context } = await open(`${base}/story-v2.html?id=4502`)
    const story = await page.evaluate(() => ({ h1: document.querySelector('h1').textContent, cards: document.querySelectorAll('.dcard').length, current: document.querySelector('.nav-link[aria-current]')?.textContent, statCards: document.querySelectorAll('.dstat').length, crumbs: document.querySelectorAll('.breadcrumbs').length }))
    record('story page: the title is the story name, 7 cards, no stat card and no breadcrumbs, and the sidebar item is Διάδοση ειδήσεων', story.h1 === 'Υπόθεση θανάτου Μαζωνάκη' && story.cards === 7 && story.statCards === 0 && story.current === 'Διάδοση ειδήσεων' && story.crumbs === 0, story)
    await page.goto(`${base}/story-v2.html?id=999999`)
    record('story page: an id that is not in the data shows the 404 page', (await page.locator('.error-code').textContent()) === '404', {})
    await context.close()
    for (const [file, tab] of [['echoes-v2.html', 'Ηχώ'], ['similarity-v2.html', 'Ομοιότητα και πρωτοτυπία'], ['campaigns-v2.html', 'Μοτίβα διάδοσης']]) {
      const view = await open(`${base}/${file}`)
      const r = await view.page.evaluate(() => ({ tab: document.querySelector('.section-tabs [aria-current]')?.textContent, statCards: document.querySelectorAll('.dstat').length, selects: [...document.querySelectorAll('.dash-actions select')].map((x) => Math.round(x.getBoundingClientRect().height)), overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth }))
      record(`${file}: the tab ${tab} is current, no stat card, the lists have one height, and the page has no horizontal scroll`, r.tab === tab && r.statCards === 0 && new Set(r.selects).size <= 1 && !r.overflow, r)
      await view.context.close()
    }
    const echoes = await open(`${base}/echoes-v2.html`)
    const before = await echoes.page.locator('.dash-meta').textContent()
    await echoes.page.selectOption('.dash-actions select >> nth=2', '5')
    record('echoes: the group-count list changes the count in the top bar', before !== await echoes.page.locator('.dash-meta').textContent(), { before })
    await echoes.context.close()
  }
}

// 7. The language switch changes the text and the lang attribute.
{
  const { page, context } = await open(`${base}/index.html`)
  const before = await page.evaluate(() => ({ lang: document.documentElement.lang, h1: document.querySelector('h1').textContent }))
  await page.click('.lang-switch button[lang="en"]')
  const after = await page.evaluate(() => ({ lang: document.documentElement.lang, h1: document.querySelector('h1').textContent, pressed: document.querySelector('.lang-switch button[lang="en"]').getAttribute('aria-pressed'), focus: document.activeElement.getAttribute('lang') }))
  await page.screenshot({ path: path.join(outDir, 'screenshots', 'index-1440-en.png'), fullPage: true })
  record('language switch: text and lang attribute change', before.lang === 'el' && after.lang === 'en' && before.h1 !== after.h1 && after.pressed === 'true' && after.focus === 'en', { before, after })
  await context.close()
}

await browser.close()
results.passed = results.checks.filter((c) => c.pass).length
results.failed = results.checks.length - results.passed
fs.writeFileSync(path.join(outDir, 'results.json'), JSON.stringify(results, null, 1) + '\n')
console.log(`${results.passed} passed, ${results.failed} failed`)
process.exitCode = results.failed ? 1 : 0
