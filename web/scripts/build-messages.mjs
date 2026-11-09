// Convert the message files of the prototype (docs/redesign/prototypes/assets/messages*.js) to i18n/locales/el.json and en.json.
// Each file adds to window.MESSAGES, so the merge follows the order the pages load them in; a later file overrides an earlier one.
// Run by `npm run sync`, or: node scripts/build-messages.mjs [prototypes folder] [out folder]
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'
import { baseCompile } from '@intlify/message-compiler'

// A literal that vue-i18n would read as syntax is an error, except for the keys listed here: they get the literal form {'x'}.
// cov.short.fee is the amount "$160k" of Μία είδηση πολλές εκδοχές.
export const escapedKeys = new Set(['cov.short.fee'])

// The files in the order of their <script> lines. Two pages that load two files in opposite orders are an error.
export const messageFileOrder = (pages) => {
  const after = new Map()
  for (const files of pages) {
    for (const file of files) after.set(file, after.get(file) ?? new Set())
    files.slice(1).forEach((file, i) => after.get(files[i]).add(file))
  }
  const order = []
  const state = new Map()
  const visit = (file) => {
    if (state.get(file) === 'done') return
    if (state.get(file) === 'open') throw new Error(`Pages load the message files in different orders (cycle at ${file})`)
    state.set(file, 'open')
    for (const next of [...after.get(file)].sort()) visit(next)
    state.set(file, 'done')
    order.unshift(file)
  }
  for (const file of [...after.keys()].sort()) visit(file)
  return order
}

export const loadMessages = (sources) => {
  const window = {}
  window.window = window
  const context = { window }
  for (const [name, source] of sources) runInNewContext(source, context, { filename: name, timeout: 20000 })
  return window.MESSAGES ?? {}
}

// {name} is the only syntax of the prototype (t() replaces /\{(\w+)\}/). Anything else that vue-i18n reads as syntax would change the text.
const check = (lang, key, text) => {
  if (typeof text !== 'string') throw new Error(`${lang}.${key} is not a string`)
  const rest = text.replace(/\{\w+\}/g, '')
  if (/[{}]/.test(rest)) throw new Error(`${lang}.${key} has a brace that is not {name}: ${text}`)
  const bad = rest.match(/[|@$]/)
  if (bad) throw new Error(`${lang}.${key} has "${bad[0]}", which vue-i18n reads as syntax: ${text}`)
}
const escape = (text) => text.replace(/[|@$]/g, (c) => `{'${c}'}`)

export const compileCheck = (lang, key, text) => {
  baseCompile(text, { onError: (error) => { throw new Error(`${lang}.${key} does not compile: ${error.message}`) } })
}

export const convertMessages = (sources) => {
  const messages = loadMessages(sources)
  const out = {}
  for (const lang of ['el', 'en']) {
    out[lang] = {}
    for (const [key, text] of Object.entries(messages[lang] ?? {})) {
      if (escapedKeys.has(key)) { out[lang][key] = escape(text); }
      else { check(lang, key, text); out[lang][key] = text }
      compileCheck(lang, key, out[lang][key])
    }
  }
  return out
}

export const buildMessages = (prototypes, to) => {
  const pages = readdirSync(prototypes).filter((f) => f.endsWith('.html')).map((f) =>
    [...readFileSync(`${prototypes}${f}`, 'utf8').matchAll(/assets\/(messages[\w-]*\.js)/g)].map((m) => m[1]))
  const order = messageFileOrder(pages)
  const out = convertMessages(order.map((name) => [name, readFileSync(`${prototypes}assets/${name}`, 'utf8')]))
  mkdirSync(to, { recursive: true })
  for (const lang of ['el', 'en']) writeFileSync(`${to}${lang}.json`, JSON.stringify(out[lang]))
  return { order, counts: { el: Object.keys(out.el).length, en: Object.keys(out.en).length } }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const from = process.argv[2] ?? fileURLToPath(new URL('../../docs/redesign/prototypes/', import.meta.url))
  const to = process.argv[3] ?? fileURLToPath(new URL('../i18n/locales/', import.meta.url))
  const { order, counts } = buildMessages(from, to)
  console.log(`${counts.el} el and ${counts.en} en messages from ${order.join(', ')} written to ${to}`)
}
