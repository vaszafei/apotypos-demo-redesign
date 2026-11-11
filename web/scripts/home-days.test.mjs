import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dayTotals, dayChange, monthsOf, lastCounted } from '../app/utils/home-days.ts'

test('a day total sums the outlets that have a count and is null when none has', () => {
  const outlets = [{ daily: [1, 2, null] }, { daily: [3, null, null] }]
  assert.deepEqual(dayTotals(outlets, 3), [4, 2, null])
})

test('the change is a percentage against the day before, null where there is nothing to compare', () => {
  const totals = [100, 150, 0, 40, null]
  assert.equal(dayChange(totals, 0), null)
  assert.equal(dayChange(totals, 1), 50)
  assert.equal(dayChange(totals, 2), -100)
  assert.equal(dayChange(totals, 3), null)
  assert.equal(dayChange(totals, 4), null)
})

test('months and the last counted day', () => {
  assert.deepEqual(monthsOf(['2026-08-30', '2026-08-31', '2026-09-01']), ['2026-08', '2026-09'])
  assert.equal(lastCounted([5, 6, null, null]), 1)
  assert.equal(lastCounted([null]), 0)
})
