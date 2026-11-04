// The index of the global search (#61): the outlets, groups, topics, stories, cases, spread patterns, people, statements,
// parties, bylines and UN speeches of the fixtures, in one small file that the search loads on its first open.
// The pages and tabs are not in it: shell.js lists them from the sidebar tree, in the language of the page.
// Usage: node docs/redesign/prototypes/scripts/make-search.mjs
// Each entry: n name, en English name (when it differs), d detail, h link, r route of the page that lists it (its place),
// s set of outlets ("il" for the Israeli set), a other names to match.
// The stories of story-v2.html are most of the file, so each is a short row: [id, name, topic, outlets, English name].
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const context = { window: {} }
vm.createContext(context)
const FILES = ['groups', 'stories', 'mme', 'cases', 'campaigns', 'statements', 'personFile', 'fingerprints', 'stanceRatings', 'elections', 'speeches']
for (const key of FILES) vm.runInContext(fs.readFileSync(path.join(dir, 'data', `${key}.js`), 'utf8'), context)
const F = context.window.FIXTURES

const entry = (x) => Object.fromEntries(Object.entries(x).filter(([, v]) => v != null && v !== '' && !(Array.isArray(v) && !v.length)))
const kinds = { outlets: [], groups: [], topics: [], stories: [], cases: [], campaigns: [], people: [], statements: [], parties: [], bylines: [], speeches: [] }

// Μέσα: the groups and their outlets, the outlets with no group, then the outlets that only one page knows.
const outletNames = new Set()
const addOutlet = (x) => { if (outletNames.has(x.n)) return; outletNames.add(x.n); kinds.outlets.push(entry(x)) }
for (const g of F.groups.groups) {
  kinds.groups.push(entry({ n: g.name, d: g.owner, h: `group-v2.html?g=${encodeURIComponent(g.slug)}`, r: '/groups', a: g.outlets.map((o) => o.name) }))
  g.outlets.forEach((o) => addOutlet({ n: o.name, d: g.name, h: `outlet-v2.html?slug=${o.slug}`, r: '/media' }))
}
F.groups.ungrouped.forEach((o) => addOutlet({ n: o.name, h: `outlet-v2.html?slug=${o.slug}`, r: '/media' }))
F.mme.sets.gr.outlets.forEach((o) => addOutlet({ n: o.name, h: `outlet-v2.html?slug=${o.slug}`, r: '/media' }))
F.mme.sets.il.outlets.forEach((o) => addOutlet({ n: o.name, h: 'media-v2.html?ds=il', r: '/media', s: 'il' }))
F.elections.outlets.forEach((o) => addOutlet({ n: o.name, d: o.owner, h: 'elections-v2.html?tab=outlets', r: '/elections/outlets' }))

// Θέματα: the topics of the stories. topic-v2.html opens a topic by its index.
F.stories.issues.forEach((x, i) => kinds.topics.push(entry({ n: x.el, en: x.en !== x.el ? x.en : null, h: `topic-v2.html?i=${i}`, r: '/trends/topic' })))

// Ιστορίες: the stories with the most outlets first (the suggestions of the empty box are the first ones), then the stories of the Israeli set.
const storyRows = F.stories.stories.filter((s) => !s.generic).sort((a, b) => b.outlets - a.outlets)
  .map((s) => [s.id, s.el, s.issue, s.outlets, ...(s.en && s.en !== s.el ? [s.en] : [])])
F.mme.sets.il.stories.filter((s) => !s.generic)
  .forEach((s) => kinds.stories.push(entry({ n: s.el, en: s.en !== s.el ? s.en : null, h: 'media-v2.html?ds=il', r: '/media', s: 'il' })))

// Υποθέσεις and Μοτίβα διάδοσης.
kinds.cases.push(entry({ n: F.cases.q, a: F.cases.terms.filter((x) => x !== F.cases.q), h: 'cases-v2.html', r: '/cases' }))
F.campaigns.political.forEach((c) => kinds.campaigns.push(entry({ n: c.person, d: c.week, h: 'campaigns-v2.html', r: '/campaigns' })))

// Πρόσωπα: one entry for each person, on the first page that has a file of them. The role comes from the people of ΜΜΕ & πρόσωπα.
const people = new Map()
const addPerson = (x) => { const p = people.get(x.n); if (p) { p.d = p.d || x.d; p.a = [...new Set([...(p.a || []), ...(x.a || [])])] } else people.set(x.n, { ...x }) }
const file = F.personFile.summary
addPerson({ n: file.person, en: file.person_en, h: 'persons-v2.html', r: '/contradictions' })
F.fingerprints.entities.forEach((n) => addPerson({ n, h: 'fingerprints-v2.html', r: '/fingerprints' }))
F.stanceRatings.persons.forEach((p) => addPerson({ n: p.name, h: 'fingerprints-v2.html?tab=spread', r: '/fingerprints/spread' }))
F.mme.sets.gr.people.forEach((p) => addPerson({ n: p.name, d: [p.role, p.party].filter(Boolean).join(', '), h: 'fingerprints-v2.html', r: '/fingerprints' }))
F.mme.sets.il.people.forEach((p) => addPerson({ n: p.name, d: [p.role, p.party].filter(Boolean).join(', '), h: 'media-v2.html?ds=il', r: '/media', s: 'il' }))
people.forEach((p) => kinds.people.push(entry(p)))

// Δηλώσεις: the speakers of the tracked statements, with their other names.
F.statements.rows.forEach((x) => kinds.statements.push(entry({ n: x.speaker, a: x.names.filter((n) => n !== x.speaker), h: 'statements-v2.html', r: '/track' })))

// Πολιτική: the parties of the elections page. The live page has no bylines any more.
F.elections.parties.forEach((p) => kinds.parties.push(entry({ n: p.name, a: p.key !== p.name ? [p.key] : null, h: 'elections-v2.html', r: '/elections' })))

// Αναλύσεις: the speakers of the UN General Assembly, found also by their country.
F.speeches.rows.forEach((x) => kinds.speeches.push(entry({ n: x.speaker, d: x.country, a: [x.country], h: `speech-v2.html?id=${x.vid}`, r: '/speeches' })))

const out = path.join(dir, 'data', 'search.js')
fs.writeFileSync(out, `window.FIXTURES=window.FIXTURES||{};window.FIXTURES["search"]=${JSON.stringify({ storyRows, kinds })};\n`)
console.log(`${path.relative(process.cwd(), out)}: stories ${storyRows.length}, ${Object.entries(kinds).map(([k, v]) => `${k} ${v.length}`).join(', ')}, ${Math.round(fs.statSync(out).size / 1024)} KB`)
