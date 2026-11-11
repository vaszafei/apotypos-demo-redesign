import { test } from 'node:test'
import assert from 'node:assert/strict'
import { plegmaStoryColumns } from '../app/utils/plegma-story.ts'

const plain = value => JSON.parse(JSON.stringify(value))

test('a story with a profile has the groups in the middle, and on the right its days with the stance and people beside how it was written under them', () => {
  assert.deepEqual(plain(plegmaStoryColumns(true)), { left: ['related'], middle: ['outlets'], right: { top: ['days'], columns: [['stance', 'people'], ['how']] } })
})

test('a story with no profile (October) has no how, stance or people card: only the days on the right', () => {
  assert.deepEqual(plain(plegmaStoryColumns(false)), { left: ['related'], middle: ['outlets'], right: { top: ['days'], columns: [] } })
})

test('the other stories of the theme, the days and the groups are in every story, with or without a profile', () => {
  for (const labelled of [true, false]) {
    const { left, middle, right } = plegmaStoryColumns(labelled)
    assert.ok(left.includes('related') && middle.includes('outlets') && right.top.includes('days'))
  }
})
