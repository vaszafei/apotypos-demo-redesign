// Convert the fixtures of the prototype (docs/redesign/prototypes/data/*.js, each sets window.FIXTURES[key]) to one JSON file per key.
// The .json files of that folder are copied as they are by sync-prototype.mjs. Run by `npm run sync`, or: node scripts/build-fixtures.mjs [from] [to]
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'

// The keys a fixture script sets. The script runs in its own context with a bare window, nothing else of the page.
export const convertFixture = (source, filename = 'fixture') => {
  const window = {}
  window.window = window
  runInNewContext(source, { window }, { filename, timeout: 20000 })
  return window.FIXTURES ?? {}
}

export const buildFixtures = (from, to) => {
  mkdirSync(to, { recursive: true })
  const written = new Map()
  for (const name of readdirSync(from).filter((file) => file.endsWith('.js')).sort()) {
    const fixtures = convertFixture(readFileSync(`${from}${name}`, 'utf8'), name)
    for (const [key, value] of Object.entries(fixtures)) {
      if (written.has(key)) throw new Error(`${name} sets the key "${key}", which ${written.get(key)} already set`)
      written.set(key, name)
      writeFileSync(`${to}${key}.json`, JSON.stringify(value))
    }
  }
  return [...written.keys()]
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const from = process.argv[2] ?? fileURLToPath(new URL('../../docs/redesign/prototypes/data/', import.meta.url))
  const to = process.argv[3] ?? fileURLToPath(new URL('../public/data/', import.meta.url))
  console.log(`${buildFixtures(from, to).length} fixtures converted to ${to}`)
}
