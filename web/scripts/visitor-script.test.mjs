import { test } from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { visitorScript, MOVE_HOLD } from '../app/utils/visitorScript.ts'
import { NAV } from '../app/composables/useNav.ts'

const nav = NAV.map(s => ({ to: s.to, tabs: s.tabs.map(t => t.to) }))
const ported = [{ html: 'topics-v2.html', route: '/trends' }]

// Runs the inline script of the <head> against a stand-in browser.
const run = ({ search = '', pathname = '/trends', local = {}, session = {}, reduce = false, wide = true, now = 5, navType = 'navigate', activation, date = 1000 } = {}) => {
  const classes = new Set()
  const style = new Map()
  const root = { dataset: {}, classList: { add: c => classes.add(c) }, style: { setProperty: (k, v) => style.set(k, v), removeProperty: k => style.delete(k) } }
  const listeners = {}
  let clock = now
  const win = {
    document: { documentElement: root, querySelector: () => ({ getBoundingClientRect: () => ({ top: 56 }) }) },
    location: { search, pathname, href: `http://x.test${pathname}${search}` },
    addEventListener: (type, fn) => { listeners[type] = fn },
    localStorage: { getItem: k => local[k] ?? null },
    sessionStorage: { getItem: k => session[k] ?? null, removeItem: k => { delete session[k] } },
    matchMedia: q => ({ matches: q.includes('min-width') ? wide : reduce }),
    performance: { now: () => (clock += 1), getEntriesByType: () => [{ type: navType }] },
    navigation: activation ? { activation: { navigationType: activation } } : undefined,
    URLSearchParams,
    URL,
    JSON
  }
  win.window = win
  vm.runInNewContext(`var window=this.window,document=window.document,location=window.location,localStorage=window.localStorage,sessionStorage=window.sessionStorage,matchMedia=window.matchMedia,addEventListener=window.addEventListener,performance=window.performance,navigation=window.navigation;${visitorScript(['el', 'en'], nav, ported)}`, { ...win, Date: { now: () => date } })
  // The browser reveals the page: gives the listener a view transition and reports what it did with it.
  const reveal = () => {
    const calls = []
    const transition = { ready: { catch: () => calls.push('ready.catch') }, skipTransition: () => calls.push('skip'), finished: { finally: fn => { calls.push('finished.finally'); transition.done = fn } } }
    listeners.pagereveal?.({ viewTransition: transition })
    return { calls, vt: root.dataset.vt, oldY: style.get('--vt-old-y'), session }
  }
  return { data: root.dataset, classes, waitedUntil: clock, reveal }
}

test('a visitor with nothing stored gets the defaults the page was built with', () => {
  const { data } = run()
  assert.deepEqual({ ...data }, { font: 'plex', theme: 'paper', icons: 'off' })
})
test('the query, then the last choice, then the default; unknown values are ignored', () => {
  assert.equal(run({ search: '?theme=terra', local: { 'proto-theme': 'night' } }).data.theme, 'terra')
  assert.equal(run({ local: { 'proto-theme': 'night' } }).data.theme, 'night')
  assert.equal(run({ search: '?theme=purple', local: { 'proto-theme': 'nope' } }).data.theme, 'paper')
})
test('a stored account marks the page signed in; anyone else does not', () => {
  assert.equal('signedIn' in run({ local: { 'proto-user': 'lolovios' } }).data, true)
  assert.equal('signedIn' in run({ local: { 'proto-user': 'intruder' } }).data, false)
})
test('English is pending; Greek and unknown languages are not', () => {
  assert.equal('langPending' in run({ search: '?lang=en' }).data, true)
  assert.equal('langPending' in run({ local: { 'apotypos-locale': 'en' } }).data, true)
  assert.equal('langPending' in run({ search: '?lang=el' }).data, false)
  assert.equal('langPending' in run({ search: '?lang=fr' }).data, false)
})
test('the charts wait for their first view unless the visitor reduces motion', () => {
  assert.equal(run().classes.has('m-intro'), true)
  assert.equal(run({ reduce: true }).classes.has('m-intro'), false)
})
test('a pending move holds the first frame; a page opened directly does not', () => {
  const pending = JSON.stringify({ from: '/media', nav: true, time: 900 })
  assert.ok(run({ session: { 'm-move': pending } }).waitedUntil >= MOVE_HOLD)
  assert.ok(run({ session: { 'm-move': JSON.stringify({ from: '/media', time: 900 }) }, activation: 'traverse' }).waitedUntil >= MOVE_HOLD)
  assert.ok(run().waitedUntil < MOVE_HOLD)
  assert.ok(run({ session: { 'm-move': JSON.stringify({ from: '/media', nav: true, time: 100 }) }, date: 10000 }).waitedUntil < MOVE_HOLD, 'a move older than 5 seconds is not pending')
  assert.ok(run({ session: { 'm-move': 'not json' } }).waitedUntil < MOVE_HOLD)
})

const kept = (o = {}) => JSON.stringify({ from: '/media', nav: true, href: 'http://x.test/topics-v2.html', top: 331, time: 900, ...o })
test('the link that led here slides the page in, from the old picture\'s place', () => {
  const r = run({ pathname: '/trends', session: { 'm-move': kept() } }).reveal()
  assert.equal(r.vt, 'down')
  assert.equal(r.oldY, '275px')
  assert.deepEqual(r.calls, ['finished.finally'])
  assert.equal(r.session['m-move'], undefined, 'the kept move is used once')
})
test('on a phone a move to the next tab slides sideways', () => {
  assert.equal(run({ pathname: '/trends', wide: false, session: { 'm-move': kept() } }).reveal().vt, 'right')
})
test('a move that did not come from the link of this page does not slide', () => {
  const r = run({ pathname: '/trends', session: { 'm-move': kept({ href: 'http://x.test/fingerprints-v2.html' }) } }).reveal()
  assert.equal(r.vt, undefined)
  assert.deepEqual(r.calls, ['ready.catch', 'skip'])
})
test('back and forward slide too, whatever link was kept', () => {
  assert.equal(run({ pathname: '/trends', activation: 'traverse', session: { 'm-move': kept({ nav: false, href: undefined }) } }).reveal().vt, 'down')
  assert.equal(run({ pathname: '/trends', navType: 'back_forward', session: { 'm-move': kept({ nav: false, href: undefined }) } }).reveal().vt, 'down')
})
test('a page with no kept move, an old one, or the same page is shown without a slide', () => {
  assert.deepEqual(run().reveal().calls, ['ready.catch', 'skip'])
  assert.deepEqual(run({ session: { 'm-move': kept({ time: 100 }) }, date: 10000 }).reveal().calls, ['ready.catch', 'skip'])
  assert.deepEqual(run({ session: { 'm-move': kept({ from: '/trends' }) } }).reveal().calls, ['ready.catch', 'skip'])
})
test('a reveal with no view transition does nothing', () => {
  const env = run({ session: { 'm-move': kept() } })
  assert.doesNotThrow(() => env.reveal())
})
