import { test } from 'node:test'
import assert from 'node:assert/strict'
import { plegmaStoryColumns } from '../app/utils/plegma-story.ts'

const plain = value => JSON.parse(JSON.stringify(value))

test('a story with a profile has the other stories on the left, the stance with the people and how it was written beside the map, and the days under them', () => {
  assert.deepEqual(plain(plegmaStoryColumns(true)), { left: ['related'], right: [['stance', 'people'], ['how']], under: ['days'] })
})

test('a story with no profile (October) has no how, stance or people card: the map has its row alone', () => {
  assert.deepEqual(plain(plegmaStoryColumns(false)), { left: ['related'], right: [], under: ['days'] })
})

test('the other stories of the theme and the days are in every story, with or without a profile, and the groups card is gone', () => {
  for (const labelled of [true, false]) {
    const { left, right, under } = plegmaStoryColumns(labelled)
    assert.ok(left.includes('related') && under.includes('days'))
    assert.ok(![...left, ...right.flat(), ...under].includes('outlets'))
  }
})
