import { mulberry } from './plegma-world.ts'

// Κλαδιά (#217): the web of a story uncurled by time. The first article is the start node at the left; one loose branch for each group grows to the right with time,
// the largest near the middle. A place in x is half the clock and half the order of the articles, so a busy hour gets more room and a quiet stretch keeps a little length.
// Each node is joined to the nearest earlier article of its group, and the first of a group to the start node (the rule of the circle web). All of it is in pixels of the
// map region at the zoom that frames the story, from the middle of the region: the stage scales it with the camera.

export interface BranchInput {
  // The minute of each article (since 1970 UTC), in order of time; the first is the start node.
  times: ArrayLike<number>
  // The group of each article, as its place among the groups of the story.
  groups: ArrayLike<number>
  seed: number
  // The region (px), and the room its left and right edges keep for the names of the start node and of the branch ends.
  w: number
  h: number
  left: number
  right: number
  // The room (px) kept between the branches and the axis, for the articles over time drawn there (stage-articles.ts).
  band?: number
  // The order of the branches from the top (lower first), in place of the fan of the largest in the middle (one for each outlet, those of a group together).
  rank?: Map<number, number>
  // How near each article is to the story's vector (0 to 1), and the place of the article each copies (-1: none). With them an article is not placed at random across its
  // branch: the farther it is from the core of the story the farther it is from the middle of its branch, and a copy goes to the side of its branch nearest the article it copies.
  core?: ArrayLike<number>
  copyOf?: ArrayLike<number>
}

export interface BranchTick { x: number, minute: number, kind: 'start' | 'day' | 'hour' }

export interface PlegmaBranchWeb {
  n: number
  x: Float32Array
  y: Float32Array
  phase: Float32Array
  speed: Float32Array
  reach: Float32Array
  edges: Uint32Array
  bow: Float32Array
  // The radius of a node (px).
  r: number
  // The last node of each branch (where its name goes), the largest branch first, with its group and its share of the articles.
  ends: { group: number, node: number, share: number }[]
  // The first node of each group, in order of time.
  firsts: number[]
  // The marks of the axis under the branches: the day the story began, the next days, and the hours while it is mostly inside a day. The most important first.
  ticks: BranchTick[]
  // Every mark the axis could have, the most important first: the zoom (plegma-zoom.ts) shows those that find room as the web opens.
  marks: BranchTick[]
  axisY: number
}

// How long after the first article a minute is, as the message to say it with and its number: the same minute, minutes under an hour, hours under a day, then days.
export const branchLag = (m: number) => m < 1 ? { key: 'story.branches.same', n: 0 } : m < 60 ? { key: 'story.branches.min', n: Math.round(m) } : m < 1440 ? { key: 'story.branches.hours', n: Math.floor(m / 60) } : { key: 'story.branches.days', n: Math.floor(m / 1440) }

// The radius of a node (px at the framing): smaller as the story has more articles.
export const branchRadius = (n: number) => (n > 400 ? 2.3 : n > 100 ? 3.4 : 4.4)

// The room under the branches for the axis, and the gap between the start node and the first branch nodes.
export const BRANCH_AXIS = 30
const HUB = 64
const MIX = 0.55

const athensParts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Athens', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
// The minutes Athens is ahead of UTC at a minute.
const athensOffset = (minute: number) => {
  const p = Object.fromEntries(athensParts.formatToParts(new Date(minute * 60000)).map(q => [q.type, q.value]))
  return (Date.UTC(+p.year!, +p.month! - 1, +p.day!, +p.hour!, +p.minute!) / 60000) - minute
}
// The minute (UTC) of the Athens midnight that begins the day of a minute.
const athensMidnight = (minute: number) => {
  const local = minute + athensOffset(minute)
  const mid = local - (((local % 1440) + 1440) % 1440)
  return mid - athensOffset(mid - athensOffset(minute))
}

export const buildBranchWeb = (input: BranchInput): PlegmaBranchWeb => {
  const { times, groups, seed, w, h } = input
  const n = times.length
  const rand = mulberry(seed * 31 + 7)
  const x = new Float32Array(n)
  const y = new Float32Array(n)
  const phase = new Float32Array(n)
  const speed = new Float32Array(n)
  const reach = new Float32Array(n)
  const jitter = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    phase[i] = rand() * Math.PI * 2
    speed[i] = (0.22 + rand() * 0.55) * (rand() < 0.5 ? -1 : 1)
    reach[i] = 0.55 + rand() * 0.9
    jitter[i] = rand() - 0.5
  }
  const r = branchRadius(n)
  const x0 = -w / 2 + input.left
  const x1 = Math.max(x0 + HUB + 40, w / 2 - input.right)
  const yTop = -h / 2 + 6
  const yBottom = h / 2 - BRANCH_AXIS - 6 - (input.band ?? 0)
  const axisY = h / 2 - BRANCH_AXIS + 16
  const mid = (yTop + yBottom) / 2
  const H = yBottom - yTop
  if (!n) return { n, x, y, phase, speed, reach, edges: new Uint32Array(0), bow: new Float32Array(0), r, ends: [], firsts: [], ticks: [], marks: [], axisY }
  const t0 = times[0]!
  const lag = (i: number) => times[i]! - t0
  const last = Math.max(1, lag(n - 1))
  const share = (i: number) => (n > 1 ? MIX * (i / (n - 1)) + (1 - MIX) * (lag(i) / last) : 0)
  const span = x1 - x0 - HUB
  // The x of a minute after the start: between the articles around it, as their places.
  const xOf = (m: number) => {
    if (m <= 0 || n < 2) return x0
    let i = 1
    while (i < n - 1 && lag(i) < m) i++
    const m0 = lag(i - 1)
    const m1 = lag(i)
    const q = m1 === m0 ? share(i) : share(i - 1) + (share(i) - share(i - 1)) * Math.min(1, Math.max(0, (m - m0) / (m1 - m0)))
    return x0 + HUB + span * q
  }
  // The branches: the groups of the articles after the first, the largest near the middle, as a fan.
  const members = new Map<number, number[]>()
  for (let i = 1; i < n; i++) { const g = groups[i]!; const list = members.get(g); if (list) list.push(i); else members.set(g, [i]) }
  const bySize = [...members.entries()].sort((a, b) => b[1].length - a[1].length || a[0] - b[0])
  const slots: (typeof bySize)[number][] = []
  if (input.rank) slots.push(...[...bySize].sort((a, b) => input.rank!.get(a[0])! - input.rank!.get(b[0])!))
  else bySize.forEach((g, q) => (q % 2 ? slots.push(g) : slots.unshift(g)))
  const weight = (list: number[]) => Math.sqrt(list.length) + 1.1
  const total = slots.reduce((s, [, list]) => s + weight(list), 0)
  let at = 0
  const tx = new Float32Array(n)
  const lanes = slots.map(([g, list], q) => {
    const part = weight(list) / total
    const lane = { g, list, home: (at + part / 2 - 0.5) * (H - 24), band: Math.min(part * (H - 24) * 0.95, 190), ph: (((q + 3) * 0.618034) % 1) * Math.PI * 2 }
    at += part
    return lane
  })
  const homeOf = new Map(lanes.map(l => [l.g, l.home]))
  // The place across the branch (-0.5 to 0.5): by the distance from the core, ranked in the story so the articles spread over the whole branch, on a side picked at random;
  // a copy at the side facing the branch of the article it copies.
  const across = Float32Array.from(jitter)
  if (input.core) {
    const far = Array.from({ length: n }, (_, i) => 1 - input.core![i]!)
    const rank = new Float32Array(n)
    Array.from({ length: n }, (_, i) => i).sort((a, b) => far[a]! - far[b]!).forEach((i, k) => { rank[i] = n > 1 ? k / (n - 1) : 0 })
    for (let i = 1; i < n; i++) {
      const src = input.copyOf?.[i] ?? -1
      const toward = src >= 0 ? Math.sign((homeOf.get(groups[src]!) ?? 0) - (homeOf.get(groups[i]!) ?? 0)) : 0
      across[i] = toward ? toward * 0.5 : (jitter[i]! < 0 ? -1 : 1) * 0.5 * rank[i]!
    }
  }
  for (const { list, home, band, ph } of lanes) {
    for (const i of list) {
      tx[i] = x0 + HUB + span * share(i)
      const s = (tx[i]! - x0) / (x1 - x0)
      const open = 1 - Math.exp(-s * 5.5)
      x[i] = tx[i]!
      y[i] = mid + home * open + Math.sin(s * 5.2 + ph) * 21 * open + across[i]! * band * (0.45 + 0.75 * Math.min(1, s * 2.5))
    }
  }
  x[0] = x0
  y[0] = mid
  // The nodes push each other apart until none is nearer than its size and a little room; a node keeps near its place in time.
  const min = r * 2 + (n > 400 ? 2.2 : 4)
  // A grid of cells as wide as `min` over the region, each a list of its nodes (head and next), so a node only meets the nodes of the cells around it.
  const cols = Math.ceil(w / min) + 3
  const rows = Math.ceil(h / min) + 3
  const head = new Int32Array(cols * rows)
  const next = new Int32Array(n)
  const colOf = (v: number) => Math.min(cols - 2, Math.max(1, Math.floor((v + w / 2) / min) + 1))
  const rowOf = (v: number) => Math.min(rows - 2, Math.max(1, Math.floor((v + h / 2) / min) + 1))
  for (let step = 0; step < 70; step++) {
    head.fill(-1)
    for (let i = 1; i < n; i++) {
      const c = rowOf(y[i]!) * cols + colOf(x[i]!)
      next[i] = head[c]!
      head[c] = i
    }
    for (let i = 1; i < n; i++) {
      const cx = colOf(x[i]!)
      const cy = rowOf(y[i]!)
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          for (let j = head[(cy + oy) * cols + cx + ox]!; j >= 0; j = next[j]!) {
            if (j <= i) continue
            const dx = x[i]! - x[j]!
            const dy = y[i]! - y[j]!
            const d = Math.hypot(dx, dy) || 0.1
            if (d >= min) continue
            const f = ((min - d) / d) * 0.4
            x[i]! += dx * f * 0.4; y[i]! += dy * f
            x[j]! -= dx * f * 0.4; y[j]! -= dy * f
          }
        }
      }
    }
    for (let i = 1; i < n; i++) {
      x[i]! += (tx[i]! - x[i]!) * 0.05
      y[i] = Math.min(yBottom, Math.max(yTop, y[i]!))
    }
  }
  // The lines: the nearest earlier article of the same group that is not to the right of it; the first of a group leaves the start node.
  const pairs: number[] = []
  const bows: number[] = []
  for (const [, list] of slots) {
    list.forEach((i, q) => {
      let best = 0
      let bd = Infinity
      for (let k = Math.max(0, q - 30); k < q; k++) {
        const j = list[k]!
        const d = Math.hypot(x[i]! - x[j]!, (y[i]! - y[j]!) * 1.15)
        if (d < bd && x[j]! <= x[i]! + 2) { bd = d; best = j }
      }
      pairs.push(i, best)
      bows.push((rand() - 0.5) * 0.5)
    })
  }
  const ends = bySize.map(([g, list]) => ({ group: g, node: list[list.length - 1]!, share: (list.length + (groups[0] === g ? 1 : 0)) / n }))
  const firsts = [...members.values()].map(list => list[0]!).sort((a, b) => a - b)
  // The axis: the start day at the start node, each next Athens day the story has articles on (the busiest first), and, while most of the story is inside its first day, the hours.
  const ticks: BranchTick[] = [{ x: x0, minute: t0, kind: 'start' }]
  const days: { minute: number, count: number }[] = []
  for (let day = athensMidnight(t0) + 1440; ; ) {
    const midnight = athensMidnight(day + 720)
    if (midnight - t0 >= last) break
    const next = athensMidnight(midnight + 1440 + 720)
    let count = 0
    for (let i = 0; i < n; i++) if (times[i]! >= midnight && times[i]! < next) count++
    if (count) days.push({ minute: midnight, count })
    day = midnight + 1440
  }
  days.sort((a, b) => b.count - a.count)
  const cand: BranchTick[] = days.map(d => ({ x: xOf(d.minute - t0), minute: d.minute, kind: 'day' }))
  if (lag(Math.floor((n - 1) * 0.85)) <= 1440) {
    const startLocal = t0 + athensOffset(t0)
    for (const st of [360, 180, 60, 30, 10, 5]) {
      const first = Math.ceil(startLocal / st) * st
      for (let local = first; ; local += st) {
        const m = local - startLocal
        if (m <= 0) continue
        if (m > last || m > 1440) break
        if (local % 1440 === 0) continue
        cand.push({ x: xOf(m), minute: t0 + m, kind: 'hour' })
      }
    }
  }
  const used: number[] = [x0]
  for (const c of cand) {
    if (c.x < x0 + HUB || used.some(u => Math.abs(u - c.x) < (c.kind === 'hour' ? 62 : 46))) continue
    used.push(c.x)
    ticks.push(c)
  }
  return { n, x, y, phase, speed, reach, edges: Uint32Array.from(pairs), bow: Float32Array.from(bows), r, ends, firsts, ticks, marks: [ticks[0]!, ...cand], axisY }
}

// A name on the branches: where it is (px, from the middle of the region, as the nodes), its text, size and weight, how it is anchored, the slot of the dot before it (-1: none),
// whether it is muted, and how much it shows (the names of the deeper zoom come in over a band of zoom).
export interface BranchName { x: number, y: number, text: string, size: number, weight: number, anchor: 'start' | 'end' | 'middle', dot: number, mute: boolean, alpha: number }
export interface BranchNameAsk { x: number, y: number, text: string, size?: number, weight?: number, anchor?: 'start' | 'end' | 'middle', dot?: number, mute?: boolean, fixed?: boolean, alpha?: number }

// The names are placed in order: each takes the first place, from where it was asked and then a line up or down, that meets no node, no name before it and
// does not leave the region; a fixed name takes its place as it is. `width` measures a text at a size and weight. A node outside the region meets no name (the names keep inside it).
export const placeBranchNames = (web: Pick<PlegmaBranchWeb, 'n' | 'x' | 'y' | 'r'>, asks: BranchNameAsk[], box: { w: number, h: number }, width: (text: string, size: number, weight: number) => number): BranchName[] => {
  const taken: { x0: number, y0: number, x1: number, y1: number }[] = []
  for (let i = 0; i < web.n; i++) {
    if (Math.abs(web.x[i]!) > box.w / 2 + web.r + 2 || Math.abs(web.y[i]!) > box.h / 2 + web.r + 1) continue
    taken.push({ x0: web.x[i]! - web.r - 2, x1: web.x[i]! + web.r + 2, y0: web.y[i]! - web.r - 1, y1: web.y[i]! + web.r + 1 })
  }
  const out: BranchName[] = []
  for (const ask of asks) {
    const size = ask.size ?? 11.5
    const weight = ask.weight ?? 400
    const anchor = ask.anchor ?? 'start'
    const dot = ask.dot ?? -1
    const tw = width(ask.text, size, weight) + (dot >= 0 ? 10 : 0)
    for (const d of ask.fixed ? [0] : [0, 14, -14, 28, -28, 42, -42]) {
      const left = anchor === 'end' ? ask.x - tw : anchor === 'middle' ? ask.x - tw / 2 : ask.x
      const b = { x0: left - 2, x1: left + tw + 2, y0: ask.y + d - size * 0.8, y1: ask.y + d + size * 0.45 }
      if (!ask.fixed && (b.x1 > box.w / 2 || b.x0 < -box.w / 2 || b.y0 < -box.h / 2 || b.y1 > box.h / 2 || taken.some(q => b.x0 < q.x1 && b.x1 > q.x0 && b.y0 < q.y1 && b.y1 > q.y0))) continue
      taken.push(b)
      out.push({ x: ask.x, y: ask.y + d, text: ask.text, size, weight, anchor, dot, mute: !!ask.mute, alpha: ask.alpha ?? 1 })
      break
    }
  }
  return out
}
