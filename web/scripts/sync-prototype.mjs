// Copy the prototype from docs/redesign/prototypes to public/.
// The docs folder stays the one source. The copy skips the checks and scripts folders.
import { cpSync, rmSync, mkdirSync } from 'node:fs'
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
console.log('Prototype copied to public/')
