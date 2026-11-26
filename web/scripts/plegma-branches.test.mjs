import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { BRANCH_AXIS, branchLag, buildBranchWeb, placeBranchNames } from '../app/utils/plegma/plegma-branches.ts'
import { fullData } from './lib/full-data.mjs'

const detail = fullData('storyDetail')
const dir = new URL('../../docs/redesign/prototypes/data/story-times/', import.meta.url)
// The articles of a story in order of time, each with its minute and the group of its outlet (a number, as the stage's group order).
const storyOf = (id) => {
  const row = JSON.parse(readFileSync(new URL(`${id % 50}.json`, dir), 'utf8'))[id]
  const names = [...new Set(detail.outlets.map(o => o.group ?? '-'))]
  const times = []
  const groups = []
  for (let i = 1; i < row.length; i += 2) { times.push(row[0] + row[i + 1]); groups.push(names.indexOf(detail.outlets[row[i]].group ?? '-')) }
  return { times, groups }
}
const BOX = { w: 1150, h: 470 }
const build = (story, seed = 1) => buildBranchWeb({ ...story, seed, ...BOX, left: 130, right: 180 })
const SAMPLES = [8723, 8236, 7765, 8234, 7851]
const athensClock = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Athens', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

test('the start node is the first article, at the left, and every node is inside the area above the axis', () => {
  for (const id of SAMPLES) {
    const web = build(storyOf(id), id)
    assert.equal(web.n, storyOf(id).times.length)
    for (let i = 1; i < web.n; i++) {
      assert.ok(web.x[i] > web.x[0], `story ${id}: node ${i} is right of the start`)
      assert.ok(web.x[i] <= BOX.w / 2 && web.y[i] >= -BOX.h / 2 && web.y[i] <= BOX.h / 2 - BRANCH_AXIS, `story ${id}: node ${i} inside`)
    }
  }
})

test('nodes keep apart: no two are nearer than twice their radius', () => {
  for (const id of SAMPLES) {
    const web = build(storyOf(id), id)
    for (let i = 1; i < web.n; i++) for (let j = i + 1; j < web.n; j++) assert.ok(Math.hypot(web.x[i] - web.x[j], web.y[i] - web.y[j]) >= web.r * 2, `story ${id}: nodes ${i} and ${j}`)
  }
})

test('the first article of each group is joined to the start node, every other one to an earlier article of its group', () => {
  for (const id of SAMPLES) {
    const story = storyOf(id)
    const web = build(story, id)
    const seen = new Set()
    const to = new Map()
    for (let e = 0; e < web.edges.length; e += 2) to.set(web.edges[e], web.edges[e + 1])
    assert.equal(to.size, web.n - 1)
    for (let i = 1; i < web.n; i++) {
      const g = story.groups[i]
      const j = to.get(i)
      if (!seen.has(g)) { assert.equal(j, 0, `story ${id}: first of group ${g}`); seen.add(g); continue }
      assert.ok(j === 0 || (j < i && story.groups[j] === g), `story ${id}: node ${i} joined to ${j}`)
    }
  }
})

test('each branch has its end, the largest first, and the shares add up to the whole story', () => {
  for (const id of SAMPLES) {
    const web = build(storyOf(id), id)
    const sizes = web.ends.map(e => e.share)
    assert.deepEqual(sizes, [...sizes].sort((a, b) => b - a))
    const groups = new Set(storyOf(id).groups)
    const sum = web.ends.reduce((s, e) => s + e.share, 0) + (web.ends.some(e => e.group === storyOf(id).groups[0]) ? 0 : 1 / web.n)
    assert.ok(Math.abs(sum - 1) < 1e-9, `story ${id}: shares ${sum}`)
    assert.ok(web.ends.length <= groups.size)
  }
})

test('the axis starts at the start node; its days are Athens midnights and its hours are on the clock', () => {
  for (const id of SAMPLES) {
    const story = storyOf(id)
    const web = build(story, id)
    assert.deepEqual([web.ticks[0].kind, web.ticks[0].x, web.ticks[0].minute], ['start', web.x[0], story.times[0]])
    for (const tick of web.ticks.slice(1)) {
      const clock = athensClock.format(new Date(tick.minute * 60000))
      if (tick.kind === 'day') assert.equal(clock, '00:00', `story ${id}`)
      else assert.equal(Number(clock.slice(3)) % 5, 0, `story ${id}: ${clock}`)
    }
    const xs = web.ticks.map(t => t.x).sort((a, b) => a - b)
    for (let k = 1; k < xs.length; k++) assert.ok(xs[k] - xs[k - 1] >= 46, `story ${id}: ticks too near`)
  }
  // 8234 is mostly inside its first day, so it has hours; 7851 runs for two weeks, so it has days only.
  assert.ok(build(storyOf(8234)).ticks.some(t => t.kind === 'hour'))
  assert.ok(!build(storyOf(7851)).ticks.some(t => t.kind === 'hour'))
})

test('names meet no node and no other name, and stay inside the area', () => {
  const width = (text, size) => text.length * size * 0.54
  for (const id of SAMPLES) {
    const web = build(storyOf(id), id)
    const asks = [...web.firsts.slice(0, 4).map(i => ({ x: web.x[i] + 8, y: web.y[i] - 7, text: 'Outlet +3 λ.' })), ...web.ends.map(e => ({ x: web.x[e.node] + 12, y: web.y[e.node] + 4, text: 'Group · 12,5%', dot: 1 }))]
    const names = placeBranchNames(web, asks, BOX, width)
    const boxes = names.map((n) => {
      const w = width(n.text, n.size) + (n.dot >= 0 ? 10 : 0)
      return { x0: n.x, x1: n.x + w, y0: n.y - n.size * 0.8, y1: n.y + n.size * 0.45 }
    })
    boxes.forEach((b, k) => {
      assert.ok(b.x1 <= BOX.w / 2 && b.y0 >= -BOX.h / 2, `story ${id}: name ${k} inside`)
      for (let q = k + 1; q < boxes.length; q++) assert.ok(!(b.x0 < boxes[q].x1 && b.x1 > boxes[q].x0 && b.y0 < boxes[q].y1 && b.y1 > boxes[q].y0), `story ${id}: names ${k} and ${q}`)
      for (let i = 0; i < web.n; i++) assert.ok(!(b.x0 < web.x[i] + web.r && b.x1 > web.x[i] - web.r && b.y0 < web.y[i] + web.r && b.y1 > web.y[i] - web.r), `story ${id}: name ${k} over node ${i}`)
    })
  }
})

test('a story of one article, of one group, and of articles in one minute lay out', () => {
  const one = buildBranchWeb({ times: [100], groups: [0], seed: 1, ...BOX, left: 100, right: 100 })
  assert.equal(one.n, 1)
  assert.equal(one.edges.length, 0)
  const same = buildBranchWeb({ times: [100, 100, 100, 100], groups: [2, 2, 2, 2], seed: 1, ...BOX, left: 100, right: 100 })
  assert.equal(same.ends.length, 1)
  assert.ok([...same.x, ...same.y].every(Number.isFinite))
})

test('the largest story lays out in a frame or two', () => {
  const story = storyOf(7851)
  const t0 = performance.now()
  build(story, 7851)
  assert.ok(performance.now() - t0 < 50, `${performance.now() - t0} ms`)
})

test('the lag after the first article is said in minutes, hours or days', () => {
  assert.deepEqual(branchLag(0), { key: 'story.branches.same', n: 0 })
  assert.deepEqual(branchLag(25), { key: 'story.branches.min', n: 25 })
  assert.deepEqual(branchLag(185), { key: 'story.branches.hours', n: 3 })
  assert.deepEqual(branchLag(3000), { key: 'story.branches.days', n: 2 })
})
