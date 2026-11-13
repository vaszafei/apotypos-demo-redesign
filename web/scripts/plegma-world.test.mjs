import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildWorld, webOf, dotsOf, arcsOf, themeCore, themeFrameSet, themeSlots, homeWebs, drawLevel, PLEGMA_THEME_ARCS, PLEGMA_FOCUS_DOTS } from '../app/utils/plegma/plegma-world.ts'
import { homeIndex } from '../app/utils/home.ts'

const read = name => JSON.parse(readFileSync(new URL(`../public/data/${name}.json`, import.meta.url), 'utf8'))
const stories = read('stories')
const home = read('home')
const world = buildWorld(stories, home, read('plegma'))
const ix = homeIndex({ stories, detail: read('storyDetail') })
const issueOf = name => stories.issues.findIndex(i => i.el === name)
const plain = value => JSON.parse(JSON.stringify(value))

test('every non-generic story is in the world at its place, and no generic story is', () => {
  assert.equal(world.stories.length, stories.stories.filter(s => !s.generic).length)
  assert.ok(world.stories.every(s => Number.isFinite(s.x) && Number.isFinite(s.y)))
  assert.ok(stories.stories.filter(s => s.generic).every(s => !world.byId.has(s.id)))
})

test('the web of a story is the same on every call, and another story has another shape', () => {
  const [a, b] = [world.byId.get(4502), world.byId.get(4501)]
  const first = plain(webOf(world, a))
  assert.deepEqual(plain(webOf(buildWorld(stories, home, read('plegma')), a)), first)
  assert.equal(webOf(world, a), webOf(world, a))
  assert.notDeepEqual(plain(webOf(world, b).offs), first.offs)
  assert.equal(first.edges.length >= first.offs.length - 1, true)
})

test('the dots of a web follow the articles of the story alone, from 6 to 32', () => {
  assert.ok(dotsOf(120) > dotsOf(40))
  assert.equal(dotsOf(3219), 32)
  assert.equal(dotsOf(600), 32)
  assert.ok(dotsOf(25) > 1)
  assert.deepEqual([6, 60, 400, 800].map(dotsOf), [9, 14, 27, 32])
  const big = world.stories.find(s => s.n >= 3000)
  assert.equal(webOf(world, big).k, 32)
})

test('covers R6: a story of 6 articles is a loose dot unfocused and a web of at least 8 dots when focused', () => {
  const tiny = world.stories.find(s => s.n === 6)
  for (const z of [0.5, 1.5, 3]) assert.equal(drawLevel(tiny, z, false, false), 0)
  assert.ok(drawLevel(tiny, 3, false, true) >= 1)
  assert.ok(webOf(world, tiny, PLEGMA_FOCUS_DOTS).k >= PLEGMA_FOCUS_DOTS)
  assert.ok(webOf(world, tiny).k < webOf(world, tiny, 14).k)
})

test('the level of detail grows with the zoom: a dot far away, a web nearer, its lines nearest', () => {
  const s = world.stories.find(x => x.n >= 150)
  assert.equal(drawLevel(s, 0.15, false, false), 0)
  assert.equal(drawLevel(s, 0.5, false, false), 1)
  assert.equal(drawLevel(s, 1.5, false, false), 2)
  assert.equal(drawLevel(world.stories.find(x => x.n < 120 && x.n >= 20), 0.5, false, false), 0)
  assert.equal(drawLevel(world.stories.find(x => x.n < 120 && x.n >= 20), 0.5, true, false), 1)
})

test('the colour slots are the eight largest themes of the window, the catch-all never', () => {
  const slots = themeSlots(home)
  assert.equal(slots.size, 8)
  assert.deepEqual([...slots.values()].sort(), [1, 2, 3, 4, 5, 6, 7, 8])
  for (const k of slots.keys()) assert.equal(stories.issues[k].catchAll, false)
  const topics = readFileSync(new URL('../app/composables/useTopics.ts', import.meta.url), 'utf8')
  assert.match(topics, /slice\(0, 8\)/)
})

test('a story shows its theme colour only when it is coded and the theme has a slot; October stories are ink', () => {
  const coloured = world.stories.filter(s => s.slot > 0)
  assert.ok(coloured.length > 1000)
  assert.ok(coloured.every(s => s.coded && world.slotOf.get(s.issue) === s.slot))
  const october = world.stories.filter(s => stories.dates[s.d0] >= stories.volumeFrom)
  assert.ok(october.length > 1000)
  assert.ok(october.every(s => !s.coded && s.slot === 0))
})

test('best of the week has nine webs, none generic, all with a place', () => {
  const best = homeWebs(world, ix)
  assert.equal(best.length, 9)
  assert.ok(best.every(s => s.n > 0 && !stories.stories.find(x => x.id === s.id).generic))
  assert.equal(homeWebs(world, ix, 4).length, 4)
})

test('covers AE2: themed stories chain into arcs in order of their first day, and a catch-all story is in none', () => {
  const issue = issueOf('Οικονομία')
  const real = stories.issues.findIndex((i, k) => !i.catchAll && world.byIssue.get(k)?.filter(s => s.coded).length >= 5)
  const arcs = arcsOf(world, real)
  const core = themeCore(world, real)
  assert.equal(arcs.length, core.length - 1)
  arcs.forEach((arc, i) => { assert.equal(arc.a, core[i]); assert.equal(arc.b, core[i + 1]); assert.ok(arc.a.d0 <= arc.b.d0) })
  const other = stories.issues.findIndex(i => i.catchAll)
  assert.deepEqual(arcsOf(world, other), [])
  assert.ok(issue >= -1)
  for (let k = 0; k < stories.issues.length; k++) for (const arc of arcsOf(world, k)) assert.ok(arc.a.coded && arc.b.coded && arc.a.issue === k && arc.b.issue === k)
})

test('a theme of hundreds of stories chains only its largest, and frames only its largest', () => {
  const [issue, list] = [...world.byIssue].filter(([k]) => !stories.issues[k].catchAll).sort((a, b) => b[1].length - a[1].length)[0]
  assert.ok(list.length > 100)
  const core = themeCore(world, issue)
  assert.equal(core.length, PLEGMA_THEME_ARCS)
  assert.equal(arcsOf(world, issue).length, PLEGMA_THEME_ARCS - 1)
  const smallest = Math.min(...core.map(s => s.n))
  assert.ok(list.filter(s => s.coded && !core.includes(s)).every(s => s.n <= smallest))
  assert.equal(themeFrameSet(world, issue).length, PLEGMA_THEME_ARCS)
  assert.ok(core.every((s, i) => i === 0 || core[i - 1].d0 <= s.d0))
})

test('the catch-all theme frames its largest stories although it draws no arcs', () => {
  const other = stories.issues.findIndex(i => i.catchAll)
  assert.equal(themeFrameSet(world, other).length, PLEGMA_THEME_ARCS)
  assert.equal(arcsOf(world, other).length, 0)
})
