import { mulberry } from './plegma-world.ts'
import { BRANCH_AXIS, branchRadius } from './plegma-branches.ts'
import type { BranchInput, PlegmaBranchWeb } from './plegma-branches.ts'

// Σύννεφα (#218): the web of a story as clouds of time, left to right, joined by a thread. The first article is the start node at the left. A cloud is the articles
// of one stretch of time (minutes to a week, cloudUnit), a loose web with the groups side by side and an uneven outline, its size by its count; the free room goes
// to the quiet before each cloud. Inside a cloud a node is joined to the nearest earlier one, of its group if near; the thread joins the last article of a cloud
// to the first of the next. Same units as Κλαδιά: px of the region at the
// framing zoom, from the middle of the region.

export interface StoryCloud {
  // The first and the last node of the cloud (the thread comes in at the first, at its left, and leaves from the last, at its right), its middle and the y of its label.
  node: number
  last: number
  cx: number
  labelY: number
  // The stretch, in Athens wall-clock minutes (minutes since 1970 as if Athens were UTC): from and to (exclusive).
  from: number
  to: number
}

export interface StoryCloudWeb extends PlegmaBranchWeb {
  clouds: StoryCloud[]
  unit: number
  // The first `threads` edges are the thread between the clouds; the rest are the lines inside them.
  threads: number
}

const athensParts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Athens', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
// The minutes Athens is ahead of UTC, for each UTC hour asked (the offset changes only on an hour).
const offsets = new Map<number, number>()
// A minute (since 1970 UTC) as the same moment on the Athens wall clock.
export const athensLocal = (minute: number) => {
  const hour = Math.floor(minute / 60)
  let off = offsets.get(hour)
  if (off === undefined) {
    const p = Object.fromEntries(athensParts.formatToParts(new Date(hour * 3600000)).map(q => [q.type, q.value]))
    off = Date.UTC(+p.year!, +p.month! - 1, +p.day!, +p.hour!, +p.minute!) / 60000 - hour * 60
    offsets.set(hour, off)
  }
  return minute + off
}

const UNITS = [5, 10, 30, 60, 180, 360, 1440]
const DAY = 1440
const WEEK = 10080
// The stretch of a cloud (minutes): the shortest of 5, 10, 30 min, 1, 3, 6 h or a day that makes at most 9 clouds; a story of 5 days or more is in days,
// or in weeks when it has more than 8 days with articles. The stretches start at the Athens midnight of the first article.
export const cloudUnit = (times: ArrayLike<number>) => {
  const local = Array.from(times, athensLocal)
  if (local.length < 2) return DAY
  const base = local[0]! - (local[0]! % DAY)
  const bins = (unit: number) => new Set(local.slice(1).map(m => Math.floor((m - base) / unit))).size
  if (new Set(local.map(m => Math.floor(m / DAY))).size >= 5) return bins(DAY) <= 8 ? DAY : WEEK
  return UNITS.find(u => bins(u) <= 9) ?? DAY
}

const two = (n: number) => String(n).padStart(2, '0')
const clockOf = (local: number, end = false) => {
  const m = ((local % DAY) + DAY) % DAY
  return m === 0 && end ? '24:00' : `${two(Math.floor(m / 60))}:${two(m % 60)}`
}
// The label under cloud k: its day, its week, or its clock time (a start under an hour, a span from an hour), with the day when it is not the day of the cloud before.
// `day` writes a wall-clock minute as a day and month; `range` two of them as a span of days.
export const cloudLabel = (clouds: StoryCloud[], k: number, unit: number, day: (local: number) => string, range: (from: number, to: number) => string) => {
  const c = clouds[k]!
  if (unit === WEEK) return range(c.from, c.to - DAY)
  if (unit === DAY) return day(c.from)
  const prev = clouds[k - 1]
  const sameDay = !!prev && Math.floor(prev.from / DAY) === Math.floor(c.from / DAY)
  const clock = unit < 60 ? clockOf(c.from) : `${clockOf(c.from)}–${clockOf(c.to, true)}`
  return sameDay ? clock : `${day(c.from)}, ${clock}`
}

export const buildCloudWeb = (input: BranchInput): StoryCloudWeb => {
  const { times, groups, seed, w, h } = input
  const n = times.length
  const rand = mulberry(seed * 31 + 11)
  const x = new Float32Array(n)
  const y = new Float32Array(n)
  const phase = new Float32Array(n)
  const speed = new Float32Array(n)
  const reach = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    phase[i] = rand() * Math.PI * 2
    speed[i] = (0.22 + rand() * 0.55) * (rand() < 0.5 ? -1 : 1)
    reach[i] = 0.55 + rand() * 0.9
  }
  const r = branchRadius(n)
  const x0 = -w / 2 + input.left
  const x1 = w / 2 - input.right
  const yTop = -h / 2 + 6
  const yBottom = h / 2 - BRANCH_AXIS - 6
  const mid = (yTop + yBottom) / 2
  const H = yBottom - yTop
  const unit = cloudUnit(times)
  const empty = { n, x, y, phase, speed, reach, r, ends: [], firsts: [], ticks: [], marks: [], axisY: yBottom + 22, unit }
  if (!n) return { ...empty, edges: new Uint32Array(0), bow: new Float32Array(0), clouds: [], threads: 0 }
  const local = Array.from(times, athensLocal)
  const base = local[0]! - (local[0]! % DAY)
  // The clouds, in order of time: the articles after the first, by their stretch.
  const byBin = new Map<number, number[]>()
  for (let i = 1; i < n; i++) {
    const q = Math.floor((local[i]! - base) / unit)
    const list = byBin.get(q)
    if (list) list.push(i)
    else byBin.set(q, [i])
  }
  const bins = [...byBin.entries()].sort((a, b) => a[0] - b[0])
  x[0] = x0
  y[0] = mid
  if (!bins.length) return { ...empty, edges: new Uint32Array(0), bow: new Float32Array(0), clouds: [], threads: 0 }
  // The spacing of the nodes: as roomy as Κλαδιά's when it fits, smaller when the clouds need the width or the tallest one the height.
  const avail = x1 - x0 - 60
  const gap = bins.length > 9 ? 4 : 22
  const sum = bins.reduce((s, [, list]) => s + Math.sqrt(list.length), 0)
  const most = Math.max(...bins.map(([, list]) => list.length))
  const sp = Math.max(r * 2 + 1, Math.min(r * 2 + 8, (avail - (gap + 8) * bins.length) / (2 * 0.62 * 1.16 * sum), (H * 0.42) / (0.62 * Math.sqrt(most))))
  const cl = bins.map(([q, list]) => { const cr = 0.62 * sp * Math.sqrt(list.length) + 4; return { q, list, r: cr, hw: cr * 1.16, cx: 0, cy: 0 } })
  const used = cl.reduce((s, c) => s + 2 * c.hw + gap, 0)
  const free = Math.max(0, avail - used)
  // The free room is shared by how long the quiet before each cloud was.
  const quiet = cl.map((c, k) => (k ? Math.min(Math.log1p(c.q - cl[k - 1]!.q - 0.6), 2) + 0.35 : 0.35))
  const qs = quiet.reduce((s, q) => s + q, 0)
  let at = x0 + 40
  cl.forEach((c, k) => {
    at += Math.min((free * quiet[k]!) / qs, 170)
    c.cx = at + c.hw
    at += 2 * c.hw + gap
    c.cy = mid + (rand() - 0.5) * Math.max(0, H - 2 * c.r - 40) * 0.42
  })
  const last = cl[cl.length - 1]!
  const slack = x1 - (last.cx + last.hw)
  if (slack > 60) for (const c of cl) c.cx += slack * 0.35
  // The groups in the order they first wrote, so inside a cloud they lie side by side in the same order.
  const groupRank = new Map<number, number>()
  for (let i = 0; i < n; i++) if (!groupRank.has(groups[i]!)) groupRank.set(groups[i]!, groupRank.size)
  const min = Math.max(sp * 0.82, r * 2 + (n > 400 ? 2.2 : 4))
  const pairs: number[] = []
  const bows: number[] = []
  const inner: number[] = []
  const innerBows: number[] = []
  cl.forEach((c, k) => {
    const turn = rand() * Math.PI * 2
    const placed = [...c.list].sort((a, b) => groupRank.get(groups[a]!)! - groupRank.get(groups[b]!)! || a - b)
    placed.forEach((i, q) => {
      const th = ((q + 0.5) / placed.length) * Math.PI * 2 + turn
      const lump = 1 + 0.24 * Math.sin(th * 2 + k * 1.7) + 0.13 * Math.sin(th * 3 + k)
      const rad = c.r * Math.sqrt((((q + 1) * 0.618) % 1) * 0.94 + 0.04) * lump
      x[i] = c.cx + Math.cos(th) * rad * 1.08
      y[i] = c.cy + Math.sin(th) * rad * 0.98
    })
    relax(x, y, c.list, min, 60, yTop, yBottom)
    // The thread goes through time: the earliest article of the cloud takes the leftmost place, the latest the rightmost.
    const swap = (i: number, j: number) => { const tx = x[i]!; const ty = y[i]!; x[i] = x[j]!; y[i] = y[j]!; x[j] = tx; y[j] = ty }
    const edge = (sign: number) => c.list.reduce((b, i) => (x[i]! * sign > x[b]! * sign ? i : b), c.list[0]!)
    swap(c.list[0]!, edge(-1))
    if (c.list.length > 1) swap(c.list[c.list.length - 1]!, edge(1))
    // Inside the cloud: each node to the nearest earlier one, an earlier one of another group counting as farther.
    c.list.forEach((i, q) => {
      if (!q) return
      let best = c.list[0]!
      let bd = Infinity
      for (let p = 0; p < q; p++) {
        const j = c.list[p]!
        const dx = x[i]! - x[j]!
        const dy = y[i]! - y[j]!
        const d = Math.sqrt(dx * dx + dy * dy) + (groups[j] === groups[i] ? 0 : sp * 1.6)
        if (d < bd) { bd = d; best = j }
      }
      inner.push(i, best)
      innerBows.push((rand() - 0.5) * 0.5)
    })
    pairs.push(c.list[0]!, k ? cl[k - 1]!.list[cl[k - 1]!.list.length - 1]! : 0)
    bows.push(0.14)
  })
  y[0] = mid + (cl[0]!.cy - mid) * 0.5
  const clouds = cl.map(c => {
    let low = -Infinity
    for (const i of c.list) low = Math.max(low, y[i]!)
    const from = base + c.q * unit
    return { node: c.list[0]!, last: c.list[c.list.length - 1]!, cx: c.cx, labelY: Math.min(yBottom + 22, low + 22), from, to: from + unit }
  })
  return { ...empty, edges: Uint32Array.from([...pairs, ...inner]), bow: Float32Array.from([...bows, ...innerBows]), clouds, threads: cl.length }
}

// The nodes of a list push each other apart until none is nearer than `min`, kept between two heights. A grid of cells as wide as `min` over the nodes, each a list
// of its nodes (head and next), so a node only meets the nodes of the cells around it.
const relax = (x: Float32Array, y: Float32Array, list: number[], min: number, steps: number, yTop: number, yBottom: number) => {
  if (list.length < 2) return
  for (let step = 0; step < steps; step++) {
    let lx = Infinity
    let ly = Infinity
    let hx = -Infinity
    let hy = -Infinity
    for (const i of list) { lx = Math.min(lx, x[i]!); ly = Math.min(ly, y[i]!); hx = Math.max(hx, x[i]!); hy = Math.max(hy, y[i]!) }
    const cols = Math.floor((hx - lx) / min) + 3
    const rows = Math.floor((hy - ly) / min) + 3
    const head = new Int32Array(cols * rows).fill(-1)
    const next = new Int32Array(list.length)
    const cell = new Int32Array(list.length)
    for (let q = 0; q < list.length; q++) {
      cell[q] = (Math.floor((y[list[q]!]! - ly) / min) + 1) * cols + Math.floor((x[list[q]!]! - lx) / min) + 1
      next[q] = head[cell[q]!]!
      head[cell[q]!] = q
    }
    let moved = false
    for (let q = 0; q < list.length; q++) {
      const i = list[q]!
      const c = cell[q]!
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          for (let p = head[c + oy * cols + ox]!; p >= 0; p = next[p]!) {
            if (p <= q) continue
            const j = list[p]!
            const dx = x[i]! - x[j]!
            const dy = y[i]! - y[j]!
            const d2 = dx * dx + dy * dy
            if (d2 >= min * min) continue
            const d = Math.sqrt(d2) || 0.1
            const f = ((min - d) / d) * 0.4
            x[i]! += dx * f; y[i]! += dy * f
            x[j]! -= dx * f; y[j]! -= dy * f
            moved = true
          }
        }
      }
    }
    for (const i of list) y[i] = Math.min(yBottom, Math.max(yTop, y[i]!))
    if (!moved) break
  }
}
