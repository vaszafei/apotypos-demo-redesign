<script setup lang="ts">
import { useEventListener, useMediaQuery } from '@vueuse/core'
import type { PlegmaPoint } from '~/utils/plegma-camera'
import { cameraAt, fitCamera, flightDone, frameHome, framePair, frameStory, frameTheme, PLEGMA_REGION, PLEGMA_STRIP, PLEGMA_Z_THEME, redirectFlight, regionBox, toScreen } from '~/utils/plegma-camera'
import type { PlegmaCamera, PlegmaFlight } from '~/utils/plegma-camera'
import { arcsOf, buildWorld, drawLevel, homeWebs, PLEGMA_FAR_MIN, PLEGMA_FOCUS_DOTS, PLEGMA_WEB_MIN, themeCore, themeFrameSet, webOf } from '~/utils/plegma-world'
import { articleOfNode, articleRadius, articlesPerNode, articleWebOf, matchesHighlight, nodeCount } from '~/utils/plegma-articles'
import type { PlegmaHighlight } from '~/utils/plegma-articles'
import { buildThemeWeb } from '~/utils/plegma-theme'
import type { PlegmaThemeWeb } from '~/utils/plegma-theme'
import type { PlegmaFile, PlegmaHomeFile, PlegmaStoriesFile, PlegmaStory, PlegmaWorld } from '~/utils/plegma-world'
import { homeIndex, HOME_WEBS, HOME_WEBS_PHONE } from '~/utils/home'

// The Plegma: one canvas behind the pages, in the layout, so it outlives a page change and a flight can end on another page (KTD1). It draws every story of the
// fixtures at its permanent place (plegma.json), with the look of the home hero: a web for a story, a dot for the rest, dashed arcs along a theme. The route says what
// is in focus (stores/plegma.ts); when it changes the camera flies there (utils/plegma-camera.ts). On a route without the plegma page meta the stage is hidden and stops.
const TAU = Math.PI * 2
const plegma = usePlegmaStore()
const prefs = usePrefsStore()
const tooltip = useTooltipStore()
const { t, locale } = useI18n()
const reduced = useMediaQuery('(prefers-reduced-motion: reduce)')
const pointerFine = useMediaQuery('(hover: hover) and (pointer: fine)')
const phone = useMediaQuery('(max-width: 759px)')
const canvas = ref<HTMLCanvasElement>()
const canvasFocus = ref<HTMLCanvasElement>()

const stories = useFixtureLazy<PlegmaStoriesFile>('stories', { required: ['dates', 'issues', 'stories'] })
const home = useFixtureLazy<PlegmaHomeFile>('home', { required: ['issues', 'issueDaily'] })
const file = useFixtureLazy<PlegmaFile>('plegma', { required: ['places', 'world'] })

let world: PlegmaWorld | null = null
let byX: PlegmaStory[] = []
let ctx: CanvasRenderingContext2D | null = null
let ctxFocus: CanvasRenderingContext2D | null = null
let width = 0
let height = 0
let dpr = 1
let raf = 0
let flight: PlegmaFlight | null = null
let hover: PlegmaStory | null = null
let webs: PlegmaStory[] = []
let ink = '#111'
// The color of a story with no theme and of a node with no group: a soft gray, not the ink, so the map is not black.
let mute = '#6b6f78'
// The color of the page: the rim of a node.
let paper = '#f6f4ef'
let cats: string[] = []
let groupInk: string[] = []
// The colors of the nodes at rest: the group colors mixed with the gray of no group, so the web is a family of colors, not confetti. A group that is
// pointed at gets its full color.
let softInk: string[] = []
let fontText = 'system-ui, sans-serif'
// The place across the world of each day of the dates (a story is placed on its first day), the width of a day, and the last day that has coded themes.
let dayX: number[] = []
let dayW = 60
let codedLast = 0
// The most stories of a theme view that have their name beside the web.
const THEME_LABELS = 6
let hoverDay = -1
const cam: PlegmaCamera = { x: 0, y: 0, z: 0.5 }

const EMPTY = new Set<PlegmaStory>()
// The most lines from a picked story to other stories.
const SPOKES_MAX = 6
const cores = new Map<number, Set<PlegmaStory>>()
const coreOf = (issue: number) => {
  let set = cores.get(issue)
  if (!set) { set = new Set(themeFrameSet(world!, issue)); cores.set(issue, set) }
  return set
}
const spokes = new Map<number, Set<PlegmaStory>>()
// The stories a coded story is joined to: the largest of its theme.
const spokeSet = (issue: number) => {
  let set = spokes.get(issue)
  if (!set) { set = new Set(themeCore(world!, issue)); spokes.set(issue, set) }
  return set
}
const name = (s: PlegmaStory) => (locale.value === 'en' && s.en) || s.el
const colourOf = (s: PlegmaStory) => (s.slot > 0 ? cats[s.slot - 1] ?? mute : mute)
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))
// The color (#rrggbb) mixed with another, `share` of the other: the group colors mixed with one gray are one calm family.
const mixHex = (hex: string, other: string, share: number) => {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex)
  const o = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(other)
  if (!m || !o) return hex
  return `#${[1, 2, 3].map(i => Math.round(parseInt(m[i]!, 16) * (1 - share) + parseInt(o[i]!, 16) * share).toString(16).padStart(2, '0')).join('')}`
}
// A color of the tokens (#rrggbb) with an alpha, for a gradient.
const withAlpha = (hex: string, alpha: number) => (/^#[0-9a-f]{6}$/i.test(hex) ? `${hex}${Math.round(alpha * 255).toString(16).padStart(2, '0')}` : hex)

// On Home the map is alive: every story drifts slowly on its own path, and the dots of a web wander on slow waves, so the webs breathe (the static hero's motion).
// It is drawn only, a story keeps its place in the world; with reduced motion there is none.
const driftSpot = { x: 0, y: 0 }
const drift = (s: PlegmaStory, sec: number) => {
  driftSpot.x = Math.sin(sec * 0.13 + s.id * 0.7) * 14 + Math.sin(sec * 0.31 + s.id * 1.9) * 5
  driftSpot.y = Math.cos(sec * 0.11 + s.id * 1.1) * 11 + Math.cos(sec * 0.27 + s.id * 0.6) * 4
  return driftSpot
}

// A story or a theme in view keeps a clear space around its web: the other stories near it are pushed out a little (a place on the screen, not in the world),
// so the web does not sit in a crowd. Inside the radius R they are moved to between R and 1.4 R; outside it the push dies away.
const CLEAR_PAD = 30
const CLEAR_PUSH = 0.4
let push: { s: PlegmaStory, r: number } | null = null
const spot = { x: 0, y: 0 }
const placed = (s: PlegmaStory): PlegmaPoint => {
  if (!push || s === push.s) return s
  const dx = s.x - push.s.x
  const dy = s.y - push.s.y
  const d = Math.hypot(dx, dy)
  const r = push.r
  if (d >= r * 5 || d === 0) return s
  const moved = d < r ? r + (d / r) * r * CLEAR_PUSH : d + r * CLEAR_PUSH * Math.exp(-(d - r) / r)
  spot.x = push.s.x + (dx / d) * moved
  spot.y = push.s.y + (dy / d) * moved
  return spot
}

// The colors are tokens, read when the theme changes (they depend on it).
const readTokens = () => {
  const style = getComputedStyle(document.documentElement)
  ink = style.getPropertyValue('--ink').trim() || '#111'
  mute = style.getPropertyValue('--text-secondary').trim() || mute
  paper = style.getPropertyValue('--surface-page').trim() || paper
  fontText = style.getPropertyValue('--font-text').trim() || fontText
  cats = Array.from({ length: 8 }, (_, i) => style.getPropertyValue(`--cat-${i + 1}`).trim() || mute)
  groupInk = Array.from({ length: 10 }, (_, i) => style.getPropertyValue(`--cat-${i}`).trim() || mute)
  softInk = groupInk.map(c => mixHex(c, groupInk[0] ?? mute, 0.3))
}

const focusStory = () => (world && plegma.focus?.kind === 'story' ? world.byId.get(plegma.focus.id) ?? null : null)
const focusIssue = () => (plegma.focus?.kind === 'theme' ? plegma.focus.issue : null)

// The camera that shows the focus: Home's best webs, a story in the map region, or a theme's largest stories.
const targetCamera = (): PlegmaCamera | null => {
  if (!world || !width) return null
  const story = focusStory()
  if (story) {
    const other = plegma.compare !== null ? world.byId.get(plegma.compare) : null
    const region = plegma.region ?? undefined
    return other ? framePair(story, other, width, height, region).camera : frameStory(story, width, height, region)
  }
  const issue = focusIssue()
  if (issue !== null) {
    // A theme is framed on all its coded days across (the strip of the days under the map shares that axis), and on its largest stories up and down.
    const set = [...coreOf(issue)]
    if (!set.length || !dayX.length) return frameTheme(set, width, height, plegma.region ?? undefined)
    const ys = set.map(s => s.y)
    return fitCamera([...set, { x: dayX[0]!, y: Math.min(...ys) }, { x: dayX[codedLast]! + dayW, y: Math.max(...ys) }], regionBox(width, height, plegma.region ?? undefined), width, height, PLEGMA_Z_THEME, 0.9)
  }
  return webs.length ? frameHome(webs, width, height) : null
}

const fly = () => {
  const to = targetCamera()
  if (!to) return
  flight = redirectFlight(flight, cam, to, performance.now(), width, reduced.value)
  if (flight.dur <= 0) { Object.assign(cam, to); flight = null }
  plegma.setLanded(!flight)
  kick()
}

// ---- the picked story: one node for each article ----
// The web is the story's articles (utils/plegma-articles.ts). Its size on the screen is that of the free map region, so it is the same at any window; in the world it is
// a disc of `Rt / zt` where zt is the zoom of the framing, so it grows and shrinks with the camera in a flight. The nodes go round on small circles, each its own way.
const arts = { aw: null as ReturnType<typeof articleWebOf> | null, id: -1, cx: 0, cy: 0, R: 0, ring: 0, rWorld: 0, dr: 1, spacing: 0 }
// When the outlets of the story are read the web changes from the plain disc to the sectors of its groups: the nodes move there, they do not jump.
const MORPH_MS = 900
let morphFrom: ReturnType<typeof articleWebOf> | null = null
let morphAt = 0
let ax = new Float32Array(0)
let ay = new Float32Array(0)
let hoverArticle = -1
// What the cards point at (stores/plegma.ts): the articles of a group or an outlet come forward, a line to a story of the card of the other stories lights up. Each eases
// in and out, so the map answers the pointer instead of jumping; with reduced motion it jumps.
let hlMix = 0
let hlLast: PlegmaHighlight | null = null
let hlMatch = new Uint8Array(0)
let hlKey = ''
let lineMix = 0
let lineLast: number | null = null
let lastNow = 0
const ease = (value: number, target: number, dt: number) => (reduced.value ? target : value + (target - value) * (1 - Math.exp(-dt * 9)))
// The nodes whose articles are in the highlight: a node of a story of many articles stands for several, and comes forward if one of them does.
const matchNodes = (s: PlegmaStory, h: PlegmaHighlight, list: NonNullable<typeof plegma.articles>) => {
  const nodes = nodeCount(s.n)
  const key = `${s.id}|${h.group}|${h.outlet ?? ''}|${list.length}`
  if (key === hlKey) return hlMatch
  hlKey = key
  hlMatch = new Uint8Array(nodes)
  for (let i = 0; i < nodes; i++) {
    const from = Math.floor((i * s.n) / nodes)
    const to = Math.max(from + 1, Math.floor(((i + 1) * s.n) / nodes))
    for (let k = from; k < to; k++) if (matchesHighlight(list[k]!, h)) { hlMatch[i] = 1; break }
  }
  return hlMatch
}
// The group of each node, as its place among the groups of the story (the sectors of the web), once the articles are read.
let sectorKey = ''
let sectorList: Uint16Array | null = null
let sectorSlot: number[] = []
const sectorsOf = (s: PlegmaStory) => {
  const list = plegma.articles
  if (!list || list.length !== s.n) return null
  const key = `${s.id}:${list.length}`
  if (key !== sectorKey || !sectorList) {
    const nodes = nodeCount(s.n)
    sectorList = new Uint16Array(nodes)
    sectorSlot = []
    for (let i = 0; i < nodes; i++) {
      const article = list[articleOfNode(i, list.length)]!
      sectorList[i] = article.order
      sectorSlot[article.order] = article.slot
    }
    sectorKey = key
  }
  return sectorList
}
const articleWorldRadius = (s: PlegmaStory) => {
  const region = plegma.region ?? undefined
  const box = regionBox(width, height, region ?? PLEGMA_REGION)
  return articleRadius(s.n, Math.min(box.w, box.h) * 0.36) / frameStory(s, width, height, region).z
}
// The ring around the picked web, from its radius on the screen.
const ringOf = (R: number) => R * 1.2 + 6
const layoutArticles = (s: PlegmaStory, sec: number) => {
  const sectors = sectorsOf(s)
  const aw = articleWebOf(s.id, nodeCount(s.n), sectors ?? undefined)
  if (aw !== arts.aw) {
    morphFrom = arts.aw && arts.id === s.id && arts.aw.n === aw.n && !reduced.value ? arts.aw : null
    morphAt = performance.now()
  }
  let blend = 1
  if (morphFrom) {
    const k = (performance.now() - morphAt) / MORPH_MS
    if (k >= 1) morphFrom = null
    else blend = 1 - Math.pow(1 - k, 3)
  }
  const from = morphFrom
  const p = toScreen(cam, width, height, placed(s))
  const rWorld = articleWorldRadius(s)
  const R = rWorld * cam.z
  const spacing = aw.gap * R
  const amp = clamp(spacing * 0.2, 0.8, 3.2)
  if (ax.length < aw.n) { ax = new Float32Array(aw.n); ay = new Float32Array(aw.n) }
  for (let i = 0; i < aw.n; i++) {
    const a = sec * aw.speed[i]! + aw.phase[i]!
    const bx = from ? from.x[i]! + (aw.x[i]! - from.x[i]!) * blend : aw.x[i]!
    const by = from ? from.y[i]! + (aw.y[i]! - from.y[i]!) * blend : aw.y[i]!
    // The first article does not move: it is the center the others go round.
    const reach = i === 0 && aw.arcs.length ? 0 : aw.reach[i]!
    ax[i] = p.x + bx * R + Math.cos(a) * amp * reach
    ay[i] = p.y + by * R + Math.sin(a) * amp * reach
  }
  Object.assign(arts, { aw, id: s.id, cx: p.x, cy: p.y, R, ring: ringOf(R), rWorld, spacing, dr: clamp(spacing * 0.27, 1.2, 4.6) })
  return arts
}
const articleAt = (s: PlegmaStory, x: number, y: number) => {
  const a = layoutArticles(s, reduced.value ? 0 : performance.now() / 1000)
  let best = -1
  let bestD = a.dr + 5
  for (let i = 0; i < a.aw!.n; i++) {
    const d = Math.hypot(ax[i]! - x, ay[i]! - y)
    if (d < bestD) { bestD = d; best = i }
  }
  return best
}

// The picked web. Its nodes are solid and each has a rim of the page's color, so a line never muddies a node and two nodes that touch stay two; a node and the line
// to the article before it have the calm color of their group, and the ring is the groups' ring: an arc for each group over its sector. The articles of a group or an
// outlet that a card points at come forward in the full color, larger and pulsing, and the others step back.
const drawArticles = (g: CanvasRenderingContext2D, s: PlegmaStory, level: 1 | 2, sec: number) => {
  const a = layoutArticles(s, sec)
  const aw = a.aw!
  const col = colourOf(s)
  const articles = plegma.articles && plegma.articles.length === s.n ? plegma.articles : null
  const slotOf = (i: number) => (articles ? articles[articleOfNode(i, articles.length)]!.slot : -1)
  const inkOf = (slot: number) => (slot < 0 ? col : softInk[slot] ?? mute)
  const mix = hlMix
  const lit = articles && hlLast && mix > 0.01 ? matchNodes(s, hlLast, articles) : null
  const rOf = (i: number) => (i === 0 ? a.dr * 1.7 : a.dr)
  if (level === 2) {
    const lines = new Map<number, Path2D>()
    for (let e = 0; e < aw.bow.length; e++) {
      const i = aw.edges[e * 2]!
      const j = aw.edges[e * 2 + 1]!
      const slot = slotOf(i)
      let path = lines.get(slot)
      if (!path) { path = new Path2D(); lines.set(slot, path) }
      const dx = ax[j]! - ax[i]!
      const dy = ay[j]! - ay[i]!
      path.moveTo(ax[i]!, ay[i]!)
      path.quadraticCurveTo((ax[i]! + ax[j]!) / 2 - dy * aw.bow[e]!, (ay[i]! + ay[j]!) / 2 + dx * aw.bow[e]!, ax[j]!, ay[j]!)
    }
    g.lineWidth = a.spacing < 7 ? 0.7 : 1
    g.lineCap = 'round'
    for (const [slot, path] of lines) {
      g.strokeStyle = inkOf(slot)
      g.globalAlpha = (a.spacing < 7 ? 0.4 : 0.55) * (1 - 0.6 * mix)
      g.stroke(path)
    }
  }
  const rim = clamp(a.dr * 0.4, 0.8, 1.6)
  const rims = new Path2D()
  const fills = new Map<number, Path2D>()
  for (let i = 0; i < aw.n; i++) {
    if (lit && lit[i]) continue
    const r = rOf(i)
    rims.moveTo(ax[i]! + r + rim, ay[i]!)
    rims.arc(ax[i]!, ay[i]!, r + rim, 0, TAU)
    const slot = slotOf(i)
    let path = fills.get(slot)
    if (!path) { path = new Path2D(); fills.set(slot, path) }
    path.moveTo(ax[i]! + r, ay[i]!)
    path.arc(ax[i]!, ay[i]!, r, 0, TAU)
  }
  g.globalAlpha = 1
  g.fillStyle = paper
  g.fill(rims)
  for (const [slot, path] of fills) {
    g.fillStyle = inkOf(slot)
    g.globalAlpha = 1 - 0.68 * mix
    g.fill(path)
  }
  if (lit) {
    for (let i = 0; i < aw.n; i++) {
      if (!lit[i]) continue
      const slot = slotOf(i)
      const colour = slot > 0 ? groupInk[slot] ?? ink : mute
      const r = rOf(i) * (1 + 0.5 * mix + 0.12 * mix * Math.sin(sec * 5 + i * 0.9))
      g.fillStyle = colour
      g.globalAlpha = 0.18 * mix
      g.beginPath()
      g.arc(ax[i]!, ay[i]!, r * 2.1, 0, TAU)
      g.fill()
      g.globalAlpha = 1
      g.fillStyle = paper
      g.beginPath()
      g.arc(ax[i]!, ay[i]!, r + rim, 0, TAU)
      g.fill()
      g.fillStyle = colour
      g.beginPath()
      g.arc(ax[i]!, ay[i]!, r, 0, TAU)
      g.fill()
    }
  }
  // The first article: a thin circle around the center node.
  if (aw.arcs.length) {
    g.globalAlpha = 0.55 * (1 - 0.5 * mix)
    g.strokeStyle = ink
    g.lineWidth = 1
    g.beginPath()
    g.arc(ax[0]!, ay[0]!, rOf(0) + rim + 2.5, 0, TAU)
    g.stroke()
  }
  // The ring: a thin line with nothing inside it. With the groups known it is an arc for each group, over the sector of its articles.
  g.lineCap = 'round'
  if (aw.arcs.length && !morphFrom) {
    g.lineWidth = 2
    for (let k = 0; k < aw.arcs.length / 2; k++) {
      const span = aw.arcs[k * 2 + 1]!
      if (span <= 0) continue
      const slot = sectorSlot[k] ?? 0
      const on = !!hlLast && mix > 0.01 && articles?.find(x => x.order === k)?.group === hlLast.group
      const pad = Math.min(span / 2, 3 / a.ring)
      g.strokeStyle = on ? (slot > 0 ? groupInk[slot] ?? ink : mute) : softInk[slot] ?? mute
      g.globalAlpha = on ? 1 : 0.85 * (1 - 0.6 * mix)
      g.beginPath()
      g.arc(a.cx, a.cy, a.ring, aw.arcs[k * 2]! - Math.PI / 2 + pad, aw.arcs[k * 2]! + span - Math.PI / 2 - pad)
      g.stroke()
    }
  } else {
    g.globalAlpha = 0.45
    g.strokeStyle = articles ? mute : col
    g.lineWidth = 1.2
    g.beginPath()
    g.arc(a.cx, a.cy, a.ring, 0, TAU)
    g.stroke()
  }
  g.lineCap = 'butt'
  if (hoverArticle >= 0 && hoverArticle < aw.n) {
    g.globalAlpha = 0.85
    g.strokeStyle = ink
    g.lineWidth = 1.2
    g.beginPath()
    g.arc(ax[hoverArticle]!, ay[hoverArticle]!, rOf(hoverArticle) + rim + 2, 0, TAU)
    g.stroke()
  }
  g.globalAlpha = 1
}

// ---- drawing ----
const arcOf = (ctx2: CanvasRenderingContext2D, a: PlegmaStory, b: PlegmaStory, sign: number, sec = 0) => {
  const p = { ...toScreen(cam, width, height, placed(a)) }
  if (sec) { const d = drift(a, sec); p.x += d.x; p.y += d.y }
  const q = { ...toScreen(cam, width, height, placed(b)) }
  if (sec) { const d = drift(b, sec); q.x += d.x; q.y += d.y }
  const dx = q.x - p.x
  const dy = q.y - p.y
  ctx2.moveTo(p.x, p.y)
  ctx2.quadraticCurveTo((p.x + q.x) / 2 - dy * 0.22 * sign, (p.y + q.y) / 2 + dx * 0.22 * sign, q.x, q.y)
}

// ---- a theme in view ----
// The days of the theme under the map region: a bar for each day on the same axis as the map (a story is on the day it began), the dates under them.
const stripBox = () => {
  if (!plegma.region) return null
  const box = regionBox(width, height, plegma.region)
  return { x0: box.cx - box.w / 2, x1: box.cx + box.w / 2, top: box.cy + box.h / 2 + 12, base: box.cy + box.h / 2 + 12 + PLEGMA_STRIP }
}
const dayAt = (x: number) => {
  const wx = (x - width / 2) / cam.z + cam.x
  for (let d = 0; d < dayX.length; d++) if (wx >= dayX[d]! && wx < dayX[d]! + dayW) return d
  return -1
}
// The web of the theme (utils/plegma-theme.ts), in the middle of the map region: the theme at the center, its stories on the first circle, the outlets of each story
// around it in the sector of the story. It has the look of the web of a story: solid nodes with a rim of the page's color, the calm colors of the groups, a ring of arcs.
const themed = { key: '', web: null as PlegmaThemeWeb | null, index: new Map<number, number>() }
let hx = new Float32Array(0)
let hy = new Float32Array(0)
let hoverNode = -1
// What is pointed at: a story (in the card of the stories or on the web) or an outlet (on the web: it comes forward in every story that has it). It eases in and out.
let themeMix = 0
let themeLit: { story: number, outlet: string | null } = { story: -1, outlet: null }
const themeDisc = () => {
  if (!plegma.region) return null
  const box = regionBox(width, height, plegma.region)
  const r = Math.max(60, Math.min(box.h / 2 - 20, box.w / 2 - 120))
  return { x: box.cx, y: box.cy, r: r + 16, R: r }
}
const themeWebOf = (issue: number) => {
  const list = plegma.themeStories
  if (!list || !list.length) return null
  const key = `${issue}|${list.length}|${list[0]!.id}`
  if (themed.key !== key) Object.assign(themed, { key, web: buildThemeWeb(list, issue + 1), index: new Map(list.map((s, i) => [s.id, i])) })
  return themed.web
}
const themeNodeRadius = (web: PlegmaThemeWeb, i: number, unit: number) =>
  i === 0 ? 8 : web.outlet[i]! < 0 ? 4.2 + 3.2 * web.size[i]! : clamp(unit * (0.13 + 0.12 * web.size[i]!), 1.6, 5)
const layoutTheme = (web: PlegmaThemeWeb, sec: number) => {
  const disc = themeDisc()!
  if (hx.length < web.n) { hx = new Float32Array(web.n); hy = new Float32Array(web.n) }
  const unit = web.gap * disc.R
  const amp = clamp(unit * 0.3, 1.5, 6)
  for (let i = 0; i < web.n; i++) {
    const a = sec * web.speed[i]! + web.phase[i]!
    const k = i === 0 ? 0 : web.outlet[i]! < 0 ? 0.7 : web.reach[i]!
    hx[i] = disc.x + web.x[i]! * disc.R + Math.cos(a) * amp * k
    hy[i] = disc.y + web.y[i]! * disc.R + Math.sin(a) * amp * k
  }
  return { disc, unit }
}
const themeNodeAt = (issue: number, x: number, y: number) => {
  const web = themeWebOf(issue)
  if (!web || !plegma.region) return -1
  const { unit } = layoutTheme(web, reduced.value ? 0 : performance.now() / 1000)
  let best = -1
  let bestD = Infinity
  for (let i = 1; i < web.n; i++) {
    const d = Math.hypot(hx[i]! - x, hy[i]! - y) - themeNodeRadius(web, i, unit)
    if (d < 5 && d < bestD) { bestD = d; best = i }
  }
  return best
}
const drawTheme = (g: CanvasRenderingContext2D, issue: number, sec: number, dt: number) => {
  const slot = world!.slotOf.get(issue)
  const colour = slot ? cats[slot - 1] ?? mute : mute
  const strip = stripBox()
  const row = home.data.value?.issueDaily[issue]
  const web = themeWebOf(issue)
  g.font = `11px ${fontText}`
  g.textBaseline = 'alphabetic'
  // The story pointed at, in the card or on the web, has its days marked on the strip.
  const node = web && hoverNode > 0 && hoverNode < web.n ? hoverNode : -1
  const cardStory = plegma.hoverStory !== null ? themed.index.get(plegma.hoverStory) ?? -1 : -1
  const lit = node > 0 ? (web!.outlet[node]! >= 0 ? { story: -1, outlet: web!.stories[web!.story[node]!]!.outlets[web!.outlet[node]!]!.name } : { story: web!.story[node]!, outlet: null }) : cardStory >= 0 ? { story: cardStory, outlet: null } : null
  if (lit) themeLit = lit
  themeMix = ease(themeMix, lit ? 1 : 0, dt)
  const pointed = lit && lit.story >= 0 && web ? world!.byId.get(web.stories[lit.story]!.id) ?? null : null
  if (strip && row) {
    const w = dayW * cam.z
    const most = Math.max(1, ...row.map(v => v ?? 0))
    const bars = new Path2D()
    let peak = -1
    for (let d = 0; d < row.length && d < dayX.length; d++) {
      const v = row[d]
      if (v === null || v === undefined) continue
      const px = (dayX[d]! - cam.x) * cam.z + width / 2
      if (px < strip.x0 - 1 || px + w > strip.x1 + 1) continue
      const h = Math.max(1, (v / most) * PLEGMA_STRIP)
      bars.rect(px + 1, strip.base - h, Math.max(1, w - 2), h)
      if (peak < 0 || v > (row[peak] ?? 0)) peak = d
    }
    g.fillStyle = colour
    g.globalAlpha = 0.5
    g.fill(bars)
    const mark = (d: number, alpha: number) => {
      const v = row[d]
      if (v === null || v === undefined) return
      const px = (dayX[d]! - cam.x) * cam.z + width / 2
      const h = Math.max(1, (v / most) * PLEGMA_STRIP)
      g.globalAlpha = alpha
      g.fillStyle = colour
      g.fillRect(px + 1, strip.base - h, Math.max(1, w - 2), h)
    }
    if (hoverDay >= 0) mark(hoverDay, 1)
    if (pointed) for (let i = 0; i + 1 < pointed.days.length; i += 2) mark(pointed.days[i]!, 0.95)
    g.globalAlpha = 0.5
    g.strokeStyle = mute
    g.lineWidth = 1
    g.beginPath()
    g.moveTo(strip.x0, strip.base + 0.5)
    g.lineTo(strip.x1, strip.base + 0.5)
    g.stroke()
    g.fillStyle = mute
    g.globalAlpha = 0.95
    g.textAlign = 'left'
    for (let d = 0; d < dayX.length && d <= codedLast; d += 7) {
      const px = (dayX[d]! - cam.x) * cam.z + width / 2
      if (px < strip.x0 - 1 || px > strip.x1 - 30) continue
      g.fillText(fmtDay(world!.dates[d]!), px + 1, strip.base + 14)
    }
    if (peak >= 0 && hoverDay < 0) {
      const px = (dayX[peak]! - cam.x) * cam.z + width / 2 + w / 2
      g.textAlign = 'center'
      g.fillText(fmtInt(row[peak] ?? 0), px, strip.base - PLEGMA_STRIP - 4)
    }
  }
  if (web && plegma.region) {
    const { disc, unit } = layoutTheme(web, sec)
    const k = web.stories.length
    const mix = themeMix
    const on = (i: number) => (i === 0 ? false : themeLit.outlet !== null ? web.outlet[i]! >= 0 && web.stories[web.story[i]!]!.outlets[web.outlet[i]!]!.name === themeLit.outlet : web.story[i] === themeLit.story)
    const back = 1 - 0.7 * mix
    const curve = (path: Path2D, i: number, j: number, bow: number) => {
      const dx = hx[j]! - hx[i]!
      const dy = hy[j]! - hy[i]!
      path.moveTo(hx[i]!, hy[i]!)
      path.quadraticCurveTo((hx[i]! + hx[j]!) / 2 - dy * bow, (hy[i]! + hy[j]!) / 2 + dx * bow, hx[j]!, hy[j]!)
    }
    // The lines: the theme to each story in the color of the theme, and the small web of each story in the calm color of the group of the outlet it reaches.
    g.lineCap = 'round'
    const spokes = new Path2D()
    const lines = new Map<number, Path2D>()
    const litLines = new Path2D()
    for (let e = 0; e < web.bow.length; e++) {
      const i = web.edges[e * 2]!
      const j = web.edges[e * 2 + 1]!
      if (web.outlet[i]! < 0) { curve(spokes, j, i, web.bow[e]!); continue }
      if (mix > 0.01 && on(i)) { curve(litLines, j, i, web.bow[e]!); continue }
      const group = web.stories[web.story[i]!]!.outlets[web.outlet[i]!]!.slot
      let path = lines.get(group)
      if (!path) { path = new Path2D(); lines.set(group, path) }
      curve(path, j, i, web.bow[e]!)
    }
    g.strokeStyle = colour
    g.lineWidth = 1
    g.globalAlpha = 0.4 * back
    g.stroke(spokes)
    for (const [group, path] of lines) { g.strokeStyle = softInk[group] ?? mute; g.globalAlpha = 0.6 * back; g.stroke(path) }
    if (mix > 0.01) { g.strokeStyle = ink; g.globalAlpha = 0.45 * mix; g.stroke(litLines) }
    // The nodes: a rim of the page's color under each, then its color.
    const rims = new Path2D()
    const fills = new Map<number, Path2D>()
    const rim = clamp(unit * 0.07, 0.7, 1.4)
    const circle = (path: Path2D, i: number, r: number) => { path.moveTo(hx[i]! + r, hy[i]!); path.arc(hx[i]!, hy[i]!, r, 0, TAU) }
    for (let i = 1 + k; i < web.n; i++) {
      const r = themeNodeRadius(web, i, unit)
      circle(rims, i, r + rim)
      if (mix > 0.01 && on(i)) continue
      const group = web.stories[web.story[i]!]!.outlets[web.outlet[i]!]!.slot
      let path = fills.get(group)
      if (!path) { path = new Path2D(); fills.set(group, path) }
      circle(path, i, r)
    }
    for (let i = 0; i <= k; i++) circle(rims, i, themeNodeRadius(web, i, unit) + 1.6)
    g.globalAlpha = 1
    g.fillStyle = paper
    g.fill(rims)
    for (const [group, path] of fills) { g.fillStyle = softInk[group] ?? mute; g.globalAlpha = back; g.fill(path) }
    if (mix > 0.01) {
      for (let i = 1 + k; i < web.n; i++) {
        if (!on(i)) continue
        const group = web.stories[web.story[i]!]!.outlets[web.outlet[i]!]!.slot
        const r = themeNodeRadius(web, i, unit) * (1 + 0.25 * mix)
        g.fillStyle = group > 0 ? groupInk[group] ?? ink : mute
        g.globalAlpha = 0.7 + 0.3 * mix
        g.beginPath()
        g.arc(hx[i]!, hy[i]!, r, 0, TAU)
        g.fill()
      }
    }
    // The stories and the theme: the color of the theme. A story that is pointed at, or that has the outlet pointed at, keeps its strength.
    for (let i = 1; i <= k; i++) {
      const strong = mix < 0.01 || (themeLit.outlet !== null ? web.stories[i - 1]!.outlets.some(o => o.name === themeLit.outlet) : themeLit.story === i - 1)
      g.fillStyle = colour
      g.globalAlpha = strong ? 1 : back
      g.beginPath()
      g.arc(hx[i]!, hy[i]!, themeNodeRadius(web, i, unit), 0, TAU)
      g.fill()
    }
    g.globalAlpha = 1
    g.fillStyle = colour
    g.beginPath()
    g.arc(hx[0]!, hy[0]!, themeNodeRadius(web, 0, unit), 0, TAU)
    g.fill()
    g.strokeStyle = ink
    g.globalAlpha = 0.5
    g.lineWidth = 1
    g.beginPath()
    g.arc(hx[0]!, hy[0]!, themeNodeRadius(web, 0, unit) + 4, 0, TAU)
    g.stroke()
    // The ring: a thin line with nothing inside it.
    g.strokeStyle = colour
    g.globalAlpha = 0.45
    g.lineWidth = 1.2
    g.beginPath()
    g.arc(disc.x, disc.y, disc.r, 0, TAU)
    g.stroke()
    g.lineCap = 'butt'
    if (node > 0) {
      g.strokeStyle = ink
      g.globalAlpha = 0.85
      g.lineWidth = 1.2
      g.beginPath()
      g.arc(hx[node]!, hy[node]!, themeNodeRadius(web, node, unit) + rim + 2.5, 0, TAU)
      g.stroke()
    }
    // The names of the stories outside the ring, the largest first; a name that would lie on another is left out, the one pointed at is always there.
    const order = web.stories.map((_, i) => i)
    if (themeLit.story >= 0 && mix > 0.5) { order.splice(order.indexOf(themeLit.story), 1); order.unshift(themeLit.story) }
    const taken: { x0: number, x1: number, y0: number, y1: number }[] = []
    let shown = 0
    g.lineJoin = 'round'
    for (const i of order) {
      const first = themeLit.story === i && mix > 0.5
      if (!first && shown >= THEME_LABELS) continue
      // The name is outside the ring, the way its story lies from the theme.
      const a = Math.atan2(web.y[1 + i]!, web.x[1 + i]!)
      const sx = Math.cos(a)
      const lx = disc.x + sx * (disc.r + 10)
      const ly = disc.y + Math.sin(a) * (disc.r + 10) + 4
      const full = web.stories[i]!.name
      const align = sx > 0.25 ? 'left' : sx < -0.25 ? 'right' : 'center'
      // A name has the room from the ring to the side of the map cell: a longer one is cut to fit it.
      const sides = regionBox(width, height, plegma.region)
      const room = align === 'left' ? sides.cx + sides.w / 2 + 22 - lx : align === 'right' ? lx - (sides.cx - sides.w / 2 - 22) : sides.w
      let text = full.length > 34 ? `${full.slice(0, 33).trimEnd()}…` : full
      while (text.length > 8 && g.measureText(text).width > room) text = `${text.slice(0, -2).trimEnd()}…`
      const wide = g.measureText(text).width
      if (wide > room) continue
      const x0 = align === 'left' ? lx : align === 'right' ? lx - wide : lx - wide / 2
      const box = { x0: x0 - 4, x1: x0 + wide + 4, y0: ly - 12, y1: ly + 5 }
      if (!first && taken.some(o => box.x0 < o.x1 && box.x1 > o.x0 && box.y0 < o.y1 && box.y1 > o.y0)) continue
      taken.push(box)
      shown++
      g.textAlign = align
      g.globalAlpha = 0.9
      g.strokeStyle = paper
      g.lineWidth = 3.5
      g.strokeText(text, lx, ly)
      g.globalAlpha = first ? 1 : mix > 0.01 ? 0.55 : 1
      g.fillStyle = first ? ink : mute
      g.fillText(text, lx, ly)
    }
  }
  g.textAlign = 'start'
  g.globalAlpha = 1
}

// The stories inside the screen: the list is sorted by x, so a zoomed camera looks at a small part of it.
const visible = (margin: number) => {
  const half = width / 2 / cam.z + margin
  const x0 = cam.x - half
  const x1 = cam.x + half
  let lo = 0
  let hi = byX.length
  while (lo < hi) { const mid = (lo + hi) >> 1; if (byX[mid]!.x < x0) lo = mid + 1; else hi = mid }
  const y0 = cam.y - height / 2 / cam.z - margin
  const y1 = cam.y + height / 2 / cam.z + margin
  const out: PlegmaStory[] = []
  for (let i = lo; i < byX.length && byX[i]!.x <= x1; i++) if (byX[i]!.y >= y0 && byX[i]!.y <= y1) out.push(byX[i]!)
  return out
}

const draw = (now: number) => {
  if (!ctx || !ctxFocus || !world) return
  const c = ctx
  const f = ctxFocus
  for (const g of [c, f]) { g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, width, height) }
  const z = cam.z
  const sec = reduced.value ? 0 : now / 1000
  const dt = Math.min(0.1, Math.max(0, (now - lastNow) / 1000))
  lastNow = now
  if (plegma.highlight) hlLast = plegma.highlight
  hlMix = ease(hlMix, plegma.highlight ? 1 : 0, dt)
  if (plegma.hoverStory !== null) lineLast = plegma.hoverStory
  lineMix = ease(lineMix, plegma.hoverStory !== null ? 1 : 0, dt)
  const story = focusStory()
  const other = plegma.compare !== null ? world.byId.get(plegma.compare) ?? null : null
  const issue = focusIssue()
  const onHome = !story && issue === null
  // The theme that is lit: the one of the story or the theme in focus, or the one under the pointer.
  const lit = hover ? hover.issue : story ? story.issue : issue
  const litCoded = lit !== null && !world.issues[lit]!.catchAll
  const core = issue !== null ? coreOf(issue) : story?.coded ? spokeSet(story.issue) : EMPTY
  const homeSet = new Set(webs)
  const dim = onHome ? 0.38 : issue !== null ? 0.13 : 0.2
  push = story ? { s: story, r: articleWorldRadius(story) * 1.25 + CLEAR_PAD } : null
  const clear = issue !== null ? themeDisc() : null
  const dotBuckets: ({ colour: string, alpha: number, path: Path2D } | undefined)[] = []
  const drawn: { s: PlegmaStory, level: 1 | 2, alpha: number, focus: boolean, crisp: boolean }[] = []

  for (const s of visible(80)) {
    const isFocus = s === story || s === other
    const strong = isFocus || homeSet.has(s) || core.has(s) || s === hover
    // In a theme view the web is the theme: the map behind it is all background.
    const sameTheme = issue === null && litCoded && s.issue === lit && s.coded
    const alpha = strong ? 1 : sameTheme ? 0.6 : dim
    // In a view the story, its pair, the stories of the theme and the one under the pointer are crisp; the rest is a blurred background of dots with no lines.
    const crisp = !onHome && (isFocus || core.has(s) || s === hover)
    const base = drawLevel(s, z, strong, isFocus)
    // On Home the webs of the week have their lines at the zoom that frames them all, and are drawn no smaller than at zoom 1.1 so that each one reads.
    const level = onHome ? (base > 0 && homeSet.has(s) ? 2 : base) : issue !== null ? 0 : crisp ? base : (Math.min(base, 1) as 0 | 1 | 2)
    // Zoomed far out, the smallest stories are faint specks that only cost drawing time: leave them out until the camera is nearer.
    if (level === 0 && z < 0.3 && !strong && !sameTheme && s.n < PLEGMA_FAR_MIN) continue
    if (level === 0) {
      const r = isFocus ? 4 : clamp(0.7 + 0.35 * Math.log10(s.n + 1) * (z < 0.22 ? 1.4 : 1.8) * Math.sqrt(Math.max(z, 0.5)), 0.8, 5)
      const key = s.slot * 3 + (strong ? 2 : sameTheme ? 1 : 0)
      let bucket = dotBuckets[key]
      if (!bucket) { bucket = { colour: colourOf(s), alpha, path: new Path2D() }; dotBuckets[key] = bucket }
      const where = placed(s)
      const dd = onHome && sec ? drift(s, sec) : null
      const px = (where.x - cam.x) * z + width / 2 + (dd ? dd.x : 0)
      const py = (where.y - cam.y) * z + height / 2 + (dd ? dd.y : 0)
      // Under the web of a theme in view there are no dots: the web is read on the page's own color.
      if (clear && Math.hypot(px - clear.x, py - clear.y) < clear.r) continue
      bucket.path.moveTo(px + r, py)
      bucket.path.arc(px, py, r, 0, TAU)
    } else drawn.push({ s, level, alpha, focus: isFocus, crisp })
  }
  for (const bucket of dotBuckets) { if (!bucket) continue; c.globalAlpha = bucket.alpha; c.fillStyle = bucket.colour; c.fill(bucket.path) }

  // The webs: each dot goes round on a small circle of its own, so a web breathes; the lines are not straight, each bows to one side.
  const rd = clamp(1.3 * Math.sqrt(z) + 0.9, 1.6, 4.4)
  c.lineWidth = 1
  for (const { s, level, alpha, focus, crisp } of drawn) {
    const c = crisp ? f : ctx!
    if (s === story && level > 0) { drawArticles(c, s, level as 1 | 2, sec); continue }
    const w = webOf(world, s, focus ? PLEGMA_FOCUS_DOTS : 0)
    const p = toScreen(cam, width, height, placed(s))
    const col = colourOf(s)
    // A web breathes a little in a view, and more on Home, where it also drifts.
    const amp = onHome ? 5 : 2.4
    const dd = onHome && sec ? drift(s, sec) : null
    const ox = p.x + (dd ? dd.x : 0)
    const oy = p.y + (dd ? dd.y : 0)
    const zw = onHome ? Math.max(z, 1.1) : z
    const at = w.offs.map((o, i) => {
      const a = sec * (0.25 + ((i * 7 + s.id) % 11) * 0.05) * (i % 2 ? -1 : 1) + i * 1.9 + s.id
      const k = amp * (0.6 + ((i * 5 + s.id) % 7) * 0.14)
      return [ox + o.x * zw + Math.cos(a) * k, oy + o.y * zw + Math.sin(a) * k] as const
    })
    c.fillStyle = col
    c.strokeStyle = col
    c.lineWidth = 1
    // In a view the lines are thin and nearly straight and each dot has a rim of the page's color, so a web is clean at a small size; Home keeps the look of its hero.
    const bend = onHome ? 0.7 : 0.3
    if (level === 2) {
      c.globalAlpha = alpha * (onHome ? 0.55 : 0.45)
      c.beginPath()
      w.edges.forEach(([i, j], e) => {
        const dx = at[j]![0] - at[i]![0]
        const dy = at[j]![1] - at[i]![1]
        const bow = (((e * 0.618 + s.id * 0.37) % 1) - 0.5) * bend
        c.moveTo(at[i]![0], at[i]![1])
        c.quadraticCurveTo((at[i]![0] + at[j]![0]) / 2 - dy * bow, (at[i]![1] + at[j]![1]) / 2 + dx * bow, at[j]![0], at[j]![1])
      })
      c.stroke()
    }
    const size = onHome ? rd : clamp(1.3 * Math.sqrt(zw) + 0.9, 1.6, 4.4)
    const dr = level === 2 ? size : clamp(size * 0.8, 1.2, 3)
    if (!onHome && level === 2) {
      c.globalAlpha = 1
      c.fillStyle = paper
      c.beginPath()
      at.forEach(([x, y], i) => { const r = (i === 0 ? dr * 1.5 : dr) + 1; c.moveTo(x + r, y); c.arc(x, y, r, 0, TAU) })
      c.fill()
      c.fillStyle = col
    }
    c.globalAlpha = alpha
    c.beginPath()
    at.forEach(([x, y], i) => { const r = i === 0 ? dr * 1.5 : dr; c.moveTo(x + r, y); c.arc(x, y, r, 0, TAU) })
    c.fill()
    if (focus) {
      c.globalAlpha = 0.5
      c.lineWidth = 1.5
      c.beginPath()
      c.arc(p.x, p.y, w.r * z * 1.25 + 6, 0, TAU)
      c.stroke()
      c.lineWidth = 1
    }
  }

  // The dashed arcs of the themes in view: the focus's theme, the theme in focus, the theme under the pointer, and the themes of the Home webs.
  const issues = new Set<number>()
  if (hover && !(story && hover.issue === story.issue)) issues.add(hover.issue)
  if (onHome) for (const s of webs) issues.add(s.issue)
  const a = onHome ? c : f
  a.lineWidth = 1.2
  a.setLineDash([2, 5])
  for (const k of issues) {
    const arcs = arcsOf(world, k)
    if (!arcs.length) continue
    const slot = world.slotOf.get(k)
    a.strokeStyle = slot ? cats[slot - 1] ?? mute : mute
    a.globalAlpha = onHome ? 0.5 : 0.6
    a.beginPath()
    for (const arc of arcs) arcOf(a, arc.a, arc.b, arc.sign, onHome ? sec : 0)
    a.stroke()
  }
  a.setLineDash([])
  if (issue !== null) drawTheme(f, issue, sec, dt)
  // A story with a theme of its own is joined, by curved lines, to the largest stories of that theme and to the stories its card lists; they leave from the edge of its web,
  // spread around it by the direction they go in, and fade toward the other story. The story a card of other stories points at has its line lit: solid, glowing, flowing.
  const pointed = lineLast !== null && lineMix > 0.01 ? world.byId.get(lineLast) ?? null : null
  if (story && !onHome && (story.coded || pointed)) {
    const here = toScreen(cam, width, height, placed(story))
    const ring = ringOf(articleWorldRadius(story) * cam.z)
    const edge = ring + 9
    const colour = story.slot > 0 ? colourOf(story) : cats[0] ?? mute
    const listed: PlegmaStory[] = []
    for (const id of plegma.related) { const b = world.byId.get(id); if (b && b !== story) listed.push(b) }
    const rest: PlegmaStory[] = []
    if (story.coded) for (const b of spokeSet(story.issue)) if (b !== story && !listed.includes(b)) rest.push(b)
    // The stories its card lists, then the nearest of the largest of its theme: a few lines read, two dozen are a fan.
    rest.sort((b1, b2) => Math.hypot(b1.x - story.x, b1.y - story.y) - Math.hypot(b2.x - story.x, b2.y - story.y))
    const targets = story.coded ? [...listed, ...rest.slice(0, Math.max(0, SPOKES_MAX - listed.length))] : []
    if (pointed && pointed !== story && !targets.includes(pointed)) targets.push(pointed)
    const lines = targets.map((b) => {
      const q = toScreen(cam, width, height, placed(b))
      return { b, q: { x: q.x, y: q.y }, angle: Math.atan2(q.y - here.y, q.x - here.x), len: Math.hypot(q.x - here.x, q.y - here.y) }
    }).filter(l => l.len >= edge * 1.4).sort((l1, l2) => l1.angle - l2.angle)
    // Two lines that leave the same way are moved apart a little on the ring, so each one has a start of its own.
    const starts = lines.map(l => l.angle)
    for (let pass = 0; pass < 4; pass++) for (let k = 1; k < starts.length; k++) if (starts[k]! - starts[k - 1]! < 0.11) { starts[k - 1]! -= 0.02; starts[k]! += 0.02 }
    const dim = 1 - 0.65 * lineMix
    let litLine: (typeof lines)[number] | null = null
    f.lineWidth = 1
    lines.forEach((l, k) => {
      if (l.b === pointed) { litLine = l; return }
      const sx = here.x + Math.cos(starts[k]!) * edge
      const sy = here.y + Math.sin(starts[k]!) * edge
      const run = Math.hypot(l.q.x - sx, l.q.y - sy) || 1
      const ux = (l.q.x - sx) / run
      const uy = (l.q.y - sy) / run
      const bend = clamp(run * (0.07 + ((l.b.id * 7) % 10) * 0.01), 8, 90) * (l.b.id % 2 ? -1 : 1)
      const grad = f.createLinearGradient(sx, sy, l.q.x, l.q.y)
      grad.addColorStop(0, withAlpha(colour, 0.6))
      grad.addColorStop(1, withAlpha(colour, 0.12))
      f.globalAlpha = dim
      f.strokeStyle = grad
      f.beginPath()
      f.moveTo(sx, sy)
      f.quadraticCurveTo((sx + l.q.x) / 2 - uy * bend, (sy + l.q.y) / 2 + ux * bend, l.q.x, l.q.y)
      f.stroke()
      // Where a line leaves: a small dot outside the ring.
      f.fillStyle = colour
      f.globalAlpha = 0.75 * dim
      f.beginPath()
      f.arc(sx, sy, 1.8, 0, TAU)
      f.fill()
    })
    const on = litLine as (typeof lines)[number] | null
    if (on) {
      const sx = here.x + Math.cos(on.angle) * edge
      const sy = here.y + Math.sin(on.angle) * edge
      const ux = (on.q.x - sx) / (on.len || 1)
      const uy = (on.q.y - sy) / (on.len || 1)
      const bend = clamp(on.len * 0.14, 24, 160)
      const path = () => { f.beginPath(); f.moveTo(sx, sy); f.quadraticCurveTo((sx + on.q.x) / 2 - uy * bend, (sy + on.q.y) / 2 + ux * bend, on.q.x, on.q.y) }
      f.save()
      f.strokeStyle = colour
      f.shadowColor = colour
      f.shadowBlur = 12 * lineMix
      f.globalAlpha = lineMix
      f.lineWidth = 1 + 1.6 * lineMix
      path()
      f.stroke()
      f.shadowBlur = 0
      f.strokeStyle = ink
      f.globalAlpha = 0.55 * lineMix
      f.lineWidth = 1
      f.setLineDash([2, 12])
      f.lineDashOffset = -sec * 36
      path()
      f.stroke()
      // The other story is ringed where it is on the screen.
      f.setLineDash([])
      f.strokeStyle = colour
      f.globalAlpha = lineMix
      f.lineWidth = 1.5
      f.beginPath()
      f.arc(on.q.x, on.q.y, 9 + 2.5 * Math.sin(sec * 5), 0, TAU)
      f.stroke()
      f.restore()
    }
  }
  c.globalAlpha = 1
  f.globalAlpha = 1
}

// ---- the loop ----
// The stage draws while it is shown and the tab is visible; with reduced motion it draws one still frame when something changes.
const running = () => plegma.active && !document.hidden && !!world
const frame = (now: number) => {
  raf = 0
  if (!running()) return
  if (flight) {
    Object.assign(cam, cameraAt(flight, now, width))
    if (flightDone(flight, now)) { flight = null; plegma.setLanded(true) }
  }
  draw(now)
  if (!reduced.value || flight) raf = requestAnimationFrame(frame)
}
function kick () { if (!raf && running()) raf = requestAnimationFrame(frame) }
const halt = () => { if (raf) cancelAnimationFrame(raf); raf = 0 }

const resize = () => {
  const el = canvas.value
  const elFocus = canvasFocus.value
  if (!el || !elFocus) return
  const box = el.getBoundingClientRect()
  if (!box.width || !box.height || (box.width === width && box.height === height && dpr === Math.min(window.devicePixelRatio || 1, 2))) return
  dpr = Math.min(window.devicePixelRatio || 1, 2)
  width = box.width
  height = box.height
  el.width = Math.round(width * dpr)
  el.height = Math.round(height * dpr)
  ctx = el.getContext('2d')
  elFocus.width = el.width
  elFocus.height = el.height
  ctxFocus = elFocus.getContext('2d')
  if (!world) return
  // A new size changes the framing: the camera cuts to it, unless a flight is under way (it flies on to the new target).
  const to = targetCamera()
  if (to) { if (flight) flight = redirectFlight(flight, cam, to, performance.now(), width, reduced.value); else { Object.assign(cam, to); plegma.setLanded(true) } }
  kick()
}

// ---- the pointer ----
// The stage is behind the page, so the pointer is read on the window; a card, a link or a control under it is not the map.
const CAPTURES = 'a, button, input, select, textarea, [role="dialog"], .dcard, .plegma-card, .plegma-title, .plegma-dock, .kpi-tile, .page-head, .section-nav, .trail-bar, .header-bar, .sidebar, .page-footer, .tooltip'
const pickAt = (x: number, y: number, reach: number) => {
  if (!world) return null
  let best: PlegmaStory | null = null
  let bestDistance = reach
  for (const s of visible(reach / cam.z + 20)) {
    if (s.n < PLEGMA_WEB_MIN && s !== focusStory()) continue
    const p = { ...toScreen(cam, width, height, placed(s)) }
    // On Home the stories drift (draw), so the pointer finds them where they are drawn.
    if (!plegma.focus && !reduced.value) { const o = drift(s, performance.now() / 1000); p.x += o.x; p.y += o.y }
    const d = Math.hypot(p.x - x, p.y - y)
    if (d < bestDistance) { bestDistance = d; best = s }
  }
  return best
}
const local = (e: PointerEvent) => {
  const box = canvas.value!.getBoundingClientRect()
  return { x: e.clientX - box.left, y: e.clientY - box.top }
}
const leave = () => {
  if (!hover && hoverArticle < 0 && hoverDay < 0 && hoverNode < 0) return
  hover = null
  hoverArticle = -1
  hoverDay = -1
  hoverNode = -1
  tooltip.hide()
  if (reduced.value) kick()
}
useEventListener(window, 'pointermove', (e: PointerEvent) => {
  if (!plegma.active || !world || e.pointerType === 'touch' || !pointerFine.value || phone.value) return
  if ((e.target as Element | null)?.closest?.(CAPTURES)) return leave()
  const p = local(e)
  // On the picked story the pointer finds an article first: its outlet and its day.
  const story = focusStory()
  const list = plegma.articles
  if (story && list && list.length === story.n && plegma.landed) {
    const i = articleAt(story, p.x, p.y)
    if (i >= 0) {
      const article = list[articleOfNode(i, list.length)]!
      const per = articlesPerNode(story.n)
      if (hoverArticle !== i && reduced.value) kick()
      hover = null
      hoverArticle = i
      tooltip.show({
        title: article.outlet,
        rows: [
          { label: article.group ?? t('story.nogroup'), value: fmtDate(world.dates[article.day]!), color: `var(--cat-${article.slot})` },
          ...(per > 1 ? [{ label: t('story.nodes.per'), value: fmtInt(per) }] : [])
        ],
        field: true
      }, e)
      return
    }
    if (hoverArticle >= 0) { hoverArticle = -1; if (reduced.value) kick() }
  }
  // On a theme the pointer on the strip of the days finds a day: its date and the articles of the theme on it.
  const themed = focusIssue()
  const strip = themed !== null ? stripBox() : null
  if (strip && p.x >= strip.x0 && p.x <= strip.x1 && p.y >= strip.top - 6 && p.y <= strip.base + 4) {
    const d = dayAt(p.x)
    const v = d >= 0 ? home.data.value?.issueDaily[themed!]?.[d] : null
    if (v !== null && v !== undefined) {
      if (hoverDay !== d && reduced.value) kick()
      hover = null
      hoverDay = d
      tooltip.show({ title: fmtDate(world.dates[d]!), rows: [{ label: t('home.field.articles'), value: fmtInt(v) }], field: true }, e)
      return
    }
  }
  hoverDay = -1
  // On the web of a theme the pointer finds a story or an outlet of a story.
  if (themed !== null) {
    const i = themeNodeAt(themed, p.x, p.y)
    const web = themeWebOf(themed)
    if (i > 0 && web) {
      if (hoverNode !== i && reduced.value) kick()
      hover = null
      hoverNode = i
      const s = web.stories[web.story[i]!]!
      const o = web.outlet[i]! >= 0 ? s.outlets[web.outlet[i]!]! : null
      tooltip.show(o
        ? { title: o.name, rows: [{ label: o.group ?? t('story.nogroup'), value: '', color: `var(--cat-${o.slot})` }, { label: s.name, value: fmtInt(o.n) }], field: true }
        : { title: s.name, rows: [{ label: t('home.field.articles'), value: fmtInt(s.n) }, { label: t('entity.fact.outlets'), value: fmtInt(s.media) }], field: true }, e)
      return
    }
    if (hoverNode >= 0) { hoverNode = -1; if (reduced.value) kick() }
  }
  const best = pickAt(p.x, p.y, 14)
  if (!best) return leave()
  if (hover !== best && reduced.value) kick()
  hover = best
  const issueName = (world.issues[best.issue]!)
  tooltip.show({
    title: name(best),
    rows: [
      { label: t('home.field.topic'), value: (locale.value === 'en' && issueName.en) || issueName.el, color: best.slot > 0 ? `var(--cat-${best.slot})` : undefined },
      { label: t('home.field.articles'), value: fmtInt(best.n) }
    ],
    field: true
  }, e)
})
useEventListener(document, 'pointerleave', leave)
useEventListener(window, 'click', (e: MouseEvent) => {
  if (!plegma.active || !world || !pointerFine.value || phone.value || e.button !== 0 || e.defaultPrevented || hoverArticle >= 0) return
  if ((e.target as Element | null)?.closest?.(CAPTURES)) return
  const p = { x: e.clientX - canvas.value!.getBoundingClientRect().left, y: e.clientY - canvas.value!.getBoundingClientRect().top }
  // A story of the web of a theme opens that story.
  const themeNow = focusIssue()
  const web = themeNow !== null ? themeWebOf(themeNow) : null
  if (web && hoverNode > 0 && hoverNode < web.n) {
    const id = web.stories[web.story[hoverNode]!]!.id
    tooltip.hide()
    hoverNode = -1
    navigateTo(storyHref(id))
    return
  }
  const best = pickAt(p.x, p.y, 18)
  if (best) { tooltip.hide(); hover = null; navigateTo(storyHref(best.id)) }
})

// ---- start ----
const ready = computed(() => !!stories.data.value && !!home.data.value && !!file.data.value)
const start = () => {
  if (world || !ready.value) return
  world = buildWorld(stories.data.value!, home.data.value!, file.data.value!)
  const ix = homeIndex({ stories: stories.data.value!, detail: null })
  byX = world.stories.slice().sort((a, b) => a.x - b.x)
  // The latest week that has topics, so the webs have their colours (the October stories have no topic): the last day with a count in the topics' days.
  const lastCoded = home.data.value!.issueDaily.reduce((m, row) => Math.max(m, row.findLastIndex(v => v !== null)), 0)
  webs = homeWebs(world, ix, phone.value ? HOME_WEBS_PHONE : HOME_WEBS, lastCoded)
  codedLast = lastCoded
  dayW = file.data.value!.dx
  dayX = world.dates.map(date => Math.round((Date.parse(date) - Date.parse(file.data.value!.epoch)) / 86400000) * dayW)
  readTokens()
  // A cold open lands settled: no flight (R14).
  const to = targetCamera()
  if (to) Object.assign(cam, to)
  plegma.setLanded(true)
  kick()
}
watch(ready, start)

onMounted(() => {
  const el = canvas.value!
  new ResizeObserver(resize).observe(el)
  resize()
  start()
})
useEventListener(document, 'visibilitychange', () => { if (document.hidden) halt(); else kick() })
// The route puts something else in focus: fly there. From a page with no map the flight starts from where the camera was left.
watch(() => [plegma.focus, plegma.compare], () => fly(), { deep: true })
// The view measured the free area again (its title grew, the window changed): the camera frames the new area, inside a flight from where it is.
watch(() => plegma.region, () => {
  const to = targetCamera()
  if (!to || plegma.focus === null) return
  if (flight) flight = redirectFlight(flight, cam, to, performance.now(), width, reduced.value)
  else Object.assign(cam, to)
  kick()
}, { deep: true })
watch(() => plegma.active, (active) => {
  if (!active) { halt(); leave(); return }
  const to = targetCamera()
  if (to && !flight && (Math.abs(to.x - cam.x) > 0.5 || Math.abs(to.y - cam.y) > 0.5 || Math.abs(to.z - cam.z) > 0.001)) fly()
  else kick()
})
watch(() => [plegma.articles, plegma.highlight, plegma.hoverStory, plegma.related, plegma.themeStories], () => kick())
watch(() => prefs.theme, async () => { await nextTick(); readTokens(); kick() })
watch(reduced, (still) => { if (still) { flight = null; const to = targetCamera(); if (to) Object.assign(cam, to); plegma.setLanded(true) } kick() })
onBeforeUnmount(halt)
</script>

<template>
  <div class="plegma-stage" :class="{ 'is-view': plegma.focus !== null }" :hidden="!plegma.active" aria-hidden="true">
    <canvas ref="canvas" class="plegma-canvas plegma-canvas-back" />
    <canvas ref="canvasFocus" class="plegma-canvas plegma-canvas-focus" />
  </div>
</template>
