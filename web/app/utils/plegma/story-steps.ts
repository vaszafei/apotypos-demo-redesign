// The steps of the chart of a story with article times (#219, #220): the articles counted per step of time from the first article, the step fitted to the story.
// A step is the smallest of STEP_MINUTES that keeps the story to STEPS_MAX steps or fewer; steps are Athens wall-clock (a day is an Athens day).
export const STEP_MINUTES = [10, 30, 60, 1440] as const
export const STEPS_MAX = 96

export interface StepArticle { time?: number, group: string | null, outlet: string, slot: number, order: number, outletOrder: number }
// One step: its start on the Athens clock (`date` YYYY-MM-DD, `clock` HH:MM), its articles and the time range of them (minutes since 1970 UTC) for lighting their dots.
export interface StoryStep { k: number, date: string, clock: string, n: number, from: number, to: number, articles: StepArticle[] }
// A part of a column: a group, or an outlet in the colour of its group.
export interface StepPart { key: string, name: string, group: string | null, slot: number, n: number }

const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Athens', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
// The Athens wall clock of a minute since 1970 UTC, as minutes since 1970 on a clock with no time zone.
export const athensWall = (minute: number) => {
  const q = Object.fromEntries(parts.formatToParts(new Date(minute * 60000)).map(x => [x.type, x.value]))
  return Date.UTC(+q.year!, +q.month! - 1, +q.day!, +q.hour!, +q.minute!) / 60000
}
const two = (n: number) => String(n).padStart(2, '0')
const wallText = (wall: number) => {
  const d = new Date(wall * 60000)
  return { date: `${d.getUTCFullYear()}-${two(d.getUTCMonth() + 1)}-${two(d.getUTCDate())}`, clock: `${two(d.getUTCHours())}:${two(d.getUTCMinutes())}` }
}

// The articles must be in order of time, each with its time.
export const storySteps = (articles: StepArticle[]) => {
  const timed = articles.filter(a => a.time !== undefined)
  if (!timed.length) return { step: STEP_MINUTES[0] as number, steps: [] as StoryStep[] }
  const walls = timed.map(a => athensWall(a.time!))
  const w0 = Math.min(...walls)
  const w1 = Math.max(...walls)
  const step: number = STEP_MINUTES.find(s => Math.floor(w1 / s) - Math.floor(w0 / s) + 1 <= STEPS_MAX) ?? STEP_MINUTES[STEP_MINUTES.length - 1]!
  const b0 = Math.floor(w0 / step)
  const steps: StoryStep[] = Array.from({ length: Math.floor(w1 / step) - b0 + 1 }, (_, k) => ({ k, ...wallText((b0 + k) * step), n: 0, from: Infinity, to: -Infinity, articles: [] }))
  timed.forEach((a, i) => {
    const s = steps[Math.floor(walls[i]! / step) - b0]!
    s.articles.push(a)
    s.n++
    s.from = Math.min(s.from, a.time!)
    s.to = Math.max(s.to, a.time!)
  })
  return { step, steps }
}

// The parts of a step, bottom first: by group (in the order of the story's groups, largest first) or by outlet (the outlets of a group together, in the group's order).
export const stepParts = (s: StoryStep, by: 'groups' | 'outlets'): StepPart[] => {
  const map = new Map<string, StepPart & { o: number, p: number }>()
  for (const a of s.articles) {
    const key = by === 'groups' ? String(a.group) : `${a.group}|${a.outlet}`
    const row = map.get(key)
    if (row) row.n++
    else map.set(key, { key, name: by === 'groups' ? (a.group ?? '') : a.outlet, group: a.group, slot: a.slot, n: 1, o: a.order, p: a.outletOrder })
  }
  return [...map.values()].sort((x, y) => x.o - y.o || x.p - y.p).map(({ o: _o, p: _p, ...r }) => r)
}
