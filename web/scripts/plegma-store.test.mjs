import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { createPinia, setActivePinia } from 'pinia'
import { usePlegmaStore } from '../app/stores/plegma.ts'
import { plegmaFocusOf } from '../app/utils/plegma-route.ts'

beforeEach(() => setActivePinia(createPinia()))
const route = (path, query = {}, plegma = true) => ({ path, query, meta: plegma ? { plegma: true } : {} })

test('a story address puts that story in focus, a topic address that theme, Home nothing', () => {
  const plegma = usePlegmaStore()
  plegma.syncRoute(route('/story', { id: '5' }))
  assert.deepEqual({ ...plegma.focus }, { kind: 'story', id: 5 })
  plegma.syncRoute(route('/topic', { i: '3' }))
  assert.deepEqual({ ...plegma.focus }, { kind: 'theme', issue: 3 })
  plegma.syncRoute(route('/'))
  assert.equal(plegma.focus, null)
  assert.equal(plegma.active, true)
})

test('a route without the plegma meta hides the stage and keeps the focus', () => {
  const plegma = usePlegmaStore()
  plegma.syncRoute(route('/story', { id: '5' }))
  plegma.syncRoute(route('/media', {}, false))
  assert.equal(plegma.active, false)
  assert.deepEqual({ ...plegma.focus }, { kind: 'story', id: 5 })
  plegma.syncRoute(route('/story', { id: '5' }))
  assert.equal(plegma.active, true)
})

test('the day and the comparison end when the focus moves to another story, and stay when it does not change', () => {
  const plegma = usePlegmaStore()
  plegma.syncRoute(route('/story', { id: '5' }))
  plegma.stepTo(12)
  plegma.compareWith(9)
  plegma.syncRoute(route('/story', { id: '5' }))
  assert.equal(plegma.day, 12)
  assert.equal(plegma.compare, 9)
  plegma.syncRoute(route('/story', { id: '6' }))
  assert.equal(plegma.day, null)
  assert.equal(plegma.compare, null)
})

test('a bad id puts nothing in focus', () => {
  for (const id of ['x', '', '-1', '1.5', undefined]) assert.equal(plegmaFocusOf('/story', { id }), null)
  assert.deepEqual(plegmaFocusOf('/story', { id: ['7', '8'] }), { kind: 'story', id: 7 })
  assert.equal(plegmaFocusOf('/story', {}), null)
})

test('a path with a trailing slash, as Netlify serves it, has the same focus', () => {
  assert.deepEqual(plegmaFocusOf('/story/', { id: '134' }), { kind: 'story', id: 134 })
  assert.deepEqual(plegmaFocusOf('/topic/', { i: '3' }), { kind: 'theme', issue: 3 })
  assert.equal(plegmaFocusOf('/', {}), null)
  const plegma = usePlegmaStore()
  plegma.syncRoute(route('/story/', { id: '134' }))
  assert.deepEqual({ ...plegma.focus }, { kind: 'story', id: 134 })
})
