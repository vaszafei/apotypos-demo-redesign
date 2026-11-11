import { mulberry } from './plegma-world.ts'

// The web of the picked story: one node for each article. The fixtures hold the articles of a story as counts for each day (stories.json) and for each outlet on
// each day (storyDetail.json), so a node knows its day and, once the detail is read, its outlet and group; it has no headline of its own.
// Until the outlets are read the nodes lie on a sunflower disc in the order of their days, so the first article is at the center and the story grows outward day by day;
// each node is joined to the nearest one before it (a growth tree), and some to a second. With the groups known the disc is cut in a sector for each group
// (buildSectorWeb). The disc has a radius of 1: the stage scales it.

export interface PlegmaArticleWeb {
  n: number
  // The nodes on the unit disc, the node of the first article first.
  x: Float32Array
  y: Float32Array
  // Where each node is on its small circle, how fast it goes round (radians a second, the sign is the way) and how wide the circle is (1 = the stage's amount).
  phase: Float32Array
  speed: Float32Array
  reach: Float32Array
  // The lines, as pairs of nodes, and how far each bows to the side, as a share of its length.
  edges: Uint32Array
  bow: Float32Array
  // The distance between two neighbours on the unit disc.
  gap: number
  // With sectors: where the sector of each group begins and how wide it is (pairs of radians, from the top, clockwise), in the order of the groups.
  arcs: Float32Array
}

const GOLDEN = Math.PI * (3 - Math.sqrt(5))
const PHI = (Math.sqrt(5) - 1) / 2
// The first article is alone at the center: the others begin this far out.
const HUB = 0.17
// The room between two sectors, and the most a node is moved from the radius its place in time gives it when the nodes are spread.
const SECTOR_GAP = 0.09
const RELAX_BAND = 0.07

// The web by sectors: `sectors[i]` is the group of node i (0 is the first sector, at the top; they go clockwise, as the ring of the groups card). A node is as far from
// the center as its place in time (the first article is the center, the last ones are at the rim) and inside the sector of its group, so the disc reads as the card's ring
// taken apart into articles. Each node is joined to the nearest earlier one of its group, and the first of a group to the nearest earlier article of any group.
const buildSectorWeb = (n: number, seed: number, sectors: ArrayLike<number>): PlegmaArticleWeb => {
  const rand = mulberry(seed * 17 + 3)
  const gap = Math.sqrt(Math.PI / Math.max(n, 1))
  const count: number[] = []
  for (let i = 0; i < n; i++) count[sectors[i]!] = (count[sectors[i]!] ?? 0) + 1
  for (let g = 0; g < count.length; g++) count[g] ??= 0
  const used = count.filter(c => c > 0).length
  const room = used > 1 ? Math.min(SECTOR_GAP, (Math.PI * 0.5) / used) : 0
  const arcs = new Float32Array(count.length * 2)
  let at = 0
  for (let g = 0; g < count.length; g++) {
    const span = count[g]! ? (Math.PI * 2 - used * room) * (count[g]! / n) : 0
    arcs[g * 2] = at + (count[g]! ? room / 2 : 0)
    arcs[g * 2 + 1] = span
    at += span + (count[g]! ? room : 0)
  }
  const x = new Float32Array(n)
  const y = new Float32Array(n)
  const rad = new Float32Array(n)
  const phase = new Float32Array(n)
  const speed = new Float32Array(n)
  const reach = new Float32Array(n)
  const seen: number[] = count.map(() => 0)
  // An angle from the top, clockwise, as a place on the disc.
  const put = (i: number, r: number, a: number) => { x[i] = Math.sin(a) * r; y[i] = -Math.cos(a) * r }
  const angleOf = (i: number) => { const a = Math.atan2(x[i]!, -y[i]!); return a < 0 ? a + Math.PI * 2 : a }
  for (let i = 0; i < n; i++) {
    const g = sectors[i]!
    const k = seen[g]!++
    rad[i] = i === 0 ? 0 : Math.sqrt(HUB * HUB + (1 - HUB * HUB) * (i / Math.max(1, n - 1)))
    const side = count[g]! === 1 ? 0.5 : 0.06 + 0.88 * (((k + 0.5) * PHI + (g * 0.37)) % 1)
    put(i, rad[i]!, arcs[g * 2]! + arcs[g * 2 + 1]! * side)
    phase[i] = rand() * Math.PI * 2
    speed[i] = (0.22 + rand() * 0.55) * (rand() < 0.5 ? -1 : 1)
    reach[i] = 0.55 + rand() * 0.9
  }
  // The nodes push each other apart until none is nearer than most of a gap; a node stays inside its sector and near its radius, so the order in time holds.
  if (n <= 400) {
    const want = gap * 0.92
    const dx = new Float32Array(n)
    const dy = new Float32Array(n)
    for (let pass = 0; pass < 60; pass++) {
      dx.fill(0)
      dy.fill(0)
      for (let i = 1; i < n; i++) {
        for (let j = 0; j < i; j++) {
          const ex = x[i]! - x[j]!
          const ey = y[i]! - y[j]!
          const d = Math.hypot(ex, ey)
          if (d >= want) continue
          const push = ((want - d) / 2) * 0.6
          const ux = d > 1e-6 ? ex / d : Math.cos(i * 2.4)
          const uy = d > 1e-6 ? ey / d : Math.sin(i * 2.4)
          dx[i]! += ux * push; dy[i]! += uy * push
          if (j > 0) { dx[j]! -= ux * push; dy[j]! -= uy * push }
        }
      }
      for (let i = 1; i < n; i++) {
        x[i]! += dx[i]!
        y[i]! += dy[i]!
        const g = sectors[i]!
        const a0 = arcs[g * 2]!
        const span = arcs[g * 2 + 1]!
        const r = Math.min(1, Math.max(Math.max(HUB, rad[i]! - RELAX_BAND), Math.min(rad[i]! + RELAX_BAND, Math.hypot(x[i]!, y[i]!))))
        let a = angleOf(i)
        // The angle nearest to the node that is inside its sector (the sector may pass the top).
        const mid = a0 + span / 2
        let off = a - mid
        if (off > Math.PI) off -= Math.PI * 2
        if (off < -Math.PI) off += Math.PI * 2
        const half = Math.max(0, span / 2 - Math.min(span / 2, (want * 0.35) / Math.max(r, HUB)))
        a = mid + Math.min(half, Math.max(-half, off))
        put(i, r, a)
      }
    }
  }
  const pairs: number[] = []
  const bows: number[] = []
  for (let i = 1; i < n; i++) {
    let own = -1
    let any = 0
    let dOwn = Infinity
    let dAny = Infinity
    for (let j = 0; j < i; j++) {
      const d = Math.hypot(x[j]! - x[i]!, y[j]! - y[i]!)
      if (d < dAny) { dAny = d; any = j }
      if (sectors[j] === sectors[i] && d < dOwn) { dOwn = d; own = j }
    }
    pairs.push(i, own >= 0 ? own : any)
    bows.push((rand() - 0.5) * 0.5)
  }
  return { n, x, y, phase, speed, reach, edges: Uint32Array.from(pairs), bow: Float32Array.from(bows), gap, arcs }
}

export const buildArticleWeb = (n: number, seed: number, sectors?: ArrayLike<number>): PlegmaArticleWeb => {
  if (sectors && sectors.length === n && n > 0) return buildSectorWeb(n, seed, sectors)
  const rand = mulberry(seed * 17 + 3)
  const gap = Math.sqrt(Math.PI / Math.max(n, 1))
  const x = new Float32Array(n)
  const y = new Float32Array(n)
  const phase = new Float32Array(n)
  const speed = new Float32Array(n)
  const reach = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const r = Math.sqrt((i + 0.5) / n)
    const a = i * GOLDEN
    x[i] = Math.cos(a) * r + (rand() - 0.5) * 0.7 * gap
    y[i] = (Math.sin(a) * r + (rand() - 0.5) * 0.7 * gap) * 0.9
    phase[i] = rand() * Math.PI * 2
    speed[i] = (0.22 + rand() * 0.55) * (rand() < 0.5 ? -1 : 1)
    reach[i] = 0.55 + rand() * 0.9
  }
  // The nearest earlier node, found on a grid of cells a little wider than the gap, so a story of thousands of articles costs a pass.
  const cell = gap * 1.8
  const cells = new Map<number, number[]>()
  const key = (cx: number, cy: number) => cx * 4096 + cy
  const pairs: number[] = []
  const bows: number[] = []
  for (let i = 0; i < n; i++) {
    const cx = Math.floor(x[i]! / cell)
    const cy = Math.floor(y[i]! / cell)
    if (i > 0) {
      let first = -1
      let second = -1
      let d1 = Infinity
      let d2 = Infinity
      for (let ring = 1; ring <= 3 && first < 0; ring++) {
        for (let dx = -ring; dx <= ring; dx++) {
          for (let dy = -ring; dy <= ring; dy++) {
            for (const j of cells.get(key(cx + dx, cy + dy)) ?? []) {
              const d = Math.hypot(x[j]! - x[i]!, y[j]! - y[i]!)
              if (d < d1) { d2 = d1; second = first; d1 = d; first = j } else if (d < d2) { d2 = d; second = j }
            }
          }
        }
      }
      if (first < 0) first = i - 1
      pairs.push(i, first)
      bows.push((rand() - 0.5) * 0.7)
      if (second >= 0 && d2 < d1 * 1.7 && rand() < 0.4) { pairs.push(i, second); bows.push((rand() - 0.5) * 0.7) }
    }
    const k = key(cx, cy)
    const bucket = cells.get(k)
    if (bucket) bucket.push(i); else cells.set(k, [i])
  }
  return { n, x, y, phase, speed, reach, edges: Uint32Array.from(pairs), bow: Float32Array.from(bows), gap, arcs: new Float32Array(0) }
}

const cache = new Map<string, PlegmaArticleWeb>()
// `sectors` are the groups of the nodes of this story, once its articles are read: the same for a story on every call, so they are not in the key.
export const articleWebOf = (id: number, n: number, sectors?: ArrayLike<number>) => {
  const k = `${id}:${n}:${sectors ? 's' : ''}`
  let web = cache.get(k)
  if (!web) { web = buildArticleWeb(n, id, sectors); cache.set(k, web) }
  return web
}

// A story of more articles than this shows a node for several of them, so the web stays readable: the nodes are evenly spaced through the articles in order of day,
// each stands for `articlesPerNode` of them and has the outlet and group of the one at its middle.
export const PLEGMA_NODES_MAX = 250
export const nodeCount = (articles: number) => Math.min(articles, PLEGMA_NODES_MAX)
export const articlesPerNode = (articles: number) => Math.ceil(articles / nodeCount(articles))
// The article, of `articles` in order of day, that node i of the web stands for.
export const articleOfNode = (i: number, articles: number) => Math.min(articles - 1, Math.floor(((i + 0.5) * articles) / nodeCount(articles)))

// The day (an index of the dates) of each article of a story, first day first: `days` is the pairs [day, articles] of stories.json.
export const articleDays = (days: number[]) => {
  const out: number[] = []
  for (let i = 0; i + 1 < days.length; i += 2) for (let k = 0; k < days[i + 1]!; k++) out.push(days[i]!)
  return out
}

// The radius on the screen of the web of a story of n articles, in a free area whose largest web has the radius `max`: a small story is a web of about half
// that radius and the largest ones fill it.
export const articleRadius = (n: number, max: number) => max * Math.min(1, Math.max(0.5, 0.5 + 0.5 * Math.sqrt(nodeCount(n) / 250)))

// The group, or the outlet of a group, that the pointer is on in a card: the articles of it come forward on the map. A group of null is the articles with no group.
export interface PlegmaHighlight { group: string | null, outlet?: string }
export const matchesHighlight = (a: { group: string | null, outlet: string }, h: PlegmaHighlight) => a.group === h.group && (h.outlet === undefined || a.outlet === h.outlet)

// An article as the stage keeps it for its tooltip and its color: the day, the outlet, and the slot of its group's color (0 is no group).
// `order` is the place of its group among the groups of the story, largest first, as the groups card lists them.
export interface PlegmaArticle { day: number, outlet: string, group: string | null, slot: number, order: number }
