// The rule of useFixture. Node 22 strips the types of a .ts file, so the test imports the util as it is.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixtureStatus } from '../app/utils/fixtureStatus.ts'

const rules = { required: ['dates', 'issues'], isEmpty: (b) => b.dates.length === 0 }
const body = { dates: ['2026-08-01'], issues: [] }

test('a body with its required fields is ready', () => assert.equal(fixtureStatus({ body, ...rules }), 'ready'))
test('no required field and no rule: any object is ready', () => assert.equal(fixtureStatus({ body: {} }), 'ready'))
test('a body the rule calls empty is empty', () => assert.equal(fixtureStatus({ body: { dates: [], issues: [] }, ...rules }), 'empty'))
test('a missing required field is an error, not a crash', () => assert.equal(fixtureStatus({ body: { dates: [] }, ...rules }), 'error'))
test('a null required field is an error', () => assert.equal(fixtureStatus({ body: { dates: null, issues: [] }, ...rules }), 'error'))
test('a failed request, no body or a body that is not an object is an error', () => {
  assert.equal(fixtureStatus({ body: null, failed: true, ...rules }), 'error')
  assert.equal(fixtureStatus({ body: null, ...rules }), 'error')
  assert.equal(fixtureStatus({ body: 'text', ...rules }), 'error')
})
test('a rule that throws is an error', () => assert.equal(fixtureStatus({ body, required: [], isEmpty: () => { throw new Error('x') } }), 'error'))
test('pending without a body is loading; pending with a body is not', () => {
  assert.equal(fixtureStatus({ body: null, pending: true, ...rules }), 'loading')
  assert.equal(fixtureStatus({ body, pending: true, ...rules }), 'ready')
})
test('?state=empty, ?state=error and ?state=bad force a state', () => {
  assert.equal(fixtureStatus({ body, forced: 'empty', ...rules }), 'empty')
  assert.equal(fixtureStatus({ body, forced: 'error', ...rules }), 'error')
  assert.equal(fixtureStatus({ body, forced: 'bad', ...rules }), 'error')
  assert.equal(fixtureStatus({ body, forced: 'bad' }), 'ready')
  assert.equal(fixtureStatus({ body, forced: 'other', ...rules }), 'ready')
})
