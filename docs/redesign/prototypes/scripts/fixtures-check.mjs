// The day checks of the fixtures that make-db-fixtures.py extends. Usage: pnpm check:fixtures (in web/) or node docs/redesign/prototypes/scripts/fixtures-check.mjs
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
if (m.volumeFrom && !m.dates.includes(m.volumeFrom)) fail(`media.volumeFrom ${m.volumeFrom} is not one of the dates`)
if (m.dbCovered && (!m.dates.includes(m.dbCovered[0]) || !m.dates.includes(m.dbCovered[1]))) fail(`media.dbCovered ${m.dbCovered} is outside the dates`)

if (!failures) console.log('ok: the day structure of the fixtures holds')
process.exit(failures ? 1 : 0)
