import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { createPinia, setActivePinia } from 'pinia'
import { useSessionStore, USER_KEY } from '../app/stores/session.ts'
import { pickPref } from '../app/stores/prefs.ts'

const memory = () => {
  const data = new Map()
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)), removeItem: (k) => data.delete(k), data }
}
let storage
beforeEach(() => {
  storage = memory()
  globalThis.localStorage = storage
  setActivePinia(createPinia())
})

test('the right name and password sign in, and the user stays in localStorage for a reload', () => {
  const session = useSessionStore()
  assert.equal(session.signedIn, false)
  assert.equal(session.signIn(' LoLoVios ', 'typosapo'), true)
  assert.equal(session.user, 'lolovios')
  assert.equal(storage.getItem(USER_KEY), 'lolovios')
  setActivePinia(createPinia())
  assert.equal(useSessionStore().user, 'lolovios')
})

test('a wrong password or an unknown name keeps the gate and stores nothing', () => {
  const session = useSessionStore()
  assert.equal(session.signIn('lolovios', 'wrong'), false)
  assert.equal(session.signIn('nobody', 'typosapo'), false)
  assert.equal(session.signIn('constructor', 'typosapo'), false)
  assert.equal(session.signedIn, false)
  assert.equal(storage.getItem(USER_KEY), null)
})

test('a user signed in on a static page is signed in here (same key, same accounts)', () => {
  storage.setItem(USER_KEY, 'odpein')
  assert.equal(useSessionStore().user, 'odpein')
})

test('a stored name that is not an account is ignored', () => {
  storage.setItem(USER_KEY, 'intruder')
  assert.equal(useSessionStore().user, null)
})

test('sign out clears the user and the key; refresh reads a change made elsewhere', () => {
  const session = useSessionStore()
  session.signIn('npizza', 'typosapo')
  session.signOut()
  assert.equal(session.user, null)
  assert.equal(storage.getItem(USER_KEY), null)
  storage.setItem(USER_KEY, 'odpein')
  session.refresh()
  assert.equal(session.user, 'odpein')
})

test('storage that cannot be written signs nobody in', () => {
  globalThis.localStorage = { getItem: () => null, setItem: () => { throw new Error('quota') }, removeItem: () => {} }
  assert.equal(useSessionStore().signIn('lolovios', 'typosapo'), false)
})

test('a switch value comes from the query, then the last choice, then the default; unknown values are ignored', () => {
  const themes = ['paper', 'night']
  assert.equal(pickPref('night', 'paper', themes, 'paper'), 'night')
  assert.equal(pickPref(null, 'night', themes, 'paper'), 'night')
  assert.equal(pickPref('purple', 'night', themes, 'paper'), 'night')
  assert.equal(pickPref('purple', null, themes, 'paper'), 'paper')
})
