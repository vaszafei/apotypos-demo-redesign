import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { mmeSummary, mmeDaily } from '../app/utils/mme.ts'
import { squarify } from '../app/utils/squarify.ts'
import { placeLabels } from '../app/utils/stance-labels.ts'

const data = JSON.parse(readFileSync(new URL('../public/data/mme.json', import.meta.url), 'utf8'))
const set = data.sets.gr

// The static summary (assets/mme.js) is the reference: it is loaded with stubs for the parts that draw.
const reference = () => {
  const window = { App: { t: () => '', fmt: {}, h: () => ({}), locale: 'el' } }
  runInNewContext(readFileSync(new URL('../../docs/redesign/prototypes/assets/mme.js', import.meta.url), 'utf8'), { window, Dash: {}, App: window.App, UI: {} })
  return window.Mme
}
// Arrays made inside the vm have another prototype, so they are compared as JSON.
const plain = v => JSON.parse(JSON.stringify(v))

test('the sums of a period are those of the static summary', () => {
  const Mme = reference()
  const last = set.dates.length - 1
  for (const [i0, i1] of [[0, last], [10, 20], [last, last], [last - 6, last]]) {
    const a = mmeSummary(set, i0, i1)
    const b = plain(Mme.summary(set, i0, i1))
    assert.equal(a.total, b.total)
    assert.equal(a.newsN, b.newsN)
    assert.deepEqual(a.issueN, b.issueN)
    assert.deepEqual(a.hard, b.hard)
    assert.deepEqual(a.active.map(o => o.k), b.active.map(o => o.k))
    for (const [k, o] of a.outlets.entries()) {
      const r = b.outlets[k]
      assert.deepEqual({ n: o.n, news: o.news, stance: o.stance, issues: o.issues, group: o.group }, { n: r.n, news: r.news, stance: r.stance, issues: r.issues, group: r.group })
    }
  }
})

test('the days of the whole set add up to the total of the whole set', () => {
  const day = mmeDaily(set)
  const all = mmeSummary(set, 0, set.dates.length - 1)
  assert.equal(day.total.reduce((s, v) => s + v, 0), all.total)
  assert.ok(day.other.every(v => v >= 0))
  assert.equal(day.news.length, set.dates.length)
})

test('the tiles fill the rectangle and each has the area of its value', () => {
  const items = [50, 30, 10, 5, 3, 2].map(v => ({ v }))
  const tiles = squarify(items, 0, 0, 400, 200)
  assert.equal(tiles.length, items.length)
  assert.ok(Math.abs(tiles.reduce((s, t) => s + t.w * t.h, 0) - 400 * 200) < 1e-6)
  for (const t of tiles) {
    assert.ok(t.x >= -1e-9 && t.y >= -1e-9 && t.x + t.w <= 400 + 1e-9 && t.y + t.h <= 200 + 1e-9)
    assert.ok(Math.abs((t.w * t.h) / (400 * 200) - t.item.v / 100) < 1e-9)
  }
})

test('the names of the stance map stay inside the plot and off the dots', () => {
  const all = mmeSummary(set, 0, set.dates.length - 1).active.filter(o => o.stance[0] + o.stance[1] + o.stance[2] >= 30)
  const dots = all.map((o) => {
    const n = o.stance[0] + o.stance[1] + o.stance[2]
    return { name: o.name, n, x: 66 + (o.stance[0] / n) * 900, y: 14 + (1 - o.stance[2] / n) * 400, r: 4 + 8 * Math.sqrt(n / 5000) }
  })
  const plot = { x0: 66, x1: 1000, y0: 14, y1: 414 }
  const labels = placeLabels(dots, [], plot)
  assert.ok(labels.length > 0 && labels.length <= dots.length)
  for (const l of labels) {
    const w = l.name.length * 6.4 + 2
    assert.ok(l.x >= plot.x0 && l.x + w <= plot.x1 && l.y - 11 >= plot.y0 && l.y + 3 <= plot.y1, 'inside the plot')
    for (const d of dots) assert.ok(!(l.x < d.x + d.r && d.x - d.r < l.x + w && l.y - 11 < d.y + d.r && d.y - d.r < l.y + 3), `${l.name} is off the dot of ${d.name}`)
    for (const v of [l.x, l.y]) assert.equal(v, Math.round(v * 10000) / 10000)
  }
})
