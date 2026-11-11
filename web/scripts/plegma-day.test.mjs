import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildDayWeb, dayDots, DAY_DATE, DAY_THEME, DAY_STORY, DAY_DOT, DAY_REST, PLEGMA_DAY_DOTS } from '../app/utils/plegma-day.ts'

const story = (id, n, dots) => ({ id, name: `s${id}`, n, media: 3, dots })
const themes = [
  { issue: 1, name: 'A', slot: 1, n: 90, stories: [story(1, 40, [1, 1, 2, 2, 2]), story(2, 20, [1, 2, 3])], rest: 30 },
  { issue: 2, name: 'B', slot: 2, n: 50, stories: [story(3, 25, [0, 0, 0, 0])], rest: 3 },
  { issue: 3, name: 'C', slot: 3, n: 20, stories: [story(4, 8, [4, 4])], rest: 0 }
]

test('the day web has the date, a theme each, a story each, a dot for each article and the faint rest', () => {
  const web = buildDayWeb(themes, 1.8, 7)
  const count = k => Array.from(web.kind).filter(v => v === k).length
  assert.equal(count(DAY_DATE), 1)
  assert.equal(count(DAY_THEME), 3)
  assert.equal(count(DAY_STORY), 4)
  assert.equal(count(DAY_DOT), 5 + 3 + 4 + 2)
  assert.equal(count(DAY_REST), 14 + 3 + 0)
  assert.equal(web.edges.length / 2, 3 + 4 + 14)
})

test('every node is inside the box and the same seed gives the same web', () => {
  const a = buildDayWeb(themes, 1.8, 7)
  const b = buildDayWeb(themes, 1.8, 7)
  assert.deepEqual(Array.from(a.x), Array.from(b.x))
  for (let i = 0; i < a.n; i++) assert.ok(Math.abs(a.x[i]) <= 1.8 + 1e-6 && Math.abs(a.y[i]) <= 1 + 1e-6, `node ${i} at ${a.x[i]}, ${a.y[i]}`)
})

test('a dot is an article up to the cap, then it stands for several, in the proportion of the groups', () => {
  assert.deepEqual(dayDots(3, [{ slot: 1, n: 2 }, { slot: 2, n: 1 }]), [1, 1, 2])
  assert.equal(dayDots(500, [{ slot: 1, n: 1 }]).length, PLEGMA_DAY_DOTS)
  assert.deepEqual(dayDots(2, []), [0, 0])
  const many = dayDots(100, [{ slot: 1, n: 75 }, { slot: 2, n: 25 }])
  assert.equal(many.filter(s => s === 1).length, 9)
  assert.equal(many.filter(s => s === 2).length, 3)
})
