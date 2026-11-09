import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { mmeSummary, mmeDaily } from '../app/utils/mme.ts'

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
