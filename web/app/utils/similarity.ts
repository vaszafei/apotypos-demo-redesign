import type { StoryDetailData } from '~/types/story-detail'

// Μέσα › Ομοιότητα: how much the outlets write the same stories. The data is one row for each story with its articles for each outlet and day (data/storyDetail.js).
// Some outlets are in the data for a part of the period only (the crawler has gaps), so a pair is compared on the days where both were collected, never on the whole period.

// A day of an outlet counts as collected when the outlet has this many articles on it.
export const SIM_ACTIVE_ARTICLES = 20
// An outlet needs this many collected days and stories to be in the web: under it a pair of it has too little to compare.
export const SIM_MIN_DAYS = 28
export const SIM_MIN_STORIES = 300
// A story that this many outlets wrote is a major story.
export const SIM_MAJOR = 20
// A pair is compared only if both were collected on this many common days.
export const SIM_MIN_COMMON = 21

export interface SimOutlet { index: number, name: string, group: string | null, slug: string, articles: number, stories: number, days: number }
export interface SimPair { a: number, b: number, shared: number, union: number, score: number }
export interface Missed { story: number, outlets: number }
export interface SimResult {
  outlets: SimOutlet[]
  /** score[i][j] for the positions of `outlets` (null when the pair has too few common days) */
  score: (number | null)[][]
  shared: number[][]
  /** The major stories that each outlet did not write, among the major stories on days when it was collected. */
  missed: { considered: number, stories: Missed[] }[]
  majorTotal: number
}

const words = 3 // 3 x 32 bits = 96 days
const bit = (mask: Uint32Array, day: number) => { mask[day >> 5]! |= 1 << (day & 31) }

export const similarityOf = (detail: StoryDetailData): SimResult => {
  const days = detail.dates.length
  const w = Math.ceil(days / 32)
  if (w > words) throw new Error('similarityOf: more than 96 days')
  // Collected days of each outlet.
  const perDay = detail.outlets.map(() => new Uint32Array(days))
  for (const s of detail.stories) for (let i = 0; i < s.t.length; i += 3) perDay[s.t[i]!]![s.t[i + 1]!]! += s.t[i + 2]!
  const active = detail.outlets.map(() => new Uint32Array(words))
  const activeDays = detail.outlets.map(() => 0)
  perDay.forEach((d, o) => d.forEach((v, day) => { if (v >= SIM_ACTIVE_ARTICLES) { bit(active[o]!, day); activeDays[o]!++ } }))
  // The days of each outlet in each story.
  const stories = detail.stories.map((s) => {
    const m = new Map<number, Uint32Array>()
    for (let i = 0; i < s.t.length; i += 3) {
      const o = s.t[i]!
      let mask = m.get(o)
      if (!mask) { mask = new Uint32Array(words); m.set(o, mask) }
      bit(mask, s.t[i + 1]!)
    }
    return { id: s.id, m }
  })
  const storyCount = detail.outlets.map(() => 0)
  for (const s of stories) for (const o of s.m.keys()) storyCount[o]!++
  const keep = detail.outlets.map((o, index) => ({ o, index })).filter(({ index }) => activeDays[index]! >= SIM_MIN_DAYS && storyCount[index]! >= SIM_MIN_STORIES)
  const outlets: SimOutlet[] = keep.map(({ o, index }) => ({ index, name: o.name, group: o.group, slug: o.slug, articles: o.total, stories: storyCount[index]!, days: activeDays[index]! }))

  // An outlet wrote a story in a set of days when it has an article of it on one of them.
  const wrote = (m: Map<number, Uint32Array>, o: number, mask: Uint32Array) => {
    const d = m.get(o)
    if (!d) return false
    for (let k = 0; k < w; k++) if ((d[k]! & mask[k]!) !== 0) return true
    return false
  }
  const k = outlets.length
  const score: (number | null)[][] = Array.from({ length: k }, () => Array<number | null>(k).fill(null))
  const shared = Array.from({ length: k }, () => Array<number>(k).fill(0))
  for (let i = 0; i < k; i++) {
    for (let j = i + 1; j < k; j++) {
      const [oa, ob] = [outlets[i]!.index, outlets[j]!.index]
      const common = new Uint32Array(words)
      let nCommon = 0
      for (let x = 0; x < w; x++) { common[x] = active[oa]![x]! & active[ob]![x]!; let c = common[x]!; while (c) { nCommon++; c &= c - 1 } }
      if (nCommon < SIM_MIN_COMMON) continue
      let both = 0
      let any = 0
      for (const s of stories) {
        const a = wrote(s.m, oa, common)
        const b = wrote(s.m, ob, common)
        if (a && b) both++
        if (a || b) any++
      }
      if (any === 0) continue
      score[i]![j] = score[j]![i] = both / any
      shared[i]![j] = shared[j]![i] = both
    }
  }

  // Major stories: the ones that SIM_MAJOR outlets or more wrote. An outlet missed one when it was collected on a day of the story and did not write it.
  const major = stories.filter(s => s.m.size >= SIM_MAJOR)
  const missed = outlets.map((out) => {
    let considered = 0
    const list: Missed[] = []
    for (const s of major) {
      const days = new Uint32Array(words)
      for (const m of s.m.values()) for (let x = 0; x < w; x++) days[x]! |= m[x]!
      let seen = false
      for (let x = 0; x < w && !seen; x++) if ((days[x]! & active[out.index]![x]!) !== 0) seen = true
      if (!seen) continue
      considered++
      if (!s.m.has(out.index)) list.push({ story: s.id, outlets: s.m.size })
    }
    list.sort((a, b) => b.outlets - a.outlets)
    return { considered, stories: list }
  })
  return { outlets, score, shared, missed, majorTotal: major.length }
}

// The closest and the farthest outlets of one outlet, by score.
export const neighbours = (r: SimResult, i: number, count = 3) => {
  const row = r.score[i]!.map((v, j) => ({ j, v })).filter((e): e is { j: number, v: number } => e.v !== null && e.j !== i).sort((a, b) => b.v - a.v)
  return { near: row.slice(0, count), far: row.slice(-count).reverse() }
}

// The place of each outlet in the plane: the distance of two outlets is 1 minus their score, spread over the plane by stress majorization (SMACOF), turned so that the widest spread is horizontal.
// A pair with no score is left free. The result is in [-1, 1] on x and y, and it is the same every time (no random start).
export const embed = (score: (number | null)[][], size?: number[]) => {
  const k = score.length
  const flat = score.flatMap((row, i) => row.filter((v, j) => v !== null && j !== i) as number[])
  const lo = Math.min(...flat)
  const hi = Math.max(...flat)
  // The distances are spread over 0.15 to 1, so the closest pair is near and the farthest is far (the scores themselves differ by only a few times).
  const dist = (i: number, j: number) => { const v = score[i]![j]; return v === null || v === undefined ? null : 0.15 + 0.85 * (hi > lo ? (hi - v) / (hi - lo) : 0.5) }
  // Start: the outlets on a circle, the biggest first at the middle-ish by their order.
  const order = [...Array(k).keys()].sort((a, b) => (size ? size[b]! - size[a]! : 0))
  let pos = order.map((_, rank) => rank).map(() => [0, 0])
  order.forEach((o, rank) => { const a = rank * 2.399963; const r = 0.15 + 0.85 * Math.sqrt(rank / k); pos[o] = [Math.cos(a) * r, Math.sin(a) * r] })
  for (let it = 0; it < 400; it++) {
    const next = pos.map(p => [...p])
    for (let i = 0; i < k; i++) {
      let [sx, sy, c] = [0, 0, 0]
      for (let j = 0; j < k; j++) {
        if (i === j) continue
        const d = dist(i, j)
        if (d === null) continue
        const dx = pos[i]![0]! - pos[j]![0]!
        const dy = pos[i]![1]! - pos[j]![1]!
        const len = Math.hypot(dx, dy) || 1e-6
        sx += pos[j]![0]! + (d * dx) / len
        sy += pos[j]![1]! + (d * dy) / len
        c++
      }
      if (c) next[i] = [sx / c, sy / c]
    }
    pos = next
  }
  // Centre and turn by the principal axis.
  const mx = pos.reduce((a, p) => a + p[0]!, 0) / k
  const my = pos.reduce((a, p) => a + p[1]!, 0) / k
  const c = pos.map(p => [p[0]! - mx, p[1]! - my])
  const [sxx, syy, sxy] = c.reduce((a, p) => [a[0]! + p[0]! * p[0]!, a[1]! + p[1]! * p[1]!, a[2]! + p[0]! * p[1]!], [0, 0, 0])
  const th = 0.5 * Math.atan2(2 * sxy!, sxx! - syy!)
  const [cs, sn] = [Math.cos(-th), Math.sin(-th)]
  return c.map(p => [p[0]! * cs - p[1]! * sn, p[0]! * sn + p[1]! * cs] as [number, number])
}
