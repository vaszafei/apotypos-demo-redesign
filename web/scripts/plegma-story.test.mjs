import { test } from 'node:test'
import assert from 'node:assert/strict'
import { plegmaStoryColumns } from '../app/utils/plegma-story.ts'

test('a story with a profile has the charts on the right, the cards about its taking in the middle and the related stories on the left', () => {
  assert.deepEqual({ ...plegmaStoryColumns(true) }, { left: ['related'], middle: ['stance', 'how', 'people'], right: ['days', 'outlets'] })
})

test('a story with no profile (October) has no how, stance or people card: the related stories are in the middle and the left is the title and the map', () => {
  assert.deepEqual({ ...plegmaStoryColumns(false) }, { left: [], middle: ['related'], right: ['days', 'outlets'] })
})

test('the related stories and the two charts are in every story, with or without a profile', () => {
  for (const labelled of [true, false]) {
    const { left, middle, right } = plegmaStoryColumns(labelled)
    assert.ok([...left, ...middle].includes('related') && right.includes('days') && right.includes('outlets'))
  }
})
