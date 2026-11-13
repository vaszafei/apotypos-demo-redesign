import { mulberry } from './plegma-world.ts'

// The web of a day on Home («Η επικαιρότητα»): the date is the center, the themes of the day lie around it, each theme has its largest stories, and each story is a small loose
// web of dots, one for each article (a dot stands for several in a large story). It is the web of a theme (utils/plegma-theme.ts) one level up, and it is not a chart: the places are
// loose on purpose, the numbers are in the card and the tooltips. The stories of the day that the web does not show are faint dots near their theme.

export interface PlegmaDayStory { id: number, name: string, n: number, media: number, dots: number[] }
export interface PlegmaDayTheme { issue: number, name: string, slot: number, n: number, stories: PlegmaDayStory[], rest: number }

// The most stories of a day the web shows, themes, and dots of a story.
export const PLEGMA_DAY_STORIES = 14
export const PLEGMA_DAY_THEMES = 7
export const PLEGMA_DAY_DOTS = 12
// The most faint dots a theme has for the stories that are not shown.
const REST_MAX = 14

// kind of a node: the date, a theme, a story, an article of a story, a story that is not shown.
export const DAY_DATE = 0
export const DAY_THEME = 1
export const DAY_STORY = 2
export const DAY_DOT = 3
export const DAY_REST = 4

export interface PlegmaDayWeb {
  n: number
  // The places in a box of 2 x `aspect` wide and 2 high, the date at 0,0.
  x: Float32Array
  y: Float32Array
  kind: Uint8Array
  // The theme (its place in the list) of a node, the story (its place in the theme's list) and the dot (its place in the story's dots); -1 where it does not apply.
  theme: Int16Array
  story: Int16Array
  dot: Int16Array
  // How large a node is, 0 to 1 among the nodes of its kind; a dot's is the root of the articles it stands for, against the most of any dot of the day.
  size: Float32Array
  phase: Float32Array
  speed: Float32Array
  reach: Float32Array
  // The lines, as pairs of a node and the node it hangs from, and how far each bows to the side, as a share of its length.
  edges: Uint32Array
  bow: Float32Array
}

// The dots of a story: one for each article up to the cap, then one for several, each in the group slot of an outlet that wrote it (proportional to the articles of the outlets).
// `counts` is the articles of each group slot, the largest first; with none (the data is not there yet) the dots have slot 0.
export const dayDots = (n: number, counts: { slot: number, n: number }[]): number[] => {
  const k = Math.max(1, Math.min(PLEGMA_DAY_DOTS, Math.round(n)))
  const total = counts.reduce((s, c) => s + c.n, 0)
  if (!total) return new Array<number>(k).fill(0)
  const out: number[] = []
  let carry = 0
  for (const c of counts) {
    carry += (c.n / total) * k
    while (out.length < Math.floor(carry + 1e-9)) out.push(c.slot)
  }
  while (out.length < k) out.push(counts[0]!.slot)
  return out.slice(0, k)
}

// `spread`: many themes (a period on the pages of Μέσα) go round by the golden angle, the largest nearest the center and the smallest out by the ring, so the large ones do not
// crowd one side.
export const buildDayWeb = (themes: PlegmaDayTheme[], aspect: number, seed: number, spread = false): PlegmaDayWeb => {
  const rand = mulberry(seed * 37 + 5)
  const T = themes.length
  const stories = themes.flatMap((t, ti) => t.stories.map((s, si) => ({ s, ti, si })))
  const restOf = themes.map(t => Math.min(REST_MAX, t.rest))
  const total = 1 + T + stories.length + stories.reduce((sum, r) => sum + r.s.dots.length, 0) + restOf.reduce((a, b) => a + b, 0)
  const x = new Float32Array(total)
  const y = new Float32Array(total)
  const kind = new Uint8Array(total)
  const theme = new Int16Array(total).fill(-1)
  const story = new Int16Array(total).fill(-1)
  const dot = new Int16Array(total).fill(-1)
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
  // The themes go round the date at uneven distances, the largest first; the stories of a theme lie out from it, away from the date.
  const turn = rand() * Math.PI * 2
  const mostTheme = Math.max(1, ...themes.map(t => t.n))
  const themeAt = (ti: number) => 1 + ti
  themes.forEach((t, ti) => {
    const a = spread ? turn + ti * 2.39996 + (rand() - 0.5) * 0.3 : turn + ((ti + (rand() - 0.5) * 0.45) / Math.max(1, T)) * Math.PI * 2
    // A day with one theme (the days with no coded themes have only the catch-all) has it near the date, and its stories spread over the whole box.
    const r = T === 1 ? 0.12 : spread ? 0.62 + 0.5 * (ti / Math.max(1, T - 1)) ** 0.7 + (rand() - 0.5) * 0.1 : (ti % 2 ? 0.82 : 0.5) + (rand() - 0.5) * 0.14
    x[themeAt(ti)] = Math.cos(a) * r * aspect * 0.8
    y[themeAt(ti)] = Math.sin(a) * r * 0.82
    kind[themeAt(ti)] = DAY_THEME
    theme[themeAt(ti)] = ti
    size[themeAt(ti)] = Math.sqrt(t.n / mostTheme)
    pairs.push(themeAt(ti), 0)
    bows.push((rand() - 0.5) * 0.5)
  })
  const mostStory = Math.max(1, ...stories.map(r => r.s.n))
  const storyAt = (k: number) => 1 + T + k
  const reachOf = (dots: number) => 0.075 + 0.028 * Math.sqrt(dots)
  stories.forEach((r, k) => {
    const t = themeAt(r.ti)
    const away = Math.atan2(y[t]!, x[t]! / aspect)
    const a = T === 1 ? turn + (k / Math.max(1, stories.length)) * Math.PI * 2 + (rand() - 0.5) * 0.5 : away + (rand() - 0.5) * 2.6
    const d = T === 1 ? 0.35 + rand() * 0.45 : 0.17 + rand() * 0.15
    x[storyAt(k)] = x[t]! + Math.cos(a) * d * (T === 1 ? aspect * 0.6 : 1.2)
    y[storyAt(k)] = y[t]! + Math.sin(a) * d
    kind[storyAt(k)] = DAY_STORY
    theme[storyAt(k)] = r.ti
    story[storyAt(k)] = r.si
    size[storyAt(k)] = Math.sqrt(r.s.n / mostStory)
    pairs.push(storyAt(k), t)
    bows.push((rand() - 0.5) * 0.5)
  })
  // The stories push each other (and the themes of the other stories) apart until their webs have room, and stay inside the box.
  const inside = (px: number, py: number, margin: number) => {
    const ex = aspect - margin
    const ey = 1 - margin
    const q = Math.hypot(px / ex, py / ey)
    return q > 1 ? [px / q, py / q] as const : [px, py] as const
  }
  for (let pass = 0; pass < 120; pass++) {
    for (let i = 0; i < stories.length; i++) {
      for (let j = 0; j < i; j++) {
        const a = storyAt(i)
        const b = storyAt(j)
        const dx = x[a]! - x[b]!
        const dy = y[a]! - y[b]!
        const d = Math.hypot(dx, dy) || 0.001
        const want = reachOf(stories[i]!.s.dots.length) + reachOf(stories[j]!.s.dots.length) + 0.04
        if (d >= want) continue
        const move = (want - d) / 2 * 0.5
        x[a]! += (dx / d) * move; y[a]! += (dy / d) * move
        x[b]! -= (dx / d) * move; y[b]! -= (dy / d) * move
      }
      for (let ti = 0; ti < T; ti++) {
        const a = storyAt(i)
        const t = themeAt(ti)
        const dx = x[a]! - x[t]!
        const dy = y[a]! - y[t]!
        const d = Math.hypot(dx, dy) || 0.001
        const want = reachOf(stories[i]!.s.dots.length) + 0.05
        if (d >= want) continue
        const move = (want - d) * (ti === stories[i]!.ti ? 0.4 : 0.15)
        x[a]! += (dx / d) * move; y[a]! += (dy / d) * move
      }
      const [px, py] = inside(x[storyAt(i)]!, y[storyAt(i)]!, reachOf(stories[i]!.s.dots.length) + 0.02)
      x[storyAt(i)] = px
      y[storyAt(i)] = py
    }
  }
  // The dots of each story: each at the best of a few random spots around it (the farthest from the ones placed), joined to the nearest node placed before it.
  let node = 1 + T + stories.length
  // A dot is as large as the articles it stands for: one in a small story, many in a large one, the same scale on every story of the day.
  const mostPer = Math.max(1, ...stories.map(r => r.s.n / Math.max(1, r.s.dots.length)))
  stories.forEach((r, k) => {
    const per = r.s.n / Math.max(1, r.s.dots.length)
    const placed = [storyAt(k)]
    const far = reachOf(r.s.dots.length)
    r.s.dots.forEach((_, j) => {
      let bx = 0
      let by = 0
      let best = -1
      for (let c = 0; c < 12; c++) {
        const a = rand() * Math.PI * 2
        const rr = far * (0.45 + 0.55 * Math.sqrt(rand()))
        const px = x[storyAt(k)]! + Math.cos(a) * rr
        const py = y[storyAt(k)]! + Math.sin(a) * rr
        const room = Math.min(...placed.map(q => Math.hypot(x[q]! - px, y[q]! - py)))
        if (room > best) { best = room; bx = px; by = py }
      }
      x[node] = bx
      y[node] = by
      kind[node] = DAY_DOT
      theme[node] = r.ti
      story[node] = r.si
      dot[node] = j
      size[node] = Math.sqrt(per / mostPer)
      let near = placed[0]!
      for (const q of placed) if (Math.hypot(x[q]! - bx, y[q]! - by) < Math.hypot(x[near]! - bx, y[near]! - by)) near = q
      pairs.push(node, near)
      bows.push((rand() - 0.5) * 0.6)
      placed.push(node)
      node++
    })
  })
  // The stories that are not shown: faint dots near their theme, with no lines.
  themes.forEach((t, ti) => {
    for (let j = 0; j < restOf[ti]!; j++) {
      const a = rand() * Math.PI * 2
      const rr = 0.1 + rand() * 0.3
      const [px, py] = inside(x[themeAt(ti)]! + Math.cos(a) * rr * 1.3, y[themeAt(ti)]! + Math.sin(a) * rr, 0.02)
      x[node] = px
      y[node] = py
      kind[node] = DAY_REST
      theme[node] = ti
      size[node] = 0.4 + rand() * 0.6
      node++
    }
  })
  return { n: total, x, y, kind, theme, story, dot, size, phase, speed, reach, edges: Uint32Array.from(pairs), bow: Float32Array.from(bows) }
}

// The web of the stories of the day, with no themes between: each story is its own "theme" of one story, so buildDayWeb lays the stories out around the date by themselves.
// The nodes of the two webs are matched by `matchWebs`, which is how the web of the themes turns into the web of the stories (and back) without a jump.
export const storiesAsThemes = (themes: PlegmaDayTheme[]): PlegmaDayTheme[] => themes
  .flatMap(t => t.stories.map(s => ({ issue: t.issue, name: s.name, slot: t.slot, n: s.n, stories: [s], rest: 0 })))
  .sort((a, b) => b.n - a.n)

// For each node of `a`, the node of `b` that is the same story or the same dot of a story, or -1 (the themes and the faint dots have none).
export const matchWebs = (aThemes: PlegmaDayTheme[], a: PlegmaDayWeb, bThemes: PlegmaDayTheme[], b: PlegmaDayWeb): Int32Array => {
  const key = (themes: PlegmaDayTheme[], w: PlegmaDayWeb, i: number) => {
    const s = themes[w.theme[i]!]?.stories[w.story[i]!]
    return s ? `${s.id}:${w.kind[i]}:${w.dot[i]}` : null
  }
  const at = new Map<string, number>()
  for (let j = 1; j < b.n; j++) {
    if (b.kind[j] !== DAY_STORY && b.kind[j] !== DAY_DOT) continue
    at.set(key(bThemes, b, j)!, j)
  }
  const out = new Int32Array(a.n).fill(-1)
  out[0] = 0
  for (let i = 1; i < a.n; i++) {
    if (a.kind[i] !== DAY_STORY && a.kind[i] !== DAY_DOT) continue
    out[i] = at.get(key(aThemes, a, i)!) ?? -1
  }
  return out
}
