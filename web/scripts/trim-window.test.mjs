import { test } from 'node:test'
import assert from 'node:assert/strict'
import { trimWindow } from './trim-window.mjs'
import { fullData } from './lib/full-data.mjs'

const dates = ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15']
const marks = { dates, window: [dates[0], dates[3]], volumeFrom: dates[1], dbCovered: [dates[2], dates[3]] }
const fixtures = () => ({
  home: { ...marks, outlets: [{ name: 'A', daily: [1, 2, 3, 4] }], issueDaily: [[5, 6, null, null]] },
  media: {
    ...marks, outlets: [{ name: 'A' }], outletDaily: [[[1, 0, 0, 0], [2, 0, 0, 0], [3, null, null, null], [4, null, null, null]]], issueDaily: [[1, 1, null, null]],
    stories: [{ el: 'old', daily: [3, 1, 0, 0] }, { el: 'new', daily: [0, 0, 2, 0] }], storyDays: []
  },
  stories: { ...marks, stories: [{ id: 1, days: [0, 3, 1, 1] }, { id: 2, days: [1, 2, 3, 5] }, { id: 3, days: [2, 4] }] },
  storyDetail: { ...marks, outlets: [{ name: 'A', total: 99 }], stories: [{ id: 1, t: [0, 0, 3] }, { id: 2, t: [0, 1, 2, 0, 3, 5] }, { id: 3, t: [0, 2, 4] }] },
  search: { storyRows: [[1, 'a', 0, 1], [2, 'b', 0, 1], [3, 'c', 0, 1]] }
})

test('every daily fixture starts on the first day the database covers', () => {
  const fx = fixtures()
  assert.deepEqual(trimWindow(fx), { from: '2026-10-14', cut: 2, stories: 2 })
  for (const key of ['home', 'media', 'stories', 'storyDetail']) {
    assert.deepEqual(fx[key].dates, ['2026-10-14', '2026-10-15'], key)
    assert.deepEqual(fx[key].window, ['2026-10-14', '2026-10-15'], key)
    assert.equal(fx[key].volumeFrom, '2026-10-14', key)
  }
  assert.deepEqual(fx.home.outlets[0].daily, [3, 4])
  assert.deepEqual(fx.home.issueDaily, [[null, null]])
  assert.deepEqual(fx.media.issueDaily, [[null, null]])
})

test('a story with no day in the window goes; the others keep their id and their days move to the new indexes', () => {
  const fx = fixtures()
  trimWindow(fx)
  assert.deepEqual(fx.stories.stories, [{ id: 2, days: [1, 5] }, { id: 3, days: [0, 4] }])
  assert.deepEqual(fx.storyDetail.stories.map(s => [s.id, s.t]), [[2, [0, 1, 5]], [3, [0, 0, 4]]])
  assert.deepEqual(fx.media.storyDays, [[1, 5], [0, 4]])
  assert.deepEqual(fx.search.storyRows.map(r => r[0]), [2, 3])
})

test('the named stories of media keep only the ones with articles in the window, and an outlet total counts only its days', () => {
  const fx = fixtures()
  trimWindow(fx)
  assert.deepEqual(fx.media.stories, [{ el: 'new', daily: [2, 0] }])
  assert.equal(fx.storyDetail.outlets[0].total, 7)
})

test('fixtures without a database range are left as they are', () => {
  const fx = fixtures()
  delete fx.stories.dbCovered
  assert.equal(trimWindow(fx), null)
  assert.equal(fx.stories.stories.length, 3)
})

test('on the real fixtures the window is 14 to 27 Oct and every story keeps its articles of those days', () => {
  const fx = Object.fromEntries(['home', 'media', 'stories', 'storyDetail', 'search'].map(k => [k, fullData(k)]))
  const before = new Map(fx.storyDetail.stories.map(s => [s.id, s.t.filter((_, i) => i % 3 === 2).reduce((a, n) => a + n, 0)]))
  trimWindow(fx)
  assert.deepEqual([fx.stories.dates[0], fx.stories.dates.at(-1)], ['2026-10-14', '2026-10-27'])
  assert.equal(fx.stories.stories.length, 2453)
  for (const s of fx.storyDetail.stories) assert.equal(s.t.filter((_, i) => i % 3 === 2).reduce((a, n) => a + n, 0), before.get(s.id), `story ${s.id}`)
})
