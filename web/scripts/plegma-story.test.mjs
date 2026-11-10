import { test } from 'node:test'
import assert from 'node:assert/strict'
import { plegmaStoryCards } from '../app/utils/plegma-story.ts'

test('a story with a profile has four headline cards, in the slot order, and stance and people behind chips', () => {
  const { headline, dock } = plegmaStoryCards(true)
  assert.deepEqual(headline, ['days', 'outlets', 'how', 'related'])
  assert.deepEqual(dock, ['stance', 'people'])
})

test('a story with no profile (October) has no how, stance or people card: three headline cards and no dock', () => {
  const { headline, dock } = plegmaStoryCards(false)
  assert.deepEqual(headline, ['days', 'outlets', 'related'])
  assert.equal(dock.length, 0)
})

test('the related stories card is in every story, with or without a profile', () => {
  for (const labelled of [true, false]) assert.ok(plegmaStoryCards(labelled).headline.includes('related'))
})
