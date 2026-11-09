import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'
import { buildMessages, convertMessages, messageFileOrder } from './build-messages.mjs'

const prototypes = fileURLToPath(new URL('../../docs/redesign/prototypes/', import.meta.url))
const base = "window.MESSAGES = { el: { 'a': 'α', 'b': 'β {n}' }, en: { 'a': 'a' } }"
const add = (el, en = '{}') => `Object.assign(window.MESSAGES.el, ${el}); Object.assign(window.MESSAGES.en, ${en})`

test('a later file overrides an earlier one, key by key', () => {
  const out = convertMessages([['messages.js', base], ['messages-x.js', add("{ 'a': 'α2', 'c': 'γ' }", "{ 'a': 'a2' }")]])
  assert.deepEqual(out.el, { a: 'α2', b: 'β {n}', c: 'γ' })
  assert.deepEqual(out.en, { a: 'a2' })
})

test('the order is the order the pages load the files in; opposite orders are an error', () => {
  assert.deepEqual(messageFileOrder([['m.js', 'v2.js', 'mme.js'], ['m.js', 'v2.js', 'home.js'], ['m.js']]), ['m.js', 'v2.js', 'mme.js', 'home.js'])
  assert.throws(() => messageFileOrder([['m.js', 'a.js', 'b.js'], ['m.js', 'b.js', 'a.js']]), /different orders/)
})

for (const [name, text] of [['a pipe', 'one | two'], ['an @', 'mail@x.gr'], ['a $', '$5'], ['an unbalanced brace', 'open {n'], ['a stray closing brace', 'x } y'], ['a brace that is not a name', '{n + 1}']]) {
  test(`a message with ${name} fails and names the key`, () => {
    assert.throws(() => convertMessages([['messages.js', `window.MESSAGES = { el: { 'page.bad.key': ${JSON.stringify(text)} }, en: {} }`]]), /el\.page\.bad\.key/)
  })
}

test('the listed key with a $ gets the literal form and compiles', () => {
  const out = convertMessages([['messages.js', "window.MESSAGES = { el: { 'cov.short.fee': '$160k' }, en: { 'cov.short.fee': '$160k' } }"]])
  assert.equal(out.el['cov.short.fee'], "{'$'}160k")
})

test('every message of the prototype converts, and {name} is kept as it is', () => {
  const to = `${mkdtempSync(join(tmpdir(), 'msg-'))}/`
  const { counts } = buildMessages(prototypes, to)
  const el = JSON.parse(readFileSync(`${to}el.json`, 'utf8'))
  const en = JSON.parse(readFileSync(`${to}en.json`, 'utf8'))
  assert.equal(Object.keys(el).length, counts.el)
  assert.equal(el['shell.menu'], 'Άνοιγμα μενού')
  assert.equal(el['media2.topic.tip'], '{topic}: {n} άρθρα ({share})')
  assert.equal(en['media2.topic.tip'], '{topic}: {n} articles ({share})')
})

test('text of three keys equals the prototype t() for the same values', async () => {
  const to = `${mkdtempSync(join(tmpdir(), 'msg-'))}/`
  buildMessages(prototypes, to)
  const { createI18n } = await import('vue-i18n')
  const el = JSON.parse(readFileSync(`${to}el.json`, 'utf8'))
  const en = JSON.parse(readFileSync(`${to}en.json`, 'utf8'))
  // The prototype's t(): the message of the language, else Greek, with /\{(\w+)\}/ replaced.
  const proto = (locale, key, values) => ({ el, en }[locale][key] ?? el[key]).replace(/\{(\w+)\}/g, (_, n) => values[n] ?? '')
  const i18n = createI18n({ legacy: false, locale: 'el', fallbackLocale: 'el', messages: { el, en }, warnHtmlMessage: false, missingWarn: false, fallbackWarn: false })
  const cases = [['topics2.all.finding', { share: '41,2%' }], ['media2.topic.tip', { topic: 'Οικονομία', n: '1.234', share: '5,0%' }], ['dr.days', { n: 14 }], ['shifts.table.sub', { from: '1 Ιαν 2025', to: '9 Ιουν 2025' }]]
  for (const locale of ['el', 'en']) for (const [key, values] of cases) assert.equal(i18n.global.t(key, values, { locale }), proto(locale, key, values), `${locale} ${key}`)
})

test('a key English does not have shows the Greek text', async () => {
  const to = `${mkdtempSync(join(tmpdir(), 'msg-'))}/`
  buildMessages(prototypes, to)
  const { createI18n } = await import('vue-i18n')
  const el = JSON.parse(readFileSync(`${to}el.json`, 'utf8'))
  const en = JSON.parse(readFileSync(`${to}en.json`, 'utf8'))
  const missing = Object.keys(el).find((k) => !(k in en))
  assert.ok(missing, 'the sources have a Greek key with no English text')
  const i18n = createI18n({ legacy: false, locale: 'en', fallbackLocale: 'el', messages: { el, en }, missingWarn: false, fallbackWarn: false })
  assert.equal(i18n.global.t(missing, { n: 1, from: 'x', to: 'y' }), el[missing].replace(/\{(\w+)\}/g, (_, n) => ({ n: 1, from: 'x', to: 'y' })[n] ?? ''))
})
