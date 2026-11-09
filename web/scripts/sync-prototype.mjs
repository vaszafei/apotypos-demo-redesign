// Prepare web/public/ and web/app/generated/ from the static prototype in docs/redesign/prototypes.
// The docs folder stays the one source of the CSS, the fonts, the data and the pages that are not ported yet.
// A page listed in ported-pages.json is not copied: its old URL redirects to the Nuxt route (public/_redirects).
import { cpSync, rmSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'
import { buildFixtures } from './build-fixtures.mjs'
import { buildMessages } from './build-messages.mjs'

const here = (path) => fileURLToPath(new URL(path, import.meta.url))
const from = here('../../docs/redesign/prototypes/')
const to = here('../public/')
const generated = here('../app/generated/')
const skip = ['checks', 'scripts', '__pycache__']

const ported = JSON.parse(readFileSync(here('../ported-pages.json'), 'utf8'))
const portedHtml = new Set(ported.map((page) => page.html))

rmSync(to, { recursive: true, force: true })
mkdirSync(to, { recursive: true })
cpSync(from, to, {
  recursive: true,
  filter: (src) => {
    const parts = src.split('/')
    return !skip.some((name) => parts.includes(name)) && !(src.startsWith(from) && portedHtml.has(src.slice(from.length)))
  }
})

// Every data/*.js of the prototype also as data/<key>.json, for the Nuxt pages (useFixture).
const fixtureCount = buildFixtures(`${from}data/`, `${to}data/`).length

// The message files as i18n/locales/el.json and en.json, for @nuxt/i18n.
const messageCount = buildMessages(from, here('../i18n/locales/')).counts

// One 301 per ported page; the rules with a query come first, because a rule without one matches any query.
// The last rule sends every other path to the Nuxt shell. It is not forced, so a static file wins over it.
const rule = (page) => `/${page.html} ${page.query ? `${page.query} ` : ''}${page.route} 301`
const withQuery = ported.filter((page) => page.query).map(rule)
const withoutQuery = ported.filter((page) => !page.query).map(rule)
writeFileSync(`${to}_redirects`, [...withQuery, ...withoutQuery, '/* /200.html 200', ''].join('\n'))

// The map route -> static page of shell.js, for links to pages that are not ported yet.
const shell = readFileSync(`${from}assets/shell.js`, 'utf8')
const source = shell.match(/const PROTOTYPES = (\{[\s\S]*?\n {2}\})/)
if (!source) throw new Error('PROTOTYPES not found in assets/shell.js')
mkdirSync(generated, { recursive: true })
writeFileSync(`${generated}prototypes.json`, `${JSON.stringify(runInNewContext(`(${source[1]})`), null, 2)}\n`)

console.log(`Prototype copied to public/ (${ported.length} ported page${ported.length === 1 ? '' : 's'} skipped, ${fixtureCount} fixtures converted, ${messageCount.el} el and ${messageCount.en} en messages)`)
