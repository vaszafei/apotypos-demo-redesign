// The day checks of the fixtures that make-db-fixtures.py extends. Usage: npm run check:fixtures (in web/) or node docs/redesign/prototypes/scripts/fixtures-check.mjs
// For media, stories, storyDetail and home: the dates are consecutive days, the window is the first and last date, and every array
// that is one value per day has as many values as there are dates. A cell with no data is null and keeps the shape of a cell with data.
// Exit code 1 if a check fails.
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const context = { window: {} }
vm.createContext(context)
const KEYS = ['media', 'stories', 'storyDetail', 'home']
for (const key of KEYS) vm.runInContext(fs.readFileSync(path.join(dir, 'data', `${key}.js`), 'utf8'), context)
const F = context.window.FIXTURES

let failures = 0
const fail = (msg) => { failures++; console.log(`  FAIL ${msg}`) }
const next = (iso) => new Date(Date.parse(`${iso}T00:00:00Z`) + 86400000).toISOString().slice(0, 10)

for (const key of KEYS) {
  const d = F[key]
  console.log(`${key}: ${d.dates.length} days, ${d.dates[0]} to ${d.dates[d.dates.length - 1]}`)
  for (let i = 1; i < d.dates.length; i++) if (d.dates[i] !== next(d.dates[i - 1])) { fail(`${key}.dates: ${d.dates[i - 1]} is followed by ${d.dates[i]}`); break }
  if (d.window[0] !== d.dates[0] || d.window[1] !== d.dates[d.dates.length - 1]) fail(`${key}.window ${d.window} is not the first and last of the dates`)
  if (d.dates.join() !== F.media.dates.join()) fail(`${key}.dates differ from media.dates`)
}

const m = F.media
const n = m.dates.length
m.outletDaily.forEach((row, k) => {
  if (row.length !== n) fail(`media.outletDaily[${k}] has ${row.length} values for ${n} days`)
  row.forEach((cell, i) => { if (!Array.isArray(cell) || cell.length !== 4) fail(`media.outletDaily[${k}][${i}] is not a 4-number cell`) })
})
m.issueDaily.forEach((row, k) => { if (row.length !== n) fail(`media.issueDaily[${k}] has ${row.length} values for ${n} days`) })
m.stories.forEach((s, k) => { if (s.daily.length !== n) fail(`media.stories[${k}].daily has ${s.daily.length} values for ${n} days`) })
m.storyDays.forEach((pairs, k) => {
  for (let i = 0; i < pairs.length; i += 2) if (pairs[i] >= n) { fail(`media.storyDays[${k}] has day index ${pairs[i]} for ${n} days`); break }
})
F.home.outlets.forEach((o, k) => { if (o.daily.length !== n) fail(`home.outlets[${k}].daily has ${o.daily.length} values for ${n} days`) })
F.home.issueDaily.forEach((row, k) => { if (row.length !== n) fail(`home.issueDaily[${k}] has ${row.length} values for ${n} days`) })
// The days from the database: a value the database cannot give is null, never 0. Outlet volume is a number only inside dbCovered.
if (m.volumeFrom) {
  const from = m.dates.indexOf(m.volumeFrom)
  const covered = m.dbCovered ? [m.dates.indexOf(m.dbCovered[0]), m.dates.indexOf(m.dbCovered[1])] : [n, -1]
  const isNull = (v) => v === null
  m.outletDaily.forEach((row, k) => {
    for (let i = from; i < n; i++) {
      const [vol, ...rest] = row[i]
      if (!rest.every(isNull)) fail(`media.outletDaily[${k}][${i}] has a value for news, clickbait or stance, which the database cannot give`)
      if (!(i >= covered[0] && i <= covered[1]) && vol !== null) fail(`media.outletDaily[${k}][${i}] has volume outside dbCovered`)
      if (i >= covered[0] && i <= covered[1] && vol !== null && typeof vol !== 'number') fail(`media.outletDaily[${k}][${i}] volume is not a number`)
    }
  })
  m.issueDaily.forEach((row, k) => { if (!row.slice(from).every(isNull)) fail(`media.issueDaily[${k}] has a number on a day of the database`) })
  m.stories.forEach((s, k) => { if (!s.daily.slice(from).every(isNull)) fail(`media.stories[${k}].daily has a number on a day of the database`) })
  F.home.issueDaily.forEach((row, k) => { if (!row.slice(from).every(isNull)) fail(`home.issueDaily[${k}] has a number on a day of the database`) })
  for (const key of ['stories', 'storyDetail', 'home']) if (F[key].volumeFrom !== m.volumeFrom) fail(`${key}.volumeFrom differs from media.volumeFrom`)
  for (const key of ['stories', 'storyDetail']) {
    if (F[key].dbStoryFrom === undefined) fail(`${key}.dbStoryFrom is missing`)
    if (key === 'storyDetail') {
      for (const s of F.storyDetail.stories) {
        if (s.id < F.storyDetail.dbStoryFrom) continue
        if (!(s.f === null && s.s === null && s.c === null && s.k === null)) fail(`storyDetail story ${s.id} has labels, which the database cannot give`)
        for (let i = 1; i < s.t.length; i += 3) if (s.t[i] >= n) { fail(`storyDetail story ${s.id} has day index ${s.t[i]} for ${n} days`); break }
      }
    }
  }
  const ids = new Set(F.stories.stories.map((s) => s.id))
  for (const s of F.storyDetail.stories) if (!ids.has(s.id)) fail(`storyDetail story ${s.id} is not in stories`)
  for (const s of F.stories.stories) for (let i = 0; i < s.days.length; i += 2) if (s.days[i] >= n) { fail(`stories story ${s.id} has day index ${s.days[i]} for ${n} days`); break }
  if (m.storyDays.length !== F.stories.stories.length) fail(`media.storyDays has ${m.storyDays.length} rows for ${F.stories.stories.length} stories`)
}
if (m.volumeFrom && !m.dates.includes(m.volumeFrom)) fail(`media.volumeFrom ${m.volumeFrom} is not one of the dates`)
if (m.dbCovered && (!m.dates.includes(m.dbCovered[0]) || !m.dates.includes(m.dbCovered[1]))) fail(`media.dbCovered ${m.dbCovered} is outside the dates`)

if (!failures) console.log('ok: the day structure of the fixtures holds')
process.exit(failures ? 1 : 0)
