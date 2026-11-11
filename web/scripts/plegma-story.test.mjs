import { test } from 'node:test'
import assert from 'node:assert/strict'
import { plegmaStoryColumns } from '../app/utils/plegma-story.ts'

test('a story with a profile has the charts on the right, the cards about its taking in two narrow columns in the middle and the other stories of the theme on the left', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(plegmaStoryColumns(true))), { left: ['related'], middle: [['stance', 'people'], ['how']], right: ['days', 'outlets'] })
})

test('a story with no profile (October) has no how, stance or people card, so the middle is empty', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(plegmaStoryColumns(false))), { left: ['related'], middle: [], right: ['days', 'outlets'] })
})

test('the other stories of the theme and the two charts are in every story, with or without a profile', () => {
  for (const labelled of [true, false]) {
    const { left, right } = plegmaStoryColumns(labelled)
    assert.ok(left.includes('related') && right.includes('days') && right.includes('outlets'))
  }
})
