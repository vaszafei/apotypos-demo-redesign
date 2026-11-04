// The search of the public image holds only what the public image has: it drops the kinds whose pages stay private. Run inside the image build.
import { readFileSync, writeFileSync } from 'node:fs'
import vm from 'node:vm'

const PRIVATE = ['cases', 'campaigns', 'statements', 'speeches', 'people']
const file = new URL('../data/search.js', import.meta.url)
const sandbox = { window: {} }
vm.runInNewContext(readFileSync(file, 'utf8'), sandbox)
const search = sandbox.window.FIXTURES.search
for (const kind of PRIVATE) delete search.kinds[kind]
writeFileSync(file, `window.FIXTURES=window.FIXTURES||{};window.FIXTURES["search"]=${JSON.stringify(search)}\n`)
