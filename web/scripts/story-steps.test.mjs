import { test } from 'node:test'
import assert from 'node:assert/strict'
import { STEPS_MAX, athensWall, stepParts, storySteps } from '../app/utils/plegma/story-steps.ts'

const at = iso => Date.parse(iso) / 60000
const art = (iso, group = 'A', outlet = 'a', order = 0, outletOrder = 0) => ({ time: at(iso), group, outlet, slot: 1, order, outletOrder })

test('the Athens wall clock: UTC+3 before 25 Oct 2026, UTC+2 after', () => {
  assert.equal(athensWall(at('2026-10-20T10:00:00Z')), at('2026-10-20T13:00:00Z'))
  assert.equal(athensWall(at('2026-10-26T10:00:00Z')), at('2026-10-26T12:00:00Z'))
})

test('the step is the smallest that keeps the story to 96 steps', () => {
  assert.equal(storySteps([art('2026-10-20T10:00:00Z'), art('2026-10-20T15:00:00Z')]).step, 10)
  assert.equal(storySteps([art('2026-10-20T10:00:00Z'), art('2026-10-21T10:00:00Z')]).step, 30)
  assert.equal(storySteps([art('2026-10-20T10:00:00Z'), art('2026-10-22T10:00:00Z')]).step, 60)
  const long = storySteps([art('2026-10-14T10:00:00Z'), art('2026-10-27T10:00:00Z')])
  assert.equal(long.step, 1440)
  assert.equal(long.steps.length, 14)
  assert.ok(long.steps.length <= STEPS_MAX)
})

test('the axis starts at the first article; each step has its articles and their time range', () => {
  const list = [art('2026-10-20T10:03:00Z'), art('2026-10-20T10:07:00Z'), art('2026-10-20T10:42:00Z')]
  const { steps } = storySteps(list)
  assert.deepEqual(steps.map(s => [s.date, s.clock, s.n]), [['2026-10-20', '13:00', 2], ['2026-10-20', '13:10', 0], ['2026-10-20', '13:20', 0], ['2026-10-20', '13:30', 0], ['2026-10-20', '13:40', 1]])
  assert.deepEqual([steps[0].from, steps[0].to], [list[0].time, list[1].time])
  assert.equal(steps[1].from, Infinity)
})

test('a day is an Athens day', () => {
  const { steps } = storySteps([art('2026-10-14T22:30:00Z'), art('2026-10-27T10:00:00Z')])
  assert.equal(steps[0].date, '2026-10-15')
})

test('the parts of a step: groups in the story order, outlets together by group', () => {
  const list = [art('2026-10-20T10:00:00Z', 'B', 'b1', 1, 0), art('2026-10-20T10:01:00Z', 'A', 'a2', 0, 2), art('2026-10-20T10:02:00Z', 'A', 'a1', 0, 1), art('2026-10-20T10:03:00Z', 'A', 'a1', 0, 1)]
  const [s] = storySteps(list).steps
  assert.deepEqual(stepParts(s, 'groups').map(p => [p.name, p.n]), [['A', 3], ['B', 1]])
  assert.deepEqual(stepParts(s, 'outlets').map(p => [p.name, p.n]), [['a1', 2], ['a2', 1], ['b1', 1]])
})
