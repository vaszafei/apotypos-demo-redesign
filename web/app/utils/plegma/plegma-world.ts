import type { Story, StoryIssue } from '~/types/stories'
import type { HomeIndex } from '../home.ts'
import { bestOfWeek } from '../home.ts'

// What the Plegma draws: one place for every story (data/plegma.json, made by scripts/build-plegma-layout.mjs), its web, its theme colour and the arcs of its theme.
// The web code is that of assets/hero-field.js, seeded by the story id so a story looks the same on every page.

export interface PlegmaFile { epoch: string, dx: number, world: { x0: number, x1: number, y0: number, y1: number }, places: number[] }
export interface PlegmaStoriesFile { dates: string[], issues: StoryIssue[], stories: Story[], volumeFrom: string }
export interface PlegmaHomeFile { issues: StoryIssue[], issueDaily: (number | null)[][] }

export interface PlegmaStory {
  id: number
  el: string
  en?: string
  issue: number
  outlets: number
  days: number[]
  // The articles of the story, its first and its last day (indexes of the dates).
  n: number
  d0: number
  d1: number
  // The place on the Plegma.
  x: number
  y: number
  // The story has a theme of its own (not the catch-all, and it ends before the days without coded themes).
  coded: boolean
  // The slot of the theme colour, 1 to 8 as `--cat-N`, or 0 for ink.
  slot: number
}
export interface PlegmaArc { a: PlegmaStory, b: PlegmaStory, sign: 1 | -1 }
export interface PlegmaWeb { k: number, r: number, offs: { x: number, y: number }[], edges: [number, number][] }
export interface PlegmaWorld {
  stories: PlegmaStory[]
  byId: Map<number, PlegmaStory>
  byIssue: Map<number, PlegmaStory[]>
  issues: StoryIssue[]
  dates: string[]
  // The index of the first day without a coded theme.
  volumeIdx: number
  bounds: PlegmaFile['world']
  slotOf: Map<number, number>
  webs: Map<string, PlegmaWeb>
  chains: Map<number, PlegmaArc[]>
}

// A story of fewer articles than this is a loose dot, unless it is picked or compared.
export const PLEGMA_WEB_MIN = 20
// The article count that gives a full web of 32 dots; fewer articles give fewer dots on a square-root scale, from 6.
export const PLEGMA_FULL = 600
export const PLEGMA_DOTS_MIN = 6
export const PLEGMA_DOTS_MAX = 32
// Below this zoom a story of fewer articles than this is not drawn at all unless it is lit.
export const PLEGMA_FAR_MIN = 12
// A picked or compared story always has at least this many dots.
export const PLEGMA_FOCUS_DOTS = 8
// A theme joins its largest stories by arcs, and a theme view frames them.
export const PLEGMA_THEME_ARCS = 25
// The themes with a colour, as in the donut of Θέματα.
export const PLEGMA_SLOTS = 8

const TAU = Math.PI * 2

export const mulberry = (seed: number) => () => {
  seed = (seed + 0x6D2B79F5) | 0
  let x = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x
  return ((x ^ (x >>> 14)) >>> 0) / 4294967296
}

export const dotsOf = (articles: number) =>
  PLEGMA_DOTS_MIN + Math.round((PLEGMA_DOTS_MAX - PLEGMA_DOTS_MIN) * Math.sqrt(Math.min(articles, PLEGMA_FULL) / PLEGMA_FULL))
export const radiusOf = (dots: number) => 14 + 4.2 * Math.sqrt(dots)

// The shape of a story: its dots spread over a disc (each at the best of 14 spots, the farthest from the dots placed), the one nearest the center first.
// Each dot is joined to its nearest placed dot, and some to the second nearest.
export const webShape = (count: number, r: number, rand: () => number) => {
  const offs: { x: number, y: number, gap: number }[] = []
  for (let j = 0; j < count; j++) {
    let best: { x: number, y: number, gap: number } | null = null
    for (let k = 0; k < 14; k++) {
      const a = rand() * TAU
      const rr = r * Math.sqrt(rand())
      const x = Math.cos(a) * rr
      const y = Math.sin(a) * rr * 0.85
      const gap = offs.length ? Math.min(...offs.map(q => Math.hypot(q.x - x, q.y - y))) : 99
      if (!best || gap > best.gap) best = { x, y, gap }
    }
    offs.push(best!)
  }
  offs.sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y))
  const edges: [number, number][] = []
  for (let i = 1; i < offs.length; i++) {
    const near = offs.slice(0, i).map((q, j) => ({ j, d: Math.hypot(q.x - offs[i]!.x, q.y - offs[i]!.y) })).sort((a, b) => a.d - b.d)
    edges.push([i, near[0]!.j])
    if (near[1] && near[1].d < near[0]!.d * 1.7 && rand() < 0.45) edges.push([i, near[1].j])
  }
  return { offs: offs.map(({ x, y }) => ({ x, y })), edges }
}

// The web of a story, the same on every call. `minDots` lifts a small story to a readable web when it is picked or compared.
export const webOf = (world: PlegmaWorld, s: PlegmaStory, minDots = 0): PlegmaWeb => {
  const k = Math.max(dotsOf(s.n), minDots)
  const key = `${s.id}:${k}`
  let web = world.webs.get(key)
  if (!web) {
    const r = radiusOf(k)
    web = { k, r, ...webShape(k, r, mulberry(s.id * 31 + 7)) }
    world.webs.set(key, web)
  }
  return web
}

// The color slot of each theme: the eight largest themes of the whole window that are not the catch-all, in the order of the donut of Θέματα.
export const themeSlots = (home: PlegmaHomeFile) => {
  const rows = home.issues.map((issue, k) => ({ issue, k, n: (home.issueDaily[k] ?? []).reduce<number>((total, v) => total + (v ?? 0), 0) }))
    .filter(r => !r.issue.catchAll && r.n > 0).sort((a, b) => b.n - a.n).slice(0, PLEGMA_SLOTS)
  return new Map(rows.map((r, i) => [r.k, i + 1] as [number, number]))
}

// The world from the fixtures. A story with no place (a generic story) is left out.
export const buildWorld = (stories: PlegmaStoriesFile, home: PlegmaHomeFile, file: PlegmaFile): PlegmaWorld => {
  const place = new Map<number, [number, number]>()
  for (let i = 0; i < file.places.length; i += 3) place.set(file.places[i]!, [file.places[i + 1]!, file.places[i + 2]!])
  const volumeIdx = stories.dates.indexOf(stories.volumeFrom)
  const slotOf = themeSlots(home)
  const list: PlegmaStory[] = []
  for (const s of stories.stories) {
    const at = place.get(s.id)
    if (s.generic || !at || !s.days.length) continue
    let n = 0
    for (let j = 1; j < s.days.length; j += 2) n += s.days[j]!
    const coded = !stories.issues[s.issue]!.catchAll && (volumeIdx < 0 || s.days[0]! < volumeIdx)
    list.push({ id: s.id, el: s.el, en: s.en, issue: s.issue, outlets: s.outlets, days: s.days, n, d0: s.days[0]!, d1: s.days[s.days.length - 2]!, x: at[0], y: at[1], coded, slot: coded ? slotOf.get(s.issue) ?? 0 : 0 })
  }
  const byIssue = new Map<number, PlegmaStory[]>()
  for (const s of list) byIssue.set(s.issue, [...(byIssue.get(s.issue) ?? []), s])
  return { stories: list, byId: new Map(list.map(s => [s.id, s])), byIssue, issues: stories.issues, dates: stories.dates, volumeIdx, bounds: file.world, slotOf, webs: new Map(), chains: new Map() }
}

// The stories of a theme.
export const themeStories = (world: PlegmaWorld, issue: number) => world.byIssue.get(issue) ?? []

// The largest stories of a theme, in order of their first day: the ones that carry its arcs. The catch-all has none, and neither has a story with no coded theme.
export const themeCore = (world: PlegmaWorld, issue: number, count = PLEGMA_THEME_ARCS) =>
  themeStories(world, issue).filter(s => s.coded).sort((a, b) => b.n - a.n || a.id - b.id).slice(0, count).sort((a, b) => a.d0 - b.d0 || a.id - b.id)

// The dashed arcs of a theme: its core stories chained in order of their first day, bowing to alternate sides.
export const arcsOf = (world: PlegmaWorld, issue: number): PlegmaArc[] => {
  let arcs = world.chains.get(issue)
  if (!arcs) {
    const core = world.issues[issue]?.catchAll ? [] : themeCore(world, issue)
    arcs = core.slice(1).map((b, i) => ({ a: core[i]!, b, sign: i % 2 ? -1 : 1 } as PlegmaArc))
    world.chains.set(issue, arcs)
  }
  return arcs
}

// The stories a theme view frames and shows as webs: the largest of the theme, coded or not (the catch-all has no core, so it frames its largest).
export const themeFrameSet = (world: PlegmaWorld, issue: number, count = PLEGMA_THEME_ARCS) =>
  themeStories(world, issue).slice().sort((a, b) => b.n - a.n || a.id - b.id).slice(0, count)

// The stories of the best of the latest week, with their places. A story that began long before the week sits far from the others on the time axis and would
// pull the framing out to a zoom where no web can be read, so the webs are the best stories that began in the week (or all of the best, if fewer than three did).
export const homeWebs = (world: PlegmaWorld, ix: HomeIndex, count = 9, lastDay = ix.dates.length - 1) => {
  const last = Math.min(Math.max(0, lastDay), ix.dates.length - 1)
  const first = Math.max(0, last - 6)
  const best = bestOfWeek(ix, 80, lastDay).map(s => world.byId.get(s.id)).filter((s): s is PlegmaStory => !!s)
  const fresh = best.filter(s => s.d0 >= first)
  return (fresh.length >= 3 ? fresh : best).slice(0, count)
}

// How a story is drawn at a zoom: 0 a soft dot, 1 a web of dots without lines, 2 a web with its lines.
// Far away only the strong stories (picked, compared, of the theme, on Home) are webs; nearer the larger ones; nearest every story of 20 articles or more.
export const drawLevel = (s: PlegmaStory, z: number, strong: boolean, focus: boolean): 0 | 1 | 2 => {
  const asWeb = focus || (z >= 1.2 ? s.n >= PLEGMA_WEB_MIN : z >= 0.3 ? s.n >= 120 || strong : strong)
  if (!asWeb || z < 0.22) return 0
  return z >= 0.7 ? 2 : 1
}
