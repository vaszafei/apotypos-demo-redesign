import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { storiesByDay, storiesOfPeriod, storyLines, LINE_STORIES } from '../app/utils/stories.ts'

const data = JSON.parse(readFileSync(new URL('../public/data/stories.json', import.meta.url), 'utf8'))

// The static code (assets/home.js) is the reference: it is loaded with stubs for the parts that draw.
const reference = () => {
  const window = { App: { t: () => '', fmt: {}, h: () => ({}), Icon: () => ({}), locale: 'el' } }
  runInNewContext(readFileSync(new URL('../../docs/redesign/prototypes/assets/home.js', import.meta.url), 'utf8'), { window, Dash: {}, App: window.App, UI: {}, Shell: {} })
  return window.Home
}
const ids = list => JSON.parse(JSON.stringify(list.map(r => `${r.s.id}:${r.n}`)))
const last = data.dates.length - 1

test('the stories of a day and of a period are those of the static code', () => {
  const Home = reference()
  const ix = Home.index({ stories: data, detail: null })
  const byDay = storiesByDay(data.stories, data.dates.length)
  for (const [d] of [[0], [10], [last]]) assert.deepEqual(ids(byDay[d]), ids(ix.byDay[d]))
  for (const [i0, i1] of [[0, last], [10, 20], [last, last], [last - 6, last]]) {
    assert.deepEqual(ids(storiesOfPeriod(byDay, i0, i1)), ids(Home.rangeInfo(ix, i0, i1, 0).list))
  }
})

test('a generic story is not in any list', () => {
  const byDay = storiesByDay(data.stories, data.dates.length)
  assert.ok(data.stories.some(s => s.generic))
  assert.ok(storiesOfPeriod(byDay, 0, last).every(r => !r.s.generic))
})

test('lines: the axis is the picked days, and the values are the days of the story', () => {
  const byDay = storiesByDay(data.stories, data.dates.length)
  const list = storiesOfPeriod(byDay, 40, 40)
  const l = storyLines(list, 40, 40)
  assert.equal(l.lines.length, Math.min(LINE_STORIES, list.length))
  assert.deepEqual([l.d0, l.d1], [40, 40])
  for (const { s, values } of l.lines) {
    assert.equal(values.length, l.d1 - l.d0 + 1)
    for (let j = 0; j < s.days.length; j += 2) if (s.days[j] >= l.d0 && s.days[j] <= l.d1) assert.equal(values[s.days[j] - l.d0], s.days[j + 1])
  }
})
