import { mulberry } from './plegma-world.ts'

// The web of the picked story: one node for each article. The fixtures hold the articles of a story as counts for each day (stories.json) and for each outlet on
// each day (storyDetail.json), so a node knows its day and, once the detail is read, its outlet and group; it has no headline of its own.
// The nodes lie on a sunflower disc in the order of their days, so the first article is at the center and the story grows outward day by day; each node is joined to the
// nearest one before it (a growth tree), and some to a second. The disc has a radius of 1: the stage scales it.

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
}

const GOLDEN = Math.PI * (3 - Math.sqrt(5))

export const buildArticleWeb = (n: number, seed: number): PlegmaArticleWeb => {
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
  return { n, x, y, phase, speed, reach, edges: Uint32Array.from(pairs), bow: Float32Array.from(bows), gap }
}

const cache = new Map<string, PlegmaArticleWeb>()
export const articleWebOf = (id: number, n: number) => {
  const k = `${id}:${n}`
  let web = cache.get(k)
  if (!web) { web = buildArticleWeb(n, id); cache.set(k, web) }
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
export interface PlegmaArticle { day: number, outlet: string, group: string | null, slot: number }
