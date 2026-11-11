import type { PlegmaStory, PlegmaWeb, PlegmaWorld } from './plegma-world.ts'
import { dotsOf, mulberry, radiusOf } from './plegma-world.ts'

// The hero of Αρχική shows the Plegma as unexplored ground: black, blurred nodes that a click brings into focus, like the map of a game that clears as you walk forward.
// This is the part that needs no canvas: the shape of a web in the hero, where its nodes lie while it is still loose, and how far a click has reached.

const TAU = Math.PI * 2
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))
export const smooth = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t) }

// A web of the hero has a hub, a few clusters around it and a head for each cluster. `cluster[i]` is the cluster of node i (-1 for the hub): the stage moves a cluster as one,
// so the lines between its nodes flex instead of every node wandering alone.
export interface PlegmaHeroWeb extends PlegmaWeb { cluster: number[], clusters: number }

// The shape of a story in the hero: the hub joins the head of each cluster, the nodes of a cluster join the nearest node of it that is already placed (and some a second one,
// which closes small triangles), the heads of neighbour clusters are joined in a ring, and a few bridges join the nodes of two clusters that lie nearest. The web reads as
// a place with districts, not as a tree.
export const heroShape = (count: number, r: number, rand: () => number) => {
  const clusters = clamp(Math.round(Math.sqrt(count) / 1.7), 2, 5)
  const base = rand() * TAU
  const centres = Array.from({ length: clusters }, (_, c) => {
    const a = base + (c + (rand() - 0.5) * 0.5) * TAU / clusters
    const d = r * (0.5 + rand() * 0.3)
    return { x: Math.cos(a) * d, y: Math.sin(a) * d * 0.85, w: 0.6 + rand() }
  })
  const total = centres.reduce((sum, c) => sum + c.w, 0)
  const offs: { x: number, y: number }[] = [{ x: 0, y: 0 }]
  const cluster = [-1]
  for (let j = 1; j < count; j++) {
    let pick = rand() * total
    let c = 0
    while (c < clusters - 1 && pick > centres[c]!.w) { pick -= centres[c]!.w; c++ }
    let best: { x: number, y: number, gap: number } | null = null
    for (let k = 0; k < 10; k++) {
      const a = rand() * TAU
      const rr = r * 0.34 * Math.sqrt(rand())
      const x = centres[c]!.x + Math.cos(a) * rr
      const y = centres[c]!.y + Math.sin(a) * rr * 0.85
      let gap = 99
      for (const q of offs) gap = Math.min(gap, Math.hypot(q.x - x, q.y - y))
      if (!best || gap > best.gap) best = { x, y, gap }
    }
    offs.push({ x: best!.x, y: best!.y })
    cluster.push(c)
  }
  const edges: [number, number][] = []
  const seen = new Set<string>()
  const join = (i: number, j: number) => {
    const key = i < j ? `${i}-${j}` : `${j}-${i}`
    if (i === j || seen.has(key)) return
    seen.add(key)
    edges.push([i, j])
  }
  const dist = (i: number, j: number) => Math.hypot(offs[i]!.x - offs[j]!.x, offs[i]!.y - offs[j]!.y)
  const heads: number[] = []
  for (let c = 0; c < clusters; c++) {
    const members = cluster.flatMap((k, i) => (k === c ? [i] : []))
    if (!members.length) { heads.push(-1); continue }
    members.sort((a, b) => Math.hypot(offs[a]!.x - centres[c]!.x, offs[a]!.y - centres[c]!.y) - Math.hypot(offs[b]!.x - centres[c]!.x, offs[b]!.y - centres[c]!.y))
    const head = members[0]!
    heads.push(head)
    join(0, head)
    for (let m = 1; m < members.length; m++) {
      const near = members.slice(0, m).map(j => ({ j, d: dist(members[m]!, j) })).sort((a, b) => a.d - b.d)
      join(members[m]!, near[0]!.j)
      if (near[1] && near[1].d < near[0]!.d * 1.6 && rand() < 0.4) join(members[m]!, near[1].j)
    }
  }
  const live = heads.filter(h => h >= 0)
  if (live.length > 2) for (let c = 0; c < live.length; c++) if (rand() < 0.65) join(live[c]!, live[(c + 1) % live.length]!)
  // A bridge between each two neighbour clusters: the pair of non-head nodes that lie nearest.
  for (let c = 0; c < clusters; c++) {
    const d = (c + 1) % clusters
    if (c === d || heads[c]! < 0 || heads[d]! < 0 || rand() > 0.55) continue
    let best: [number, number, number] | null = null
    for (let i = 1; i < count; i++) {
      if (cluster[i] !== c || i === heads[c]) continue
      for (let j = 1; j < count; j++) {
        if (cluster[j] !== d || j === heads[d]) continue
        const gap = dist(i, j)
        if (!best || gap < best[2]) best = [i, j, gap]
      }
    }
    if (best) join(best[0], best[1])
  }
  return { offs, edges, cluster, clusters }
}

// The web of a story in the hero, the same on every call.
export const heroWebOf = (world: PlegmaWorld, s: PlegmaStory): PlegmaHeroWeb => {
  const k = dotsOf(s.n)
  const key = `hero:${s.id}:${k}`
  let web = world.webs.get(key) as PlegmaHeroWeb | undefined
  if (!web) {
    const r = radiusOf(k)
    web = { k, r, ...heroShape(k, r, mulberry(s.id * 17 + 3)) }
    world.webs.set(key, web)
  }
  return web
}

// While a web is still unexplored its nodes lie loose around its place: node `i` of story `id` is this many radii of the web farther out, in this direction.
// A fraction (0 to 1) of the way from loose to formed moves it from here to its place.
export const looseOf = (id: number, i: number) => {
  const h = ((Math.imul(i + 1, 2654435761) ^ Math.imul(id + 7, 40503)) >>> 0) / 4294967296
  const g = ((Math.imul(i + 3, 40503) ^ Math.imul(id + 11, 2654435761)) >>> 0) / 4294967296
  const a = h * TAU
  const reach = 0.9 + g * 1.5
  return { x: Math.cos(a) * reach, y: Math.sin(a) * reach * 0.85 }
}

// A click starts a wave over the hero: it reaches a point `speed` pixels a second after the click, and the ground clears over a `front` wide band as it goes by.
export const HERO_SPEED = 600
export const HERO_FRONT = 240
export interface HeroSource { x: number, y: number, t0: number }
// How cleared a point is: `d` is its distance in pixels from the click, `age` the milliseconds since it.
export const waveReveal = (d: number, age: number) => smooth(0, 1, (HERO_SPEED * Math.max(0, age) / 1000 - d) / HERO_FRONT)
// The pixels the wave has to cover for a hero of this size, and so when the last of it is clear.
export const heroReach = (w: number, h: number) => Math.hypot(w, h) + HERO_FRONT
export const heroClearMs = (w: number, h: number) => (heroReach(w, h) / HERO_SPEED) * 1000
// The lantern: a point near the pointer is partly cleared, most at the pointer, and not at all beyond `radius`.
export const lanternReveal = (d: number, radius: number) => smooth(0, 1, 1 - d / radius)
