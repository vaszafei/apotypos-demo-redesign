import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { homeIndex, homeRange, homeOutletsOf, bestOfWeek, HOME_WEBS } from '../app/utils/home.ts'

const read = name => JSON.parse(readFileSync(new URL(`../public/data/${name}.json`, import.meta.url), 'utf8'))
const stories = read('stories')
const detail = read('storyDetail')
const plain = value => JSON.parse(JSON.stringify(value))

// The static code of Αρχική runs in a context with the few helpers it destructures; none of them is called by the lookups.
const sandbox = { window: {} }
sandbox.window.window = sandbox.window
sandbox.window.App = { t: () => '', fmt: {}, h: () => ({}), Icon: () => ({}), locale: 'el' }
sandbox.Dash = { card: () => ({}), cardHead: () => ({}), emptyText: () => ({}), groupColor: () => '' }
sandbox.App = sandbox.window.App
runInNewContext(readFileSync(new URL('../../docs/redesign/prototypes/assets/home.js', import.meta.url), 'utf8'), sandbox, { filename: 'home.js' })
const Home = sandbox.window.Home

const ours = homeIndex({ stories, detail })
const theirs = Home.index({ stories, detail })
const last = stories.dates.length - 1
const ids = info => plain(info && { ...info, story: info.story.id, list: info.list.map(r => ({ id: r.s.id, n: r.n })) })

test('the stories of each day are those of Home.index, in the same order', () => {
  assert.equal(ours.byDay.length, theirs.byDay.length)
  for (const d of [0, 20, 60, 74, last]) assert.deepEqual(ours.byDay[d].map(r => [r.s.id, r.n]), plain(theirs.byDay[d].map(r => [r.s.id, r.n])), `day ${d}`)
})

test('a generic story is not in any day', () => {
  const generic = new Set(stories.stories.filter(s => s.generic).map(s => s.id))
  assert.ok(generic.size > 0)
  for (const day of ours.byDay) for (const r of day) assert.ok(!generic.has(r.s.id))
})

test('the ranges are those of Home.rangeInfo: the lead, its outlets and the whole list', () => {
  for (const [i0, i1] of [[last - 6, last], [0, 6], [30, 60], [74, last], [last, last]]) {
    for (const rank of [0, 1]) assert.deepEqual(ids(homeRange(ours, i0, i1, rank)), ids(Home.rangeInfo(theirs, i0, i1, rank)), `${i0}-${i1} rank ${rank}`)
  }
})

test('the outlets of a story are those of Home.outletsOf', () => {
  for (const [i0, i1] of [[last - 6, last], [74, last]]) {
    const story = stories.stories.find(s => !s.generic && ours.byDay[last].some(r => r.s.id === s.id))
    assert.deepEqual(plain(homeOutletsOf(ours, story, i0, i1)), plain(Home.outletsOf(theirs, story, i0, i1)))
  }
})

test('the best of the week is the top of the ranking of the last seven days, nine stories, no generic one', () => {
  const best = bestOfWeek(ours)
  assert.equal(best.length, HOME_WEBS)
  assert.deepEqual(best.map(s => s.id), plain(Home.rangeInfo(theirs, last - 6, last).list.slice(0, HOME_WEBS).map(r => r.s.id)))
  assert.ok(best.every(s => !s.generic))
  assert.equal(bestOfWeek(ours, 4).length, 4)
})

test('a period with no story has no range', () => {
  assert.equal(homeRange({ ...ours, byDay: ours.byDay.map(() => []) }, 0, 5), null)
})
