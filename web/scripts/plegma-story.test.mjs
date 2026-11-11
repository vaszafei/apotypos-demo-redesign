import { test } from 'node:test'
import assert from 'node:assert/strict'
import { plegmaStoryColumns } from '../app/utils/plegma-story.ts'

test('a story with a profile has its days, stance and people on the right, the groups and how it was written in two narrow columns in the middle and the other stories of the theme on the left', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(plegmaStoryColumns(true))), { left: ['related'], middle: [['outlets'], ['how']], right: ['days', 'stance', 'people'] })
})

test('a story with no profile (October) has no how, stance or people card: the groups are in the middle and the days on the right', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(plegmaStoryColumns(false))), { left: ['related'], middle: [['outlets']], right: ['days'] })
})

test('the other stories of the theme, the days and the groups are in every story, with or without a profile', () => {
  for (const labelled of [true, false]) {
    const { left, middle, right } = plegmaStoryColumns(labelled)
    assert.ok(left.includes('related') && right.includes('days') && middle.flat().includes('outlets'))
  }
})
