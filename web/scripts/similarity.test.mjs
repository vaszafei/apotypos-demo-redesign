import { test } from 'node:test'
import assert from 'node:assert/strict'
import { embed, SIM_MAJOR, neighbours, similarityOf } from '../app/utils/similarity.ts'
import { fullData } from './lib/full-data.mjs'

const detail = fullData('storyDetail')
const sim = similarityOf(detail)
const at = name => sim.outlets.findIndex(o => o.name === name)

test('only the outlets with enough days and stories are compared', () => {
  assert.ok(sim.outlets.length >= 20)
  assert.equal(at('CNN Greece'), -1)
  assert.ok(sim.outlets.every(o => o.days >= 28 && o.stories >= 300))
})

test('the score of a pair is symmetric and between 0 and 1', () => {
  const k = sim.outlets.length
  for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) {
    assert.equal(sim.score[i][j], sim.score[j][i])
    if (sim.score[i][j] !== null) assert.ok(sim.score[i][j] >= 0 && sim.score[i][j] <= 1)
  }
})

test('the closest pairs are the big six and Capital with Insider.gr', () => {
  const near = neighbours(sim, at('Iefimerida'), 3).near.map(e => sim.outlets[e.j].name)
  assert.ok(near.includes('Proto Thema') && near.includes('Parapolitika'))
  assert.equal(sim.outlets[neighbours(sim, at('Capital'), 1).near[0].j].name, 'Insider.gr')
})

test('a missed story was written by at least SIM_MAJOR outlets, and the biggest come first', () => {
  const m = sim.missed[at('TVXS')]
  assert.ok(m.stories.length > 0 && m.considered >= m.stories.length)
  assert.ok(m.stories.every((s, i) => s.outlets >= SIM_MAJOR && (i === 0 || m.stories[i - 1].outlets >= s.outlets)))
})

test('the place of the outlets is the same every time', () => {
  const size = sim.outlets.map(o => o.articles)
  assert.deepEqual(embed(sim.score, size), embed(sim.score, size))
})
