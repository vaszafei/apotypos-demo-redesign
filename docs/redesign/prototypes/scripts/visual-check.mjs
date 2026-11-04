// Load every prototype page at four widths in two themes. Report console errors, failed requests,
// HTTP errors and horizontal scroll, and save a screenshot of each load.
// Usage: pnpm check:visual [--themes paper,night|all] [--widths 1920,1440,1100,390] [--only text]
// Env: CHROME_PATH (default /usr/bin/google-chrome), PORT (default 8765).
import { createServer } from 'node:http'
import { readFileSync, existsSync, mkdirSync, rmSync, writeFileSync, statSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const root = fileURLToPath(new URL('../', import.meta.url))
const out = fileURLToPath(new URL('../../../../.visual-check/', import.meta.url))
const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > -1 ? process.argv[i + 1] : fallback }
const ALL_THEMES = ['carbon', 'charcoal', 'paper', 'fog', 'terra', 'night', 'midnight']
const themes = arg('themes', 'carbon,paper') === 'all' ? ALL_THEMES : arg('themes', 'carbon,paper').split(',')
const widths = arg('widths', '1920,1440,1100,390').split(',').map(Number)
const only = arg('only', '')
const port = Number(process.env.PORT || 8765)
const chrome = process.env.CHROME_PATH || '/usr/bin/google-chrome'
const heightOf = (width) => (width <= 500 ? 844 : 900)

// The route map of the shell gives each page and each tab. The detail pages need a parameter.
const shell = readFileSync(join(root, 'assets/shell.js'), 'utf8')
const map = shell.slice(shell.indexOf('const PROTOTYPES'), shell.indexOf('}', shell.indexOf('const PROTOTYPES')))
const urls = new Set([...map.matchAll(/:\s*'([a-z0-9-]+\.html[^']*)'/g)].map((m) => m[1]))
for (const extra of ['404.html', 'pages.html', 'story-v2.html?id=0', 'speech-v2.html?id=_NZUkod7lUM', 'speech-v2.html?id=-O7F0hDz0mI', 'outlet-v2.html', 'group-v2.html?g=skai', 'topic-v2.html?i=1', 'topic-v2.html?i=0', 'topic-v2.html?i=12', 'story-v2.html?id=7448']) urls.add(extra)
const pages = [...urls].filter((u) => u.includes(only)).sort()

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ico': 'image/x-icon' }
const server = createServer((req, res) => {
  const path = normalize(join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname)))
  if (!path.startsWith(root) || !existsSync(path) || !statSync(path).isFile()) { res.writeHead(404); res.end('not found'); return }
  res.writeHead(200, { 'content-type': types[extname(path)] || 'application/octet-stream' })
  res.end(readFileSync(path))
})
await new Promise((resolve) => server.listen(port, resolve))

let chromium
try { ({ chromium } = createRequire(new URL('../../../../web/package.json', import.meta.url))('playwright-core')) } catch { console.error('playwright-core is missing. Run pnpm install in web/.'); server.close(); process.exit(2) }
if (!existsSync(chrome)) { console.error(`Chrome not found at ${chrome}. Install Google Chrome or set CHROME_PATH.`); server.close(); process.exit(2) }

rmSync(out, { recursive: true, force: true })
const browser = await chromium.launch({ executablePath: chrome })
const findings = []
const started = Date.now()
let loads = 0

for (const theme of themes) {
  for (const width of widths) {
    const dir = join(out, `${width}-${theme}`)
    mkdirSync(dir, { recursive: true })
    const context = await browser.newContext({ viewport: { width, height: heightOf(width) } })
    // Signed in, so the pages of the section Κόσμος show their charts and not the sign-in gate.
    await context.addInitScript((key) => { try { localStorage.setItem('proto-theme', key); localStorage.setItem('proto-user', 'lolovios') } catch {} }, theme)
    const queue = [...pages]
    const worker = async () => {
      for (let url = queue.shift(); url; url = queue.shift()) {
        const page = await context.newPage()
        const problems = []
        page.on('console', (m) => { if (m.type() === 'error') problems.push(`console: ${m.text().slice(0, 140)}`) })
        page.on('pageerror', (e) => problems.push(`pageerror: ${e.message.slice(0, 140)}`))
        page.on('requestfailed', (r) => problems.push(`request failed: ${r.url().replace(`http://localhost:${port}/`, '')}`))
        page.on('response', (r) => { if (r.status() >= 400 && !r.url().endsWith('/favicon.ico')) problems.push(`HTTP ${r.status()}: ${r.url().replace(`http://localhost:${port}/`, '')}`) })
        try {
          await page.goto(`http://localhost:${port}/${url}`, { waitUntil: 'networkidle' })
          await page.waitForTimeout(500)
          const m = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth }))
          if (m.scroll > m.inner + 1) problems.push(`horizontal scroll: ${m.scroll}px in ${m.inner}px`)
          await page.screenshot({ path: join(dir, `${url.replace(/[^a-z0-9]+/gi, '_')}.png`), fullPage: true })
        } catch (error) {
          problems.push(`load failed: ${String(error.message).split('\n')[0]}`)
        }
        loads++
        for (const problem of problems) findings.push({ url, width, theme, problem })
        await page.close()
      }
    }
    await Promise.all(Array.from({ length: 4 }, worker))
    await context.close()
  }
}
await browser.close()
server.close()

const seconds = Math.round((Date.now() - started) / 1000)
findings.sort((a, b) => a.url.localeCompare(b.url) || b.width - a.width || a.theme.localeCompare(b.theme))
writeFileSync(join(out, 'report.json'), JSON.stringify({ loads, seconds, themes, widths, findings }, null, 2))
console.log(`${loads} loads (${pages.length} pages x ${widths.length} widths x ${themes.length} themes) in ${seconds} s. Screenshots: ${out}`)
if (!findings.length) { console.log('No findings.'); process.exit(0) }
const byUrl = new Map()
for (const f of findings) { const k = `${f.url}: ${f.problem}`; byUrl.set(k, [...(byUrl.get(k) || []), `${f.width}/${f.theme}`]) }
for (const [k, where] of byUrl) console.log(`- ${k}  [${where.length > 4 ? `${where.length} loads` : where.join(', ')}]`)
console.log(`\n${findings.length} findings in ${byUrl.size} distinct problems. Full list: ${join(out, 'report.json')}`)
process.exit(1)
