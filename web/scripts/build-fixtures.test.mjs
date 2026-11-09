import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildFixtures, convertFixture } from './build-fixtures.mjs'

const data = fileURLToPath(new URL('../../docs/redesign/prototypes/data/', import.meta.url))
const dir = (files) => {
  const from = `${mkdtempSync(join(tmpdir(), 'fx-from-'))}/`
  for (const [name, source] of Object.entries(files)) writeFileSync(`${from}${name}`, source)
  return from
}

test('a file with one key converts to JSON equal to window.FIXTURES[key]', () => {
  const from = dir({ 'one.js': 'window.FIXTURES=window.FIXTURES||{};window.FIXTURES["one"]={"a":[1,null,"é"],"b":{"c":true}}' })
  const to = `${mkdtempSync(join(tmpdir(), 'fx-to-'))}/`
  assert.deepEqual(buildFixtures(from, to), ['one'])
  assert.deepEqual(JSON.parse(readFileSync(`${to}one.json`, 'utf8')), { a: [1, null, 'é'], b: { c: true } })
})

test('a file that sets several keys writes several JSON files', () => {
  const from = dir({ 'many.js': 'window.FIXTURES = window.FIXTURES || {}; window.FIXTURES.x = { n: 1 }; window.FIXTURES.y = [2]' })
  const to = `${mkdtempSync(join(tmpdir(), 'fx-to-'))}/`
  assert.deepEqual(buildFixtures(from, to).sort(), ['x', 'y'])
  assert.deepEqual(JSON.parse(readFileSync(`${to}y.json`, 'utf8')), [2])
})

test('the same key in two files is an error, not a silent overwrite', () => {
  const from = dir({ 'a.js': 'window.FIXTURES={k:1}', 'b.js': 'window.FIXTURES={k:2}' })
  assert.throws(() => buildFixtures(from, `${mkdtempSync(join(tmpdir(), 'fx-to-'))}/`), /already set/)
})

test('a script gets only a bare window', () => {
  assert.equal(convertFixture('window.FIXTURES={k:typeof document + typeof fetch + typeof require}').k, 'undefinedundefinedundefined')
})

test('every data/*.js of the prototype has a JSON file, and it equals what the script sets', () => {
  const to = `${mkdtempSync(join(tmpdir(), 'fx-to-'))}/`
  const keys = buildFixtures(data, to)
  const scripts = readdirSync(data).filter((file) => file.endsWith('.js'))
  assert.equal(keys.length, scripts.length)
  for (const file of ['search.js', 'home.js', 'overton.js']) {
    const [key, value] = Object.entries(convertFixture(readFileSync(`${data}${file}`, 'utf8'), file))[0]
    assert.deepEqual(JSON.parse(readFileSync(`${to}${key}.json`, 'utf8')), JSON.parse(JSON.stringify(value)))
  }
})
