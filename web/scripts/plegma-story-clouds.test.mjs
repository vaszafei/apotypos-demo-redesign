import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { BRANCH_AXIS } from '../app/utils/plegma/plegma-branches.ts'
import { athensLocal, buildCloudWeb, cloudLabel, cloudUnit } from '../app/utils/plegma/plegma-story-clouds.ts'
import { fullData } from './lib/full-data.mjs'

const detail = fullData('storyDetail')
const dir = new URL('../../docs/redesign/prototypes/data/story-times/', import.meta.url)
const storyOf = (id) => {
  const row = JSON.parse(readFileSync(new URL(`${id % 50}.json`, dir), 'utf8'))[id]
  const names = [...new Set(detail.outlets.map(o => o.group ?? '-'))]
  const times = []
  const groups = []
  for (let i = 1; i < row.length; i += 2) { times.push(row[0] + row[i + 1]); groups.push(names.indexOf(detail.outlets[row[i]].group ?? '-')) }
  return { times, groups }
}
const BOX = { w: 1150, h: 470 }
const build = (story, seed = 1) => buildCloudWeb({ ...story, seed, ...BOX, left: 130, right: 24 })
const SAMPLES = [8723, 8236, 7765, 8234, 7851]
const DAY = 1440
// 26 Oct 2026, 09:00 Athens (after the clocks went back: UTC+2).
const at = (d, hh, mm = 0) => Date.UTC(2026, 9, d, hh - (d >= 25 ? 2 : 3), mm) / 60000

test('the unit: at most 9 clouds of the shortest stretch; 5 days or more are days, more than 8 days with articles are weeks', () => {
  assert.equal(cloudUnit([at(26, 9), at(26, 9, 3), at(26, 9, 7)]), 5)
  assert.equal(cloudUnit(Array.from({ length: 12 }, (_, k) => at(26, 9 + k))), 180)
  assert.equal(cloudUnit([14, 15, 16, 17, 18].map(d => at(d, 12))), DAY)
  assert.equal(cloudUnit([14, 15, 16, 17, 18, 19, 20, 21, 22, 23].map(d => at(d, 12))), 7 * DAY)
  for (const id of SAMPLES) {
    const unit = cloudUnit(storyOf(id).times)
    assert.ok(build(storyOf(id), id).clouds.length <= 9, `story ${id}: ${unit} min`)
  }
})

test('every article after the first is in one cloud, in order of time; every node is inside the area above the labels', () => {
  for (const id of SAMPLES) {
    const story = storyOf(id)
    const web = build(story, id)
    assert.equal(web.n, story.times.length)
    const local = story.times.map(athensLocal)
    for (let i = 1; i < web.n; i++) {
      const k = web.clouds.filter(c => local[i] >= c.from && local[i] < c.to).length
      assert.equal(k, 1, `story ${id}: article ${i} in one cloud`)
      assert.ok(web.x[i] > web.x[0] && web.x[i] <= BOX.w / 2 && web.y[i] >= -BOX.h / 2 && web.y[i] <= BOX.h / 2 - BRANCH_AXIS, `story ${id}: node ${i} inside`)
    }
    for (let k = 1; k < web.clouds.length; k++) assert.ok(web.clouds[k].cx > web.clouds[k - 1].cx && web.clouds[k].from >= web.clouds[k - 1].to, `story ${id}: cloud ${k} after the one before`)
  }
})

test('nodes keep apart: no two are nearer than twice their radius', () => {
  for (const id of SAMPLES) {
    const web = build(storyOf(id), id)
    for (let i = 1; i < web.n; i++) for (let j = i + 1; j < web.n; j++) assert.ok(Math.hypot(web.x[i] - web.x[j], web.y[i] - web.y[j]) >= web.r * 2, `story ${id}: nodes ${i} and ${j}`)
  }
})

test('the lines: a thread from the start node through the first node of each cloud, and every other node to an earlier node of its cloud', () => {
  for (const id of SAMPLES) {
    const story = storyOf(id)
    const web = build(story, id)
    const local = story.times.map(athensLocal)
    const cloudOf = i => web.clouds.findIndex(c => local[i] >= c.from && local[i] < c.to)
    assert.equal(web.threads, web.clouds.length)
    web.clouds.forEach((c, k) => {
      assert.equal(web.edges[k * 2], c.node)
      assert.equal(web.edges[k * 2 + 1], k ? web.clouds[k - 1].node : 0)
    })
    const into = new Set()
    for (let e = web.threads; e < web.edges.length / 2; e++) {
      const i = web.edges[e * 2]
      const j = web.edges[e * 2 + 1]
      assert.ok(j < i && cloudOf(i) === cloudOf(j), `story ${id}: edge ${i}→${j}`)
      into.add(i)
    }
    assert.equal(into.size + web.threads, web.n - 1, `story ${id}: each node has one line`)
  }
})

test('the labels: days, weeks, clock times with the day when it changes', () => {
  const day = m => `d${Math.floor(m / DAY) % 100}`
  const range = (a, b) => `${day(a)}–${day(b)}`
  const c = (from, unit) => ({ node: 1, cx: 0, labelY: 0, from, to: from + unit })
  const d0 = Date.UTC(2026, 9, 26) / 60000
  assert.equal(cloudLabel([c(d0, DAY)], 0, DAY, day, range), day(d0))
  assert.equal(cloudLabel([c(d0, 7 * DAY)], 0, 7 * DAY, day, range), `${day(d0)}–${day(d0 + 6 * DAY)}`)
  const hours = [c(d0 + 18 * 60, 360), c(d0 + 24 * 60, 360), c(d0 + 30 * 60, 360)]
  assert.deepEqual(hours.map((_, k) => cloudLabel(hours, k, 360, day, range)), [`${day(d0)}, 18:00–24:00`, `${day(d0 + DAY)}, 00:00–06:00`, '06:00–12:00'])
  const mins = [c(d0 + 9 * 60, 10), c(d0 + 9 * 60 + 10, 10)]
  assert.deepEqual(mins.map((_, k) => cloudLabel(mins, k, 10, day, range)), [`${day(d0)}, 09:00`, '09:10'])
})

test('edge cases: no articles, one article, a story in one minute', () => {
  assert.equal(build({ times: [], groups: [] }).n, 0)
  const one = build({ times: [at(26, 9)], groups: [0] })
  assert.equal(one.n, 1)
  assert.equal(one.clouds.length, 0)
  const burst = build({ times: [at(26, 9), at(26, 9), at(26, 9)], groups: [0, 1, 0] })
  assert.equal(burst.clouds.length, 1)
  assert.ok([...burst.x, ...burst.y].every(Number.isFinite))
})

test('the largest sample story is laid out in under 50 ms', () => {
  const story = storyOf(SAMPLES.reduce((a, b) => (storyOf(a).times.length >= storyOf(b).times.length ? a : b)))
  const t = performance.now()
  build(story, 3)
  const ms = performance.now() - t
  assert.ok(ms < 50, `${story.times.length} articles: ${ms.toFixed(1)} ms`)
})
