import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { correlation, topicStats, storiesOfTopic, topicArticles, outletDiffs, similarTopics, lastCoded, MIN_LINK } from '../app/utils/topic-detail.ts'

const read = name => JSON.parse(readFileSync(new URL(`../public/data/${name}.json`, import.meta.url), 'utf8'))
const home = read('home')
const list = read('stories')
const dd = read('storyDetail')
const page = readFileSync(new URL('../../docs/redesign/prototypes/topic-v2.html', import.meta.url), 'utf8')

// The static page keeps its correlation in the inline script of topic-v2.html: the text between "const sum" and Shell.start is run as it is.
const inline = page.slice(page.indexOf('const sum ='), page.indexOf('Shell.start'))
const staticCorrelation = runInNewContext(`${inline}\ncorrelation`, {})

test('the correlation is that of the static page for every pair of the first 8 topics', () => {
  const last = lastCoded(home)
  for (let a = 0; a < 8; a++) {
    for (let b = 0; b < 8; b++) {
      const x = home.issueDaily[a].slice(0, last + 1)
      const y = home.issueDaily[b].slice(0, last + 1)
      assert.equal(correlation(x, y), staticCorrelation(x, y))
    }
  }
  assert.equal(correlation([1, 2, 3], [2, 4, 6]), 1)
  assert.equal(correlation([1, 1, 1], [1, 2, 3]), 0)
})

test('the last coded day is the last day with a count in any topic', () => {
  const last = lastCoded(home)
  assert.ok(home.issueDaily.some(row => row[last] !== null))
  assert.ok(home.issueDaily.every(row => row.slice(last + 1).every(v => v === null)))
})

test('the stats: the total is the sum of the line, the ranks are 1 to n, the shares sum to 1', () => {
  const all = home.issues.map((_, k) => topicStats(home, k))
  assert.deepEqual(all.map(s => s.rank).sort((a, b) => a - b).slice(0, 1), [1])
  assert.ok(Math.abs(all.reduce((s, x) => s + x.share, 0) - 1) < 1e-9)
  for (const s of all) assert.equal(s.total, s.daily.reduce((a, v) => a + (v ?? 0), 0))
  const withChange = all.find(s => s.change !== null)
  assert.ok(withChange)
})

test('the change is the last 14 days against the 14 before, and none under 200 articles before', () => {
  const stats = { ...home, issueDaily: [[...new Array(28).fill(10), null], [...new Array(28).fill(20), null]], issues: [{}, {}] }
  const small = topicStats(stats, 0)
  assert.equal(small.change, null)
  const big = topicStats({ ...stats, issueDaily: [[...new Array(14).fill(20), ...new Array(14).fill(40)]] }, 0)
  assert.equal(big.change, 1)
})

test('the stories of a topic are not generic, the largest first, and have a line of the whole window', () => {
  for (let k = 0; k < home.issues.length; k++) {
    const mine = storiesOfTopic(list, k)
    assert.ok(mine.every(s => !s.generic && s.issue === k && s.values.length === list.dates.length))
    assert.ok(mine.every((s, i) => i === 0 || mine[i - 1].articles >= s.articles))
    assert.ok(mine.every(s => s.values.reduce((a, b) => a + b, 0) === s.articles))
  }
})

test('the articles of a topic are part of the articles of all topics, and an outlet needs 200', () => {
  const a = topicArticles(list, dd, 0)
  assert.ok(a.outletTopic.every((v, i) => v <= a.outletAll[i]))
  assert.equal(a.outletTopic.reduce((x, y) => x + y, 0), a.rowsTopic)
  const { rows, more, less } = outletDiffs(dd, a)
  assert.ok(rows.every(r => r.n >= 200))
  assert.ok(more.length <= 6 && less.length <= 6)
  assert.ok(more.every((r, i) => i === 0 || more[i - 1].value - more[i - 1].usual >= r.value - r.usual))
})

test('the similar topics: no catch-all, not the topic itself, at least the link and the best first', () => {
  for (let k = 0; k < home.issues.length; k++) {
    const sim = similarTopics(home, k)
    assert.ok(sim.length <= 5)
    assert.ok(sim.every(r => r.k !== k && !r.issue.catchAll && r.r >= MIN_LINK))
    assert.ok(sim.every((r, i) => i === 0 || sim[i - 1].r >= r.r))
  }
})
