import { mulberry } from './plegma-world.ts'

// The web of a theme in view: the theme is the center, its largest stories lie around it at uneven distances, and each story is a small loose web of the outlets that
// wrote it most (a node for each outlet, as large as its articles in that story). It is the web of a story (utils/plegma-articles.ts) one level up, and it is not a
// chart: the places are loose on purpose, the numbers are in the cards and the tooltips.

export interface PlegmaThemeOutlet { name: string, group: string | null, slot: number, n: number }
// `media` is every outlet that wrote the story; `outlets` are the ones the web shows.
export interface PlegmaThemeStory { id: number, name: string, n: number, media: number, outlets: PlegmaThemeOutlet[] }

export interface PlegmaThemeWeb {
  stories: PlegmaThemeStory[]
  // The nodes on the unit disc: node 0 is the theme, then one for each story (in their order), then the outlets of each story.
  n: number
  x: Float32Array
  y: Float32Array
  // The story of a node (its place in `stories`; -1 for the theme), and its outlet in that story (-1 for the theme and the stories).
  story: Int16Array
  outlet: Int16Array
  // How large a node is, 0 to 1 among the nodes of its kind.
  size: Float32Array
  phase: Float32Array
  speed: Float32Array
  reach: Float32Array
  // The lines, as pairs of nodes (the later node first), and how far each bows to the side, as a share of its length.
  edges: Uint32Array
  bow: Float32Array
  // The distance between two outlet nodes of a story.
  gap: number
}

// The stories of a theme that its web shows, and the outlets of each: more is a crowd, not a picture.
export const PLEGMA_THEME_STORIES = 12
export const PLEGMA_THEME_OUTLETS = 8
const GAP = 0.085

export const buildThemeWeb = (stories: PlegmaThemeStory[], seed: number): PlegmaThemeWeb => {
  const rand = mulberry(seed * 29 + 11)
  const k = stories.length
  const total = 1 + k + stories.reduce((sum, s) => sum + s.outlets.length, 0)
  const x = new Float32Array(total)
  const y = new Float32Array(total)
  const story = new Int16Array(total).fill(-1)
  const outlet = new Int16Array(total).fill(-1)
  const size = new Float32Array(total)
  const phase = new Float32Array(total)
  const speed = new Float32Array(total)
  const reach = new Float32Array(total)
  const pairs: number[] = []
  const bows: number[] = []
  for (let i = 0; i < total; i++) {
    phase[i] = rand() * Math.PI * 2
    speed[i] = (0.25 + rand() * 0.6) * (rand() < 0.5 ? -1 : 1)
    reach[i] = 0.6 + rand() * 1.1
  }
  const most = Math.max(1, ...stories.map(s => s.n))
  const mostOutlet = Math.max(1, ...stories.flatMap(s => s.outlets.map(o => o.n)))
  // The stories go round the theme in an order that mixes large and small, each at a distance of its own: near and far by turns, and never quite the same.
  const turn = rand() * Math.PI * 2
  const order = stories.map((_, i) => i).sort((a, b) => ((a * 7) % k) - ((b * 7) % k) || a - b)
  const reachOf = (s: PlegmaThemeStory) => GAP * (0.9 + 0.55 * Math.sqrt(s.outlets.length))
  order.forEach((i, place) => {
    const a = turn + ((place + (rand() - 0.5) * 0.5) / Math.max(1, k)) * Math.PI * 2
    const r = (place % 2 ? 0.72 : 0.4) + (rand() - 0.5) * 0.12
    x[1 + i] = Math.cos(a) * r
    y[1 + i] = Math.sin(a) * r
  })
  // The stories push each other apart until their webs have room, and stay inside the disc.
  for (let pass = 0; pass < 80; pass++) {
    for (let i = 0; i < k; i++) {
      for (let j = 0; j < i; j++) {
        const dx = x[1 + i]! - x[1 + j]!
        const dy = y[1 + i]! - y[1 + j]!
        const d = Math.hypot(dx, dy) || 0.001
        const want = reachOf(stories[i]!) + reachOf(stories[j]!) + GAP * 0.6
        if (d >= want) continue
        const move = (want - d) / 2 * 0.5
        x[1 + i]! += (dx / d) * move; y[1 + i]! += (dy / d) * move
        x[1 + j]! -= (dx / d) * move; y[1 + j]! -= (dy / d) * move
      }
    }
    for (let i = 0; i < k; i++) {
      const d = Math.hypot(x[1 + i]!, y[1 + i]!) || 0.001
      const lim = Math.min(1 - reachOf(stories[i]!), Math.max(0.3, d))
      x[1 + i] = (x[1 + i]! / d) * lim
      y[1 + i] = (y[1 + i]! / d) * lim
    }
  }
  let node = 1 + k
  stories.forEach((s, i) => {
    story[1 + i] = i
    size[1 + i] = Math.sqrt(s.n / most)
    pairs.push(1 + i, 0)
    bows.push((rand() - 0.5) * 0.5)
    // The outlets of the story: each at the best of a few random spots around it (the farthest from the ones placed), joined to the nearest node placed before it.
    const placed = [1 + i]
    const far = reachOf(s)
    s.outlets.forEach((o, j) => {
      let bx = 0
      let by = 0
      let best = -1
      for (let c = 0; c < 12; c++) {
        const a = rand() * Math.PI * 2
        const r = far * (0.45 + 0.55 * Math.sqrt(rand()))
        const px = x[1 + i]! + Math.cos(a) * r
        const py = y[1 + i]! + Math.sin(a) * r
        const room = Math.min(...placed.map(q => Math.hypot(x[q]! - px, y[q]! - py)))
        if (room > best) { best = room; bx = px; by = py }
      }
      x[node] = bx
      y[node] = by
      story[node] = i
      outlet[node] = j
      size[node] = Math.sqrt(o.n / mostOutlet)
      let near = placed[0]!
      for (const q of placed) if (Math.hypot(x[q]! - bx, y[q]! - by) < Math.hypot(x[near]! - bx, y[near]! - by)) near = q
      pairs.push(node, near)
      bows.push((rand() - 0.5) * 0.6)
      placed.push(node)
      node++
    })
  })
  return { stories, n: total, x, y, story, outlet, size, phase, speed, reach, edges: Uint32Array.from(pairs), bow: Float32Array.from(bows), gap: GAP }
}
