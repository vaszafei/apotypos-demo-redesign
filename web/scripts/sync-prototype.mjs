// Copy the prototype from docs/redesign/prototypes to public/.
// The docs folder stays the one source. The copy skips the checks and scripts folders.
import { cpSync, rmSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const from = fileURLToPath(new URL('../../docs/redesign/prototypes/', import.meta.url))
const to = fileURLToPath(new URL('../public/', import.meta.url))
const skip = ['checks', 'scripts', '__pycache__']

rmSync(to, { recursive: true, force: true })
mkdirSync(to, { recursive: true })
cpSync(from, to, {
  recursive: true,
  filter: (src) => !skip.some((name) => src.split('/').includes(name))
})
// The clean addresses: Netlify serves the file of each address and keeps the address in the bar (assets/routes.js reads it).
const context = {}
vm.runInNewContext(readFileSync(`${from}assets/routes.js`, 'utf8'), { globalThis: context, URLSearchParams })
const { TABLE, ALIASES } = context.ROUTES
const rows = TABLE.filter(([address]) => address !== '/').map(([address, file]) => `${address} /${file} 200`)
rows.push(...Object.keys(ALIASES).map((address) => `${address} /${TABLE.find(([a]) => a === ALIASES[address])[1]} 200`))
writeFileSync(`${to}_redirects`, `${[...new Set(rows)].join('\n')}\n`)
console.log('Prototype copied to public/')
