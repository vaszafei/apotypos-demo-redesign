import { test } from 'node:test'
import assert from 'node:assert/strict'
import { plegmaStoryColumns } from '../app/utils/plegma/plegma-story.ts'

const plain = value => JSON.parse(JSON.stringify(value))

test('a story with a profile has no left column, the stance and the other stories beside the map, no how card, and the days with the people under them', () => {
  assert.deepEqual(plain(plegmaStoryColumns(true)), { left: [], right: [['stance'], ['related']], under: ['days', 'people'] })
})

test('a story with no profile (October) has no how, stance, people or days card: the map, the other stories on its right, and its views under the map (the days are drawn in the Plegma)', () => {
  assert.deepEqual(plain(plegmaStoryColumns(false)), { left: [], right: [['related']], under: [] })
})

test('the other stories of the theme are in every story, the days card only in a story with a profile, and the groups card is gone', () => {
  for (const labelled of [true, false]) {
    const { left, right, under } = plegmaStoryColumns(labelled)
    assert.ok([...left, ...right.flat()].includes('related') && under.includes('days') === labelled)
    assert.ok(![...left, ...right.flat(), ...under].includes('outlets'))
  }
})
