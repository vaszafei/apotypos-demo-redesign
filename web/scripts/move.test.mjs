import { test } from 'node:test'
import assert from 'node:assert/strict'
import { directionOf, stepOf } from '../app/utils/move.ts'

test('a move to another section slides sideways, in the order of the navbar', () => {
  assert.equal(directionOf('/trends', '/fingerprints', true), 'right')
  assert.equal(directionOf('/fingerprints', '/trends', false), 'left')
})
test('a move to another tab slides down or up on a wide screen and sideways on a phone', () => {
  assert.equal(directionOf('/media', '/trends', true), 'down')
  assert.equal(directionOf('/trends', '/media', true), 'up')
  assert.equal(directionOf('/media', '/trends', false), 'right')
  assert.equal(directionOf('/trends', '/media', false), 'left')
})
test('a page with no place in the order, or the same page, has no direction', () => {
  assert.equal(stepOf('/topic'), null)
  assert.equal(directionOf('/trends', '/topic', true), null)
  assert.equal(directionOf('/trends', '/trends', true), null)
  assert.equal(directionOf('/methodology', '/trends', true), null)
})
