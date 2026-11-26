import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PAGE_TREE, FOOTER, fold, match, pageEntries, indexEntries, placeOf, readRecent, remember } from '../app/utils/search.ts'
import { fullData } from './lib/full-data.mjs'

const index = fullData('search')
const t = (key, named) => (named ? `${key} ${JSON.stringify(named)}` : key)
const first = (entries, q) => match(entries, q)[0]
const entities = indexEntries(index, 'el', t)

test('typing a known outlet name lists it under outlets', () => {
  const hit = first(entities.outlets, 'Ta Nea')
  assert.equal(hit.n, 'Ta Nea')
  assert.equal(hit.kind, 'outlets')
})
test('a Greek query with accents or without them gives the same result', () => {
  const names = (q) => match(entities.stories, q).map(e => e.h)
  assert.ok(names('Τέμπη').length > 0)
  assert.deepEqual(names('Τέμπη'), names('τεμπη'))
  assert.deepEqual(names('ΤΕΜΠΗ'), names('τεμπη'))
  assert.equal(fold('Ελλάς'), fold('ΕΛΛΑΣ'))
})
test('a Greek query finds a Latin name and a Latin query finds a Greek one', () => {
  assert.ok(match(entities.outlets, 'πολιτ').some(e => e.n === 'Parapolitika'))
  const greek = entities.groups.find(e => /ΣΚΑΪ/.test(e.n))
  assert.ok(greek, 'the index has Όμιλος ΣΚΑΪ')
  assert.ok(match(entities.groups, 'skai').includes(greek))
})
test('the topics and the people are not in the results while their pages are hidden', () => {
  assert.deepEqual(entities.topics, [])
  assert.deepEqual(entities.people, [])
  assert.ok(entities.stories.every(e => e.d === undefined))
})
test('a name that starts with the query comes before a word inside another name', () => {
  const entries = [
    { kind: 'outlets', n: 'The Alpha', where: '', h: 'a' },
    { kind: 'outlets', n: 'Alpha', where: '', h: 'b' }
  ]
  assert.deepEqual(match(entries, 'alpha').map(e => e.h), ['b', 'a'])
})
test('the English locale shows the English name where there is one', () => {
  const withEnglish = index.kinds.outlets.find(x => x.en && x.en !== x.n) ?? index.kinds.groups.find(x => x.en && x.en !== x.n)
  const en = indexEntries(index, 'en', t)
  if (withEnglish) assert.ok([...en.outlets, ...en.groups].some(e => e.n === withEnglish.en))
  const story = index.storyRows.find(r => r[4])
  assert.ok(story, 'the index has an English story title')
  assert.ok(en.stories.some(e => e.n === story[4]))
})
test('a page is found by its name and by its section, and has its route', () => {
  const pages = pageEntries(t, r => `file${r}`)
  const hit = first(pages, 'tab.media.stories')
  assert.equal(hit.route, '/stories')
  assert.equal(hit.h, 'file/stories')
  assert.ok(!pages.some(p => p.route === '/trends' || p.route === '/fingerprints'))
  assert.ok(pages.some(p => p.route === '/methodology'))
  assert.equal(placeOf(t, '/stories'), 'nav.media › tab.media.stories')
  assert.equal(placeOf(t, '/story'), 'nav.media')
  assert.equal(placeOf(t, '/nowhere'), null)
})
test('the page tree has the routes of NAV in assets/shell.js', () => {
  const shell = readFileSync(new URL('../../docs/redesign/prototypes/assets/shell.js', import.meta.url), 'utf8')
  const block = shell.slice(shell.indexOf('const NAV = ['), shell.indexOf('const FOOTER'))
  const routesOf = (text, quote) => [...new Set(text.match(new RegExp(`${quote}/[a-z0-9/-]*${quote}`, 'g')).map(r => r.slice(1, -1)))].sort()
  // Less the pages hidden or removed while the app shows only the days with article times (utils/window-pages.ts).
  const off = ['/trends', '/topic', '/media/writing', '/fingerprints', '/fingerprints/spread', '/person']
  assert.deepEqual(routesOf(JSON.stringify(PAGE_TREE), '"'), routesOf(block, "'").filter(r => !off.includes(r)))
})

let storage
beforeEach(() => {
  const data = new Map()
  storage = { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)) }
  globalThis.localStorage = storage
})
test('recent pages and searches keep the last six, the newest first, with no repeats', () => {
  for (let i = 0; i < 8; i++) remember('queries', `q${i}`, q => q === `q${i}`)
  remember('queries', 'q5', q => q === 'q5')
  const { queries } = readRecent()
  assert.equal(queries.length, 6)
  assert.equal(queries[0], 'q5')
  assert.equal(queries.filter(q => q === 'q5').length, 1)
})
test('a storage that is not available gives an empty list and does not throw', () => {
  globalThis.localStorage = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') } }
  assert.deepEqual(readRecent(), { pages: [], queries: [] })
  remember('pages', { h: 'a', n: 'A' }, p => p.h === 'a')
})
