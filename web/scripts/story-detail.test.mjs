import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { relatedStories, reachOf, dailyOf, storyRows, peopleOf, diffRows, MIN_DAYS } from '../app/utils/story-detail.ts'

const read = name => JSON.parse(readFileSync(new URL(`../public/data/${name}.json`, import.meta.url), 'utf8'))
const list = read('stories')
const dd = read('storyDetail')
const proto = file => readFileSync(new URL(`../../docs/redesign/prototypes/${file}`, import.meta.url), 'utf8')
const plain = value => JSON.parse(JSON.stringify(value))

// The static page keeps its related stories in the inline script of story-v2.html: the text between "const stem" and Shell.start is run as it is.
const page = proto('story-v2.html')
const inline = page.slice(page.indexOf('const stem'), page.indexOf('Shell.start'))
const staticRelated = runInNewContext(`const RELATED = 6\n${inline}\nrelatedStories`, {})
const spread = () => {
  const window = {}
  runInNewContext(proto('assets/spread.js'), { window })
  return window.Spread
}

const sample = [0, 1, 500, 3000, 5000, 7000, 7447, 7448, 9000, 9858]
const stories = list.stories.filter(s => !s.generic)
const last = list.dates.length - 1

test('the related stories are those of the static page, with the same scores', () => {
  const ids = sample.map(id => list.stories.find(s => s.id === id)).filter(Boolean)
  assert.ok(ids.length >= 6)
  for (const target of ids) {
    const days = s => dailyOf(s, last + 1)
    assert.deepEqual(plain(relatedStories(stories, target, days)), plain(staticRelated(stories, target, days)))
  }
})

test('the reach of a story is the reach of Spread.profiles', () => {
  const { list: profiles } = spread().profiles(dd)
  for (const p of profiles.filter((_, i) => i % 97 === 0)) assert.equal(reachOf(dd, dd.stories.find(s => s.id === p.id)), p.reach, `story ${p.id}`)
})

test('the rows of a story add up: outlets, groups and days have the same articles', () => {
  for (const id of sample) {
    const det = dd.stories.find(s => s.id === id)
    if (!det) continue
    const r = storyRows(list, dd, det)
    const total = det.t.filter((_, i) => i % 3 === 2).reduce((a, b) => a + b, 0)
    assert.equal(r.articles, total)
    assert.equal(r.groups.reduce((a, g) => a + g.n, 0), total)
    assert.equal(r.perDay.reduce((a, b) => a + b, 0), total)
    assert.ok(r.outlets.every((o, i) => i === 0 || r.outlets[i - 1].n >= o.n))
    assert.ok(r.lo <= r.start && r.hi >= r.end)
    assert.ok(r.hi - r.lo + 1 >= Math.min(MIN_DAYS, last + 1))
  }
})

test('a short story at the start or the end of the window still gets a window of 14 days', () => {
  const det = dd.stories.find(s => s.id === 9858)
  const r = storyRows(list, dd, det)
  assert.equal(r.end, last)
  assert.equal(r.hi - r.lo + 1, MIN_DAYS)
})

test('the people are the most mentioned first', () => {
  const withPeople = dd.stories.filter(s => s.p.length >= 8).slice(0, 20)
  assert.ok(withPeople.length)
  for (const det of withPeople) {
    const p = peopleOf(dd, det)
    const n = x => x.counts.reduce((a, b) => a + b, 0)
    assert.ok(p.every((x, i) => i === 0 || n(p[i - 1]) >= n(x)))
  }
})

test('difference rows: the kinds the story has, largest first, then the 2 usual kinds it lacks', () => {
  const rows = [{ label: 'a', value: 0.5, usual: 0.1 }, { label: 'b', value: 0, usual: 0.3 }, { label: 'c', value: 0.2, usual: 0.2 }, { label: 'd', value: 0, usual: 0.4 }, { label: 'e', value: 0, usual: 0.1 }]
  assert.deepEqual(diffRows(rows, 1).map(r => r.label), ['a', 'd', 'b'])
  assert.deepEqual(diffRows(rows, 8).map(r => r.label), ['a', 'c', 'd', 'b'])
})
