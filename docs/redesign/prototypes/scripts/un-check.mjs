// The numbers of Ομιλίες ΟΗΕ: the totals of the topics and the regions add up. Usage: node docs/redesign/prototypes/scripts/un-check.mjs
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const context = { window: { App: { t: (k) => k, fmt: {}, h: () => ({}) }, Dash: { fit: () => {}, niceStep: () => 1 }, UI: { CHART_FRAME: {}, smoothPath: () => '' } } }
context.window.window = context.window
vm.createContext(context)
vm.runInContext(fs.readFileSync(path.join(dir, 'data', 'speeches.js'), 'utf8'), context)
vm.runInContext(fs.readFileSync(path.join(dir, 'assets', 'politics.js'), 'utf8'), Object.assign(context, context.window))
const { rows } = context.window.FIXTURES.speeches
const { topicMinutes } = context.window.Politics
let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.log(`  FAIL ${msg}`) } }
const near = (a, b) => Math.abs(a - b) < 1e-6

const regions = ['', ...new Set(rows.map((r) => r.region))]
for (const region of regions) {
  const list = rows.filter((r) => !region || r.region === region)
  const m = topicMinutes(list)
  const sum = m.topics.reduce((a, x) => a + x.minutes, 0)
  check(near(sum, m.tagged), `${region || 'all'}: the topics add up to ${sum}, tagged is ${m.tagged}`)
  check(m.tagged <= m.total + 1e-6 + list.length * 0.1, `${region || 'all'}: tagged ${m.tagged} is more than total ${m.total}`)
  check(near(m.total, list.reduce((a, r) => a + r.seconds, 0) / 60), `${region || 'all'}: total`)
  console.log(`${(region || 'all').padEnd(26)} ${String(list.length).padStart(3)} speeches  total ${m.total.toFixed(1)} min  tagged ${m.tagged.toFixed(1)} min`)
}
const all = topicMinutes(rows)
const ip = all.topics.find((x) => x.topic === 'Israel–Palestine')
const rank = all.topics.findIndex((x) => x.topic === 'Israel–Palestine') + 1
const byRegion = [...new Set(rows.map((r) => r.region))].reduce((a, g) => a + (topicMinutes(rows.filter((r) => r.region === g)).topics.find((x) => x.topic === 'Israel–Palestine')?.minutes || 0), 0)
check(near(byRegion, ip.minutes), `Israel–Palestine by region ${byRegion} is not ${ip.minutes}`)
check(ip.speeches === rows.filter((r) => r.shares.some(([k]) => k === 'Israel–Palestine')).length, 'Israel–Palestine speeches')
console.log(`Israel–Palestine: ${ip.minutes.toFixed(1)} min, ${ip.speeches} speeches, ${ip.leaders} leaders with a minute, rank ${rank} of ${all.topics.length} topics`)
check(topicMinutes([]).total === 0 && topicMinutes([]).topics.length === 0, 'no rows')
console.log(failures ? `${failures} failed` : 'ok')
process.exit(failures ? 1 : 0)
