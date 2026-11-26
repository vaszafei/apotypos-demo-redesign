import { test } from 'node:test'
import assert from 'node:assert/strict'
import { plegmaStoryColumns } from '../app/utils/plegma/plegma-story.ts'

const plain = value => JSON.parse(JSON.stringify(value))

test('a story with a profile has no left column, the stance and the other stories beside the map, no how card, and the days with the people under them', () => {
  assert.deepEqual(plain(plegmaStoryColumns(true)), { left: [], right: [['stance'], ['related']], under: ['days', 'people'] })
})

test('a story with no profile (October) has no how, stance or people card: the map, and the other stories on its right', () => {
  assert.deepEqual(plain(plegmaStoryColumns(false)), { left: [], right: [['related']], under: ['days'] })
})

test('the other stories of the theme and the days are in every story, with or without a profile, and the groups card is gone', () => {
  for (const labelled of [true, false]) {
    const { left, right, under } = plegmaStoryColumns(labelled)
    assert.ok([...left, ...right.flat()].includes('related') && under.includes('days'))
    assert.ok(![...left, ...right.flat(), ...under].includes('outlets'))
  }
})
