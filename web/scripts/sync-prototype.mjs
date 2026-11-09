// Prepare web/public/ and web/app/generated/ from the static prototype in docs/redesign/prototypes.
// The docs folder stays the one source of the CSS, the fonts, the data and the pages that are not ported yet.
// A page listed in ported-pages.json is not copied: its old URL redirects to the Nuxt route (public/_redirects).
import { cpSync, rmSync, mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'

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

// Fixtures that are not converted from the prototype yet (replaced by build-fixtures.mjs in U4).
const fixtures = here('../fixtures/')
if (existsSync(fixtures)) {
  mkdirSync(`${to}data/`, { recursive: true })
  for (const name of readdirSync(fixtures)) cpSync(`${fixtures}${name}`, `${to}data/${name}`)
}

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

console.log(`Prototype copied to public/ (${ported.length} ported page${ported.length === 1 ? '' : 's'} skipped)`)
