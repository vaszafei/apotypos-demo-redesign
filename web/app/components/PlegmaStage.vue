<script setup lang="ts">
import { useEventListener, useMediaQuery } from '@vueuse/core'
import type { PlegmaPoint } from '~/utils/plegma-camera'
import { cameraAt, flightDone, frameHome, framePair, frameStory, frameTheme, PLEGMA_REGION, redirectFlight, regionBox, toScreen, toWorld } from '~/utils/plegma-camera'
import type { PlegmaCamera, PlegmaFlight } from '~/utils/plegma-camera'
import { arcsOf, buildWorld, drawLevel, homeWebs, PLEGMA_FAR_MIN, PLEGMA_FOCUS_DOTS, PLEGMA_WEB_MIN, themeCore, themeFrameSet, webOf } from '~/utils/plegma-world'
import { heroClearMs, heroReach, heroWebOf, HERO_SPEED, lanternReveal, looseOf, smooth, waveReveal } from '~/utils/plegma-hero'
import type { HeroSource } from '~/utils/plegma-hero'
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
// The best webs of the latest week, which Home frames under the hero. Under the hero, with a day picked (plegma.homeDay), the map is a dim background of dots for the web of the day.
let weekWebs: PlegmaStory[] = []
let ink = '#111'
// The color of a story with no theme and of a node with no group: a soft gray, not the ink, so the map is not black.
let mute = '#6b6f78'
// The color of the page: the rim of a node.
let paper = '#f6f4ef'
let cats: string[] = []
let groupInk: string[] = []
let stanceInk: string[] = []
// The colors of the nodes at rest: the group colors mixed with the gray of no group, so the web is a family of colors, not confetti. A group that is
// pointed at gets its full color.
let softInk: string[] = []
let fontText = 'system-ui, sans-serif'
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

// The map is alive like the nebyss hero: the whole field turns slowly about the middle of the page, each dot at its own steady pace (slower the farther out), no jitter.
// It is drawn only, a story keeps its place in the world; with reduced motion there is none.
const ORBIT = 0.025
const ORBIT_REACH = 420
const driftSpot = { x: 0, y: 0 }
const orbit = (dx: number, dy: number, sec: number) => {
  const a = sec * ORBIT / (1 + Math.hypot(dx, dy) / ORBIT_REACH)
  const cos = Math.cos(a)
  const sin = Math.sin(a)
  driftSpot.x = dx * cos - dy * sin - dx
  driftSpot.y = dx * sin + dy * cos - dy
  return driftSpot
}
const drift = (s: PlegmaStory, sec: number) => orbit((s.x - cam.x) * cam.z, (s.y - cam.y) * cam.z, sec)
// The world behind a view is seen from far away (the page is its background); the web in view is drawn at the camera's own zoom in front of it.
const BACK_Z = 0.66

// A web that comes into view (a story, a theme, an outlet) is not there at once: it grows. Its nodes leave the center and go to their places, the nearer ones first, then its lines
// and its ring come in. It starts when the camera is half way through its flight (the web would be drawn on a moving map before), and only when the view has measured its
// free area, so it never grows unseen. With reduced motion it is all at once.
const INTRO_MS = 1100
const INTRO_AT = 0.3
let introKey = ''
let introAt = -1
let introP = 1
let nodeIn = 1
let lineIn = 1
let ringIn = 1
let ge = new Float32Array(0)
const gatherSpot = { x: 0, y: 0 }
// Node `i` of a web whose center is (cx, cy) with radius R and whose place is (tx, ty): how far along it is now (ge[i]) and where it is.
const gatherTo = (i: number, n: number, tx: number, ty: number, cx: number, cy: number, R: number) => {
  if (ge.length < n) ge = new Float32Array(n)
  const reach = Math.min(1, Math.hypot(tx - cx, ty - cy) / Math.max(R, 1))
  const delay = reach * 0.42 + ((i * 0.618034) % 1) * 0.12
  const t = clamp((introP - delay) / 0.46, 0, 1)
  const e = 1 - Math.pow(1 - t, 3)
  ge[i] = e
  gatherSpot.x = cx + (tx - cx) * e
  gatherSpot.y = cy + (ty - cy) * e
  return gatherSpot
}
// A node's radius on its way: a small dot at first, then its own.
const gatherR = (i: number, r: number) => (introP < 1 ? r * (0.3 + 0.7 * (ge[i] ?? 1)) : r)

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
  stanceInk = ['critical', 'neutral', 'supportive'].map(k => style.getPropertyValue(`--stance-${k}`).trim() || mute)
  softInk = groupInk.map(c => mixHex(c, groupInk[0] ?? mute, 0.3))
}

const focusStory = () => (world && plegma.focus?.kind === 'story' ? world.byId.get(plegma.focus.id) ?? null : null)
const focusIssue = () => (plegma.focus?.kind === 'theme' ? plegma.focus.issue : null)
const focusOutlet = () => (plegma.focus?.kind === 'outlet' ? plegma.focus.slug : null)
// The web in the middle of the map: a theme's or an outlet's (both are built by utils/plegma-theme.ts); `seed` shapes it and `kind` keeps the two apart.
const webFocus = () => {
  const f = plegma.focus
  if (f?.kind === 'theme') return { kind: 'theme' as const, seed: f.issue + 1 }
  if (f?.kind === 'outlet') return { kind: 'outlet' as const, seed: [...f.slug].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 9973, 7) }
  return null
}

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
    // A theme is framed on its largest stories; its web lies over this background.
    return frameTheme([...coreOf(issue)], width, height, plegma.region ?? undefined)
  }
  return webs.length ? frameHome(webs, width, height) : null
}


const fly = () => {
  const to = targetCamera()
  if (!to) return
  walk = null
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
// The arc of the ring under the pointer ('g3' the fourth group, 's1' the neutral arc of the stance) and, for each arc, how far it has come forward (0 to 1): it grows and brightens as it eases.
let hoverRing = ''
const ringHot = new Map<string, number>()
// What the cards point at (stores/plegma.ts): the articles of a group or an outlet come forward, a line to a story of the card of the other stories lights up. Each eases
// in and out, so the map answers the pointer instead of jumping; with reduced motion it jumps.
let hlMix = 0
// The ring of the story web turns from the arcs of the groups to the arcs of the stance and back: 0 is the groups, 1 the stance.
let ringMix = 0
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
    if (introP < 1) { const at = gatherTo(i, aw.n, ax[i]!, ay[i]!, p.x, p.y, ringOf(R)); ax[i] = at.x; ay[i] = at.y }
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

// The arc of the ring under the pointer: a group of the sectors, or a stance once the ring has turned to it. A few pixels either side of the line count as on it.
const ringAt = (s: PlegmaStory, x: number, y: number) => {
  const a = layoutArticles(s, reduced.value ? 0 : performance.now() / 1000)
  const aw = a.aw!
  if (!aw.arcs.length || morphFrom || Math.abs(Math.hypot(x - a.cx, y - a.cy) - a.ring) > 7) return null
  const at = (Math.atan2(y - a.cy, x - a.cx) + Math.PI / 2 + TAU) % TAU
  const inside = (start: number, span: number) => span > 0 && (at - start + TAU) % TAU <= span
  if (ringMix > 0.5) {
    const arcs = shareArcs(plegma.stance)
    if (!arcs) return null
    for (let k = 0; k < 3; k++) if (inside(arcs[k * 2]!, arcs[k * 2 + 1]!)) return { kind: 's' as const, k }
    return null
  }
  for (let k = 0; k < aw.arcs.length / 2; k++) if (inside(aw.arcs[k * 2]!, aw.arcs[k * 2 + 1]!)) return { kind: 'g' as const, k }
  return null
}

// The arc of the ring of a theme under the pointer: a group, or a stance once the ring has turned to it.
const themeRingAt = (x: number, y: number) => {
  const disc = themeDisc()
  const groups = plegma.themeGroups
  if (!disc || !groups?.length || Math.abs(Math.hypot(x - disc.x, y - disc.y) - disc.r) > 7) return null
  const at = (Math.atan2(y - disc.y, x - disc.x) + Math.PI / 2 + TAU) % TAU
  const inside = (start: number, span: number) => span > 0 && (at - start + TAU) % TAU <= span
  const arcs = ringMix > 0.5 ? shareArcs(plegma.stance) : shareArcs(groups.map(g => g.n))
  if (!arcs) return null
  for (let k = 0; k < arcs.length / 2; k++) if (inside(arcs[k * 2]!, arcs[k * 2 + 1]!)) return { kind: ringMix > 0.5 ? 's' as const : 'g' as const, k }
  return null
}
// The arcs of a ring from counts: [start, span] in radians from the top, clockwise, for each count, as wide as its share of the total (the stance: critical, neutral and supportive;
// on a theme the groups too).
const shareArcs = (counts: number[] | null) => {
  const total = counts ? counts.reduce((x, y) => x + y, 0) : 0
  if (!counts || !total) return null
  const used = counts.filter(c => c > 0).length
  const room = used > 1 ? Math.min(0.09, (Math.PI * 0.5) / used) : 0
  const out = new Float32Array(counts.length * 2)
  let at = 0
  for (let k = 0; k < counts.length; k++) {
    const span = counts[k]! > 0 ? (TAU - used * room) * (counts[k]! / total) : 0
    out[k * 2] = at + (counts[k]! > 0 ? room / 2 : 0)
    out[k * 2 + 1] = span
    at += span + (counts[k]! > 0 ? room : 0)
  }
  return out
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
  const rOf = (i: number) => gatherR(i, i === 0 ? a.dr * 1.7 : a.dr)
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
      g.globalAlpha = (a.spacing < 7 ? 0.4 : 0.55) * (1 - 0.6 * mix) * lineIn
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
  g.globalAlpha = nodeIn
  g.fillStyle = paper
  g.fill(rims)
  for (const [slot, path] of fills) {
    g.fillStyle = inkOf(slot)
    g.globalAlpha = (1 - 0.68 * mix) * nodeIn
    g.fill(path)
  }
  if (lit) {
    for (let i = 0; i < aw.n; i++) {
      if (!lit[i]) continue
      const slot = slotOf(i)
      const colour = slot > 0 ? groupInk[slot] ?? ink : mute
      const r = rOf(i) * (1 + 0.5 * mix + 0.12 * mix * Math.sin(sec * 5 + i * 0.9))
      g.fillStyle = colour
      g.globalAlpha = 0.18 * mix * nodeIn
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
    g.globalAlpha = 0.55 * (1 - 0.5 * mix) * ringIn
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
    // Turning to the stance the arcs of the groups go a quarter turn on and fade; the arcs of the stance come in from a quarter turn back.
    const stanceAt = ringMix > 0.01 ? shareArcs(plegma.stance) : null
    const groupsOut = stanceAt ? ringMix : 0
    const turn = groupsOut * (Math.PI / 2)
    if (groupsOut < 0.99) for (let k = 0; k < aw.arcs.length / 2; k++) {
      const span = aw.arcs[k * 2 + 1]!
      if (span <= 0) continue
      const slot = sectorSlot[k] ?? 0
      const on = !!hlLast && mix > 0.01 && articles?.find(x => x.order === k)?.group === hlLast.group
      const pad = Math.min(span / 2, 3 / a.ring)
      const hot = ringHot.get(`g${k}`) ?? 0
      const rest = on ? 1 : 0.85 * (1 - 0.6 * mix)
      g.strokeStyle = on || hot > 0.01 ? (slot > 0 ? groupInk[slot] ?? ink : mute) : softInk[slot] ?? mute
      g.lineWidth = 2 + 2.5 * hot
      g.globalAlpha = (rest + (1 - rest) * hot) * (1 - groupsOut) * ringIn
      g.beginPath()
      g.arc(a.cx, a.cy, a.ring, aw.arcs[k * 2]! - Math.PI / 2 + pad + turn, aw.arcs[k * 2]! + span - Math.PI / 2 - pad + turn)
      g.stroke()
    }
    if (stanceAt) {
      const back = (1 - ringMix) * (Math.PI / 2)
      for (let k = 0; k < 3; k++) {
        const span = stanceAt[k * 2 + 1]!
        if (span <= 0) continue
        const pad = Math.min(span / 2, 3 / a.ring)
        const hot = ringHot.get(`s${k}`) ?? 0
        g.strokeStyle = stanceInk[k] ?? mute
        g.lineWidth = 2 + 2.5 * hot
        g.globalAlpha = (0.9 + 0.1 * hot) * ringMix * ringIn
        g.beginPath()
        g.arc(a.cx, a.cy, a.ring, stanceAt[k * 2]! - Math.PI / 2 + pad - back, stanceAt[k * 2]! + span - Math.PI / 2 - pad - back)
        g.stroke()
      }
    }
  } else {
    g.globalAlpha = 0.45 * ringIn
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
  // The ring is as large as the ring of a story's web: the region is the same square on both pages.
  const ring = Math.min(box.w, box.h) * 0.45
  return { x: box.cx, y: box.cy, r: ring, R: ring - 16 }
}
const themeWebOf = () => {
  const focus = webFocus()
  const list = plegma.themeStories
  if (!focus || !list || !list.length) return null
  const key = `${focus.kind}|${focus.seed}|${list.length}|${list[0]!.id}`
  if (themed.key !== key) Object.assign(themed, { key, web: buildThemeWeb(list, focus.seed), index: new Map(list.map((s, i) => [s.id, i])) })
  return themed.web
}
const themeNodeRadius = (web: PlegmaThemeWeb, i: number, unit: number) =>
  gatherR(i, i === 0 ? 8 : web.outlet[i]! < 0 ? 4.2 + 3.2 * web.size[i]! : clamp(unit * (0.13 + 0.12 * web.size[i]!), 1.6, 5))
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
    if (introP < 1) { const at = gatherTo(i, web.n, hx[i]!, hy[i]!, disc.x, disc.y, disc.r); hx[i] = at.x; hy[i] = at.y }
  }
  return { disc, unit }
}
const themeNodeAt = (x: number, y: number) => {
  const web = themeWebOf()
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
const drawTheme = (g: CanvasRenderingContext2D, sec: number, dt: number) => {
  // On the web of an outlet the center is the group of the outlet and each story has the color of its theme; on a theme's the center and the stories have the theme's.
  const outlet = focusOutlet() !== null
  const issue = focusIssue()
  const slotColour = (sl: number) => (sl > 0 ? cats[sl - 1] ?? mute : mute)
  const slot = outlet ? plegma.outletSlot : issue !== null ? world!.slotOf.get(issue) ?? 0 : 0
  const colour = slot > 0 ? slotColour(slot) : outlet ? ink : mute
  const web = themeWebOf()
  const nodeSlot = (i: number) => {
    const s = web!.stories[web!.story[i]!]!
    return outlet ? s.slot ?? 0 : s.outlets[web!.outlet[i]!]!.slot
  }
  const storyColour = (i: number) => (outlet ? slotColour(web!.stories[i]!.slot ?? 0) : colour)
  g.font = `11px ${fontText}`
  g.textBaseline = 'alphabetic'
  // The story or the outlet pointed at, in the card or on the web.
  const node = web && hoverNode > 0 && hoverNode < web.n ? hoverNode : -1
  const cardStory = plegma.hoverStory !== null ? themed.index.get(plegma.hoverStory) ?? -1 : -1
  const lit = node > 0 ? (web!.outlet[node]! >= 0 ? { story: -1, outlet: web!.stories[web!.story[node]!]!.outlets[web!.outlet[node]!]!.name } : { story: web!.story[node]!, outlet: null }) : cardStory >= 0 ? { story: cardStory, outlet: null } : null
  if (lit) themeLit = lit
  themeMix = ease(themeMix, lit ? 1 : 0, dt)
  if (web && plegma.region) {
    const { disc, unit } = layoutTheme(web, sec)
    const k = web.stories.length
    const mix = themeMix
    wasTheme = true
    diveSpot.clear()
    for (let i = 0; i < k; i++) diveSpot.set(web.stories[i]!.id, { x: hx[1 + i]!, y: hy[1 + i]! })
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
    const spokes = new Map<number, Path2D>()
    const lines = new Map<number, Path2D>()
    const litLines = new Path2D()
    for (let e = 0; e < web.bow.length; e++) {
      const i = web.edges[e * 2]!
      const j = web.edges[e * 2 + 1]!
      if (web.outlet[i]! < 0) {
        const key = outlet ? web.stories[web.story[i]!]!.slot ?? 0 : 0
        let path = spokes.get(key)
        if (!path) { path = new Path2D(); spokes.set(key, path) }
        curve(path, j, i, web.bow[e]!)
        continue
      }
      if (mix > 0.01 && on(i)) { curve(litLines, j, i, web.bow[e]!); continue }
      const group = nodeSlot(i)
      let path = lines.get(group)
      if (!path) { path = new Path2D(); lines.set(group, path) }
      curve(path, j, i, web.bow[e]!)
    }
    g.lineWidth = 1
    g.globalAlpha = 0.4 * back * lineIn
    for (const [key, path] of spokes) { g.strokeStyle = outlet ? slotColour(key) : colour; g.stroke(path) }
    for (const [group, path] of lines) { g.strokeStyle = softInk[group] ?? mute; g.globalAlpha = 0.6 * back * lineIn; g.stroke(path) }
    if (mix > 0.01) { g.strokeStyle = ink; g.globalAlpha = 0.45 * mix * lineIn; g.stroke(litLines) }
    // The nodes: a rim of the page's color under each, then its color.
    const rims = new Path2D()
    const fills = new Map<number, Path2D>()
    const rim = clamp(unit * 0.07, 0.7, 1.4)
    const circle = (path: Path2D, i: number, r: number) => { path.moveTo(hx[i]! + r, hy[i]!); path.arc(hx[i]!, hy[i]!, r, 0, TAU) }
    for (let i = 1 + k; i < web.n; i++) {
      const r = themeNodeRadius(web, i, unit)
      circle(rims, i, r + rim)
      if (mix > 0.01 && on(i)) continue
      const group = nodeSlot(i)
      let path = fills.get(group)
      if (!path) { path = new Path2D(); fills.set(group, path) }
      circle(path, i, r)
    }
    for (let i = 0; i <= k; i++) circle(rims, i, themeNodeRadius(web, i, unit) + 1.6)
    g.globalAlpha = nodeIn
    g.fillStyle = paper
    g.fill(rims)
    for (const [group, path] of fills) { g.fillStyle = softInk[group] ?? mute; g.globalAlpha = back * nodeIn; g.fill(path) }
    if (mix > 0.01) {
      for (let i = 1 + k; i < web.n; i++) {
        if (!on(i)) continue
        const group = nodeSlot(i)
        const r = themeNodeRadius(web, i, unit) * (1 + 0.25 * mix)
        g.fillStyle = group > 0 ? groupInk[group] ?? ink : mute
        g.globalAlpha = (0.7 + 0.3 * mix) * nodeIn
        g.beginPath()
        g.arc(hx[i]!, hy[i]!, r, 0, TAU)
        g.fill()
      }
    }
    // The stories and the theme: the color of the theme. A story that is pointed at, or that has the outlet pointed at, keeps its strength.
    for (let i = 1; i <= k; i++) {
      const strong = mix < 0.01 || (themeLit.outlet !== null ? web.stories[i - 1]!.outlets.some(o => o.name === themeLit.outlet) : themeLit.story === i - 1)
      g.fillStyle = storyColour(i - 1)
      g.globalAlpha = (strong ? 1 : back) * nodeIn
      g.beginPath()
      g.arc(hx[i]!, hy[i]!, themeNodeRadius(web, i, unit), 0, TAU)
      g.fill()
    }
    g.globalAlpha = nodeIn
    g.fillStyle = colour
    g.beginPath()
    g.arc(hx[0]!, hy[0]!, themeNodeRadius(web, 0, unit), 0, TAU)
    g.fill()
    g.strokeStyle = ink
    g.globalAlpha = 0.5 * ringIn
    g.lineWidth = 1
    g.beginPath()
    g.arc(hx[0]!, hy[0]!, themeNodeRadius(web, 0, unit) + 4, 0, TAU)
    g.stroke()
    // The ring: a thin line, or, once the groups of the theme are known, an arc for each group (as wide as its share of the articles of the theme); it turns to the arcs of the
    // stance the way the ring of a story does.
    const groupAt = plegma.themeGroups?.length ? shareArcs(plegma.themeGroups.map(x => x.n)) : null
    if (groupAt) {
      const stanceAt = ringMix > 0.01 ? shareArcs(plegma.stance) : null
      const groupsOut = stanceAt ? ringMix : 0
      const turn = groupsOut * (Math.PI / 2)
      g.lineCap = 'round'
      if (groupsOut < 0.99) for (let k = 0; k < groupAt.length / 2; k++) {
        const span = groupAt[k * 2 + 1]!
        if (span <= 0) continue
        const slot = plegma.themeGroups![k]!.slot
        const hot = ringHot.get(`g${k}`) ?? 0
        g.strokeStyle = hot > 0.01 ? (slot > 0 ? groupInk[slot] ?? ink : mute) : softInk[slot] ?? mute
        g.lineWidth = 2 + 2.5 * hot
        g.globalAlpha = (0.85 + 0.15 * hot) * (1 - groupsOut) * ringIn
        const pad = Math.min(span / 2, 3 / disc.r)
        g.beginPath()
        g.arc(disc.x, disc.y, disc.r, groupAt[k * 2]! - Math.PI / 2 + pad + turn, groupAt[k * 2]! + span - Math.PI / 2 - pad + turn)
        g.stroke()
      }
      if (stanceAt) {
        const back = (1 - ringMix) * (Math.PI / 2)
        for (let k = 0; k < 3; k++) {
          const span = stanceAt[k * 2 + 1]!
          if (span <= 0) continue
          const hot = ringHot.get(`s${k}`) ?? 0
          g.strokeStyle = stanceInk[k] ?? mute
          g.lineWidth = 2 + 2.5 * hot
          g.globalAlpha = (0.9 + 0.1 * hot) * ringMix * ringIn
          const pad = Math.min(span / 2, 3 / disc.r)
          g.beginPath()
          g.arc(disc.x, disc.y, disc.r, stanceAt[k * 2]! - Math.PI / 2 + pad - back, stanceAt[k * 2]! + span - Math.PI / 2 - pad - back)
          g.stroke()
        }
      }
    } else {
      g.strokeStyle = colour
      g.globalAlpha = 0.45 * ringIn
      g.lineWidth = 1.2
      g.beginPath()
      g.arc(disc.x, disc.y, disc.r, 0, TAU)
      g.stroke()
    }
    g.lineCap = 'butt'
    if (node > 0) {
      g.strokeStyle = ink
      g.globalAlpha = 0.85
      g.lineWidth = 1.2
      g.beginPath()
      g.arc(hx[node]!, hy[node]!, themeNodeRadius(web, node, unit) + rim + 2.5, 0, TAU)
      g.stroke()
    }
    // The name of the story pointed at, outside the ring.
    const order = web.stories.map((_, i) => i)
    if (themeLit.story >= 0 && mix > 0.5) { order.splice(order.indexOf(themeLit.story), 1); order.unshift(themeLit.story) }
    const taken: { x0: number, x1: number, y0: number, y1: number }[] = []
    g.lineJoin = 'round'
    for (const i of order) {
      const first = themeLit.story === i && mix > 0.5
      // The web is the size of a story's, so there is no room for the names around it: only the story pointed at has its name.
      if (!first) continue
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
const visible = (margin: number, zz = cam.z) => {
  const half = width / 2 / zz + margin
  const x0 = cam.x - half
  const x1 = cam.x + half
  let lo = 0
  let hi = byX.length
  while (lo < hi) { const mid = (lo + hi) >> 1; if (byX[mid]!.x < x0) lo = mid + 1; else hi = mid }
  const y0 = cam.y - height / 2 / zz - margin
  const y1 = cam.y + height / 2 / zz + margin
  const out: PlegmaStory[] = []
  for (let i = lo; i < byX.length && byX[i]!.x <= x1; i++) if (byX[i]!.y >= y0 && byX[i]!.y <= y1) out.push(byX[i]!)
  return out
}


// ---- the hero: unexplored ground ----
// With the hero in view the map is black, blurred nodes (the back canvas is blurred by the page's CSS, `is-fog`). A click starts a wave from the pointer: where it has passed the nodes
// are in focus, in their colors, and each web draws itself up from loose nodes into its clusters and lines, on the crisp canvas. The camera takes a step toward the click, as in a game
// that clears as you walk. Before the first click the pointer is a lantern (a small clear patch under it) and, if the pointer does not move, a ring goes out now and then. A click
// opens no story here: the way into one is the search and the section under the hero.
const HERO_APPEAR = 1200
// How far from its place a node lies while the ground is unexplored (1 is fully loose): the web still reads as a shape, only unsettled.
const HERO_LOOSE = 0.7
// The pixels a whole web lies from its place while the ground is unexplored.
const HERO_AWAY = 70
const LANTERN = 170
const HERO_WALK_MAX = 3
const HERO_WALK_ZOOM = 1.1
const HERO_WALK_PULL = 0.28
const HINT_AFTER = 3.2
const HINT_EVERY = 6.5
let heroSources: HeroSource[] = []
let heroT0 = -1
let heroCleared = false
let walk: PlegmaCamera | null = null
let walks = 0
const heroRev = new Map<number, number>()
const lantern = { x: -9999, y: -9999, v: 0, on: false }
const fogged = ref(true)
const nodeAt = new Float32Array(64)
const explore = (x: number, y: number) => {
  const at = toWorld(cam, width, height, { x, y })
  heroSources.push({ x: at.x, y: at.y, t0: performance.now() })
  if (heroSources.length > 6) heroSources.splice(1, 1)
  if (walks < HERO_WALK_MAX) {
    walks++
    const framed = targetCamera()
    walk = { x: cam.x + (at.x - cam.x) * HERO_WALK_PULL, y: cam.y + (at.y - cam.y) * HERO_WALK_PULL, z: Math.min(cam.z * HERO_WALK_ZOOM, (framed?.z ?? cam.z) * 1.35) }
    if (reduced.value) { Object.assign(cam, walk); walk = null }
  }
  tooltip.hide()
  kick()
}
const drawHero = (now: number, sec: number, dt: number) => {
  const c = ctx!
  const f = ctxFocus!
  const z = cam.z
  if (heroT0 < 0) heroT0 = now
  const first = heroSources[0]
  heroCleared = !!first && (reduced.value || now - first.t0 >= heroClearMs(width, height))
  if (fogged.value === heroCleared) fogged.value = !heroCleared
  lantern.v = ease(lantern.v, lantern.on && !heroCleared ? 1 : 0, dt)
  const appearAll = reduced.value ? 1 : smooth(0, 1, (now - heroT0) / (HERO_APPEAR + 300))
  // How clear a point is: the best of the waves that have passed it and the lantern. `pad` keeps a wide web lit while the lantern is near its edge.
  const clear = (wx: number, wy: number, sx: number, sy: number, pad: number) => {
    let r = 0
    for (const src of heroSources) r = Math.max(r, waveReveal(Math.hypot(wx - src.x, wy - src.y) * z, reduced.value ? 1e6 : now - src.t0))
    if (lantern.v > 0.01) r = Math.max(r, 0.7 * lantern.v * lanternReveal(Math.max(0, Math.hypot(sx - lantern.x, sy - lantern.y) - pad), LANTERN))
    return r
  }
  const homeSet = new Set(webs)
  const fogBuckets: Path2D[] = [new Path2D(), new Path2D(), new Path2D(), new Path2D()]
  const dotBuckets = new Map<number, { colour: string, alpha: number, path: Path2D }>()
  const list: { s: PlegmaStory, strong: boolean }[] = []
  for (const s of visible(80, z)) {
    const strong = homeSet.has(s)
    const base = drawLevel(s, z, strong, false)
    if (base > 0) { list.push({ s, strong }); continue }
    if (z < 0.3 && !strong && s.n < PLEGMA_FAR_MIN) continue
    const r = clamp(0.7 + 0.35 * Math.log10(s.n + 1) * (z < 0.22 ? 1.4 : 1.8) * Math.sqrt(Math.max(z, 0.5)), 0.8, 5)
    const bx = (s.x - cam.x) * z
    const by = (s.y - cam.y) * z
    const dd = sec ? orbit(bx, by, sec) : null
    const px = bx + width / 2 + (dd ? dd.x : 0)
    const py = by + height / 2 + (dd ? dd.y : 0)
    const q = Math.round(clear(s.x, s.y, px, py, 0) * 4)
    if (q < 4) { const p = fogBuckets[q]!; const rf = r * 1.2 + 0.8; p.moveTo(px + rf, py); p.arc(px, py, rf, 0, TAU) }
    if (q > 0) {
      const key = s.slot * 8 + q
      let b = dotBuckets.get(key)
      if (!b) { b = { colour: colourOf(s), alpha: 0.38 * (q / 4), path: new Path2D() }; dotBuckets.set(key, b) }
      b.path.moveTo(px + r, py)
      b.path.arc(px, py, r, 0, TAU)
    }
  }
  c.fillStyle = ink
  fogBuckets.forEach((p, q) => { if (q < 4) { c.globalAlpha = 0.17 * appearAll * (1 - q / 4); c.fill(p) } })
  for (const b of dotBuckets.values()) { f.globalAlpha = b.alpha * appearAll; f.fillStyle = b.colour; f.fill(b.path) }

  // The webs: loose and black until the wave passes, then they gather into their clusters; the clusters sway as one, the nodes a little on their own.
  const rd = clamp(1.3 * Math.sqrt(z) + 0.9, 1.6, 4.4)
  const zw = Math.max(z, 1.1)
  let cleared = 0
  for (const { s, strong } of list) {
    const w = heroWebOf(world!, s)
    const p = toScreen(cam, width, height, s)
    const dd = sec ? drift(s, sec) : null
    const cx = p.x + (dd ? dd.x : 0)
    const cy = p.y + (dd ? dd.y : 0)
    if (cx < -w.r * zw * 3 || cx > width + w.r * zw * 3 || cy < -w.r * zw * 3 || cy > height + w.r * zw * 3) continue
    const target = clear(s.x, s.y, cx, cy, w.r * zw)
    const was = heroRev.get(s.id) ?? 0
    const rev = reduced.value ? target : was + (target - was) * (1 - Math.exp(-dt * (target > was ? 7 : 2.5)))
    heroRev.set(s.id, rev > 0.995 ? 1 : rev)
    if (homeSet.has(s)) cleared += rev
    const e = 1 - Math.pow(1 - rev, 3)
    // Unexplored, the web as a whole also lies away from its place; the click brings it home.
    const away = looseOf(s.id, 99)
    const ox = away.x * HERO_AWAY * (1 - e)
    const oy = away.y * HERO_AWAY * (1 - e)
    const appear = reduced.value ? 1 : smooth(0, 1, (now - heroT0 - (cx / Math.max(width, 1)) * 700 - 150) / HERO_APPEAR)
    const hot = hover === s ? 1.25 : 1
    for (let i = 0; i < w.offs.length; i++) {
      const o = w.offs[i]!
      const l = looseOf(s.id, i)
      const lo = HERO_LOOSE * (1 - e)
      const gx = o.x * zw + (l.x * w.r * 0.95 * zw - o.x * zw) * lo
      const gy = o.y * zw + (l.y * w.r * 0.95 * zw - o.y * zw) * lo
      const cl = w.cluster[i]!
      const ph = (cl + 2) * 1.7 + s.id
      const sway = cl < 0 ? 2.5 : 7
      const k = 1 + (1 - e) * 1.2
      nodeAt[i * 2] = cx + ox + gx + (Math.sin(sec * 0.31 + ph) * sway + Math.sin(sec * 0.83 + ph * 2) * 2) * k + Math.cos(sec * (0.5 + (i % 5) * 0.11) + i * 1.9 + s.id) * 2.4 * k
      nodeAt[i * 2 + 1] = cy + oy + gy + (Math.cos(sec * 0.27 + ph * 1.3) * sway + Math.cos(sec * 0.71 + ph) * 2) * k + Math.sin(sec * (0.45 + (i % 4) * 0.13) + i * 2.3 + s.id) * 2.4 * k
    }
    const fa = (1 - rev) * appear
    if (fa > 0.01) {
      c.strokeStyle = ink
      c.fillStyle = ink
      c.lineWidth = 1.8
      c.globalAlpha = (strong ? 0.36 : 0.2) * fa
      c.beginPath()
      for (const [i, j] of w.edges) { c.moveTo(nodeAt[i * 2]!, nodeAt[i * 2 + 1]!); c.lineTo(nodeAt[j * 2]!, nodeAt[j * 2 + 1]!) }
      c.stroke()
      c.globalAlpha = (strong ? 0.85 : 0.5) * fa
      c.beginPath()
      for (let i = 0; i < w.offs.length; i++) { const r = (i === 0 ? 1.7 : 1) * (rd * 1.5 + 1.4); c.moveTo(nodeAt[i * 2]! + r, nodeAt[i * 2 + 1]!); c.arc(nodeAt[i * 2]!, nodeAt[i * 2 + 1]!, r, 0, TAU) }
      c.fill()
    }
    const ca = rev * appear
    if (ca > 0.01) {
      const col = colourOf(s)
      const ink2 = mixHex(ink, col, smooth(0, 0.75, rev))
      f.strokeStyle = ink2
      f.fillStyle = ink2
      f.lineWidth = 1
      f.globalAlpha = 0.3 * smooth(0.35, 1, rev) * appear
      f.beginPath()
      w.edges.forEach(([i, j], n) => {
        const ax2 = nodeAt[i * 2]!
        const ay2 = nodeAt[i * 2 + 1]!
        const bx2 = nodeAt[j * 2]!
        const by2 = nodeAt[j * 2 + 1]!
        const bow = (((n * 0.618 + s.id * 0.37) % 1) - 0.5) * 0.7
        f.moveTo(ax2, ay2)
        f.quadraticCurveTo((ax2 + bx2) / 2 - (by2 - ay2) * bow, (ay2 + by2) / 2 + (bx2 - ax2) * bow, bx2, by2)
      })
      f.stroke()
      f.globalAlpha = ca * (hot > 1 ? 1 : 0.9)
      f.beginPath()
      for (let i = 0; i < w.offs.length; i++) { const r = (i === 0 ? 1.5 : 1) * rd * hot; f.moveTo(nodeAt[i * 2]! + r, nodeAt[i * 2 + 1]!); f.arc(nodeAt[i * 2]!, nodeAt[i * 2 + 1]!, r, 0, TAU) }
      f.fill()
      // A signal now and then along two of its lines: the web is a network, something moves in it.
      if (rev > 0.9 && sec && w.edges.length) {
        f.fillStyle = col
        for (let n = 0; n < 2; n++) {
          const [i, j] = w.edges[(s.id * (7 + n * 6) + n * 5) % w.edges.length]!
          const t = (sec * (0.16 + n * 0.05) + s.id * 0.37 + n * 0.5) % 1
          const ax2 = nodeAt[i * 2]!
          const ay2 = nodeAt[i * 2 + 1]!
          const bx2 = nodeAt[j * 2]!
          const by2 = nodeAt[j * 2 + 1]!
          const nn = w.edges.findIndex(([a, b]) => a === i && b === j)
          const bow = (((nn * 0.618 + s.id * 0.37) % 1) - 0.5) * 0.7
          const mx = (ax2 + bx2) / 2 - (by2 - ay2) * bow
          const my = (ay2 + by2) / 2 + (bx2 - ax2) * bow
          const u = 1 - t
          f.globalAlpha = Math.sin(t * Math.PI) * 0.9
          f.beginPath()
          f.arc(u * u * ax2 + 2 * u * t * mx + t * t * bx2, u * u * ay2 + 2 * u * t * my + t * t * by2, 1.8, 0, TAU)
          f.fill()
        }
      }
    }
  }
  // The dashed arcs of the themes of the webs show with the webs.
  const shown = webs.length ? cleared / webs.length : 0
  if (shown > 0.02) {
    const issues = new Set<number>()
    for (const s of webs) issues.add(s.issue)
    f.lineWidth = 1.2
    f.setLineDash([2, 5])
    for (const k of issues) {
      const arcs = arcsOf(world!, k)
      if (!arcs.length) continue
      const slot = world!.slotOf.get(k)
      f.strokeStyle = slot ? cats[slot - 1] ?? mute : mute
      f.globalAlpha = 0.5 * shown
      f.beginPath()
      for (const arc of arcs) arcOf(f, arc.a, arc.b, arc.sign, sec)
      f.stroke()
    }
    f.setLineDash([])
  }
  // The rings: where a click was, the edge of its wave; before the first click an invitation, a ring that goes out from the largest web now and then.
  f.strokeStyle = ink
  f.lineWidth = 1
  for (const src of heroSources) {
    const reach = HERO_SPEED * (now - src.t0) / 1000
    const max = heroReach(width, height)
    if (reach <= 0 || reach >= max) continue
    const at = toScreen(cam, width, height, src)
    f.globalAlpha = 0.16 * (1 - reach / max)
    f.beginPath()
    f.arc(at.x, at.y, reach, 0, TAU)
    f.stroke()
  }
  if (!heroSources.length && !reduced.value && sec > HINT_AFTER && lantern.v < 0.05 && webs.length) {
    const t = ((sec - HINT_AFTER) % HINT_EVERY) / 2.4
    if (t < 1) {
      const at = toScreen(cam, width, height, webs[0]!)
      const dd = drift(webs[0]!, sec)
      f.globalAlpha = 0.22 * (1 - t) * appearAll
      f.beginPath()
      f.arc(at.x + dd.x, at.y + dd.y, 20 + 150 * (1 - Math.pow(1 - t, 3)), 0, TAU)
      f.stroke()
    }
  }
  c.globalAlpha = 1
  f.globalAlpha = 1
}

// Leaving Home for a view, the last frame of the hero is not cut: a copy of the two canvases stays where it was, as blurred as it was, and fades out while the camera flies.
let wasHome = false
const HERO_SNAP_MS = 800
const keepHeroFrame = () => {
  const stage = canvas.value?.parentElement
  if (!stage || !canvas.value || !canvasFocus.value || reduced.value) return
  const copies = [canvas.value, canvasFocus.value].map((source, i) => {
    const copy = document.createElement('canvas')
    copy.width = source.width
    copy.height = source.height
    copy.getContext('2d')?.drawImage(source, 0, 0)
    copy.className = `plegma-canvas plegma-hero-snap${i === 0 ? ' is-fog' : ''}`
    stage.append(copy)
    return copy
  })
  requestAnimationFrame(() => requestAnimationFrame(() => copies.forEach(copy => copy.classList.add('is-out'))))
  window.setTimeout(() => copies.forEach(copy => copy.remove()), HERO_SNAP_MS + 100)
}
// Picking a story on a theme (its card or its node), the web of the theme is not cut: a copy of the last frame dives into the story's node, which comes to the middle of the map
// region and grows, and fades out as the web of the story grows in its place. `wasTheme` is the theme in view in the last frame; `diveSpot` is its story nodes' places.
let wasTheme = false
const diveSpot = new Map<number, PlegmaPoint>()
const DIVE_MS = 900
const DIVE_SCALE = 3.4
const diveInto = (at: PlegmaPoint) => {
  const stage = canvas.value?.parentElement
  if (!stage || !canvas.value || !canvasFocus.value || reduced.value || !plegma.region) return
  const rb = regionBox(width, height, plegma.region)
  ;[canvas.value, canvasFocus.value].forEach((source, i) => {
    const copy = document.createElement('canvas')
    copy.width = source.width
    copy.height = source.height
    copy.getContext('2d')?.drawImage(source, 0, 0)
    copy.className = `plegma-canvas plegma-dive-snap${i === 0 ? ' is-back' : ''}`
    copy.style.transformOrigin = `${at.x}px ${at.y}px`
    stage.append(copy)
    copy.animate([
      { transform: 'translate(0, 0) scale(1)', opacity: i === 0 ? 0.7 : 1 },
      { transform: `translate(${(rb.cx - at.x) * 0.7}px, ${(rb.cy - at.y) * 0.7}px) scale(${1 + (DIVE_SCALE - 1) * 0.6})`, opacity: i === 0 ? 0.7 : 1, offset: 0.55 },
      { transform: `translate(${rb.cx - at.x}px, ${rb.cy - at.y}px) scale(${DIVE_SCALE})`, opacity: 0, offset: 1 }
    ], { duration: DIVE_MS, easing: 'cubic-bezier(0.55, 0, 0.25, 1)', fill: 'forwards' }).finished.then(() => copy.remove(), () => copy.remove())
  })
}
const draw = (now: number) => {
  if (!ctx || !ctxFocus || !world) return
  const c = ctx
  const f = ctxFocus
  const homeNow = !focusStory() && focusIssue() === null && focusOutlet() === null && plegma.homeDay === null
  if (wasHome && !homeNow && plegma.active) keepHeroFrame()
  wasHome = homeNow
  const picked = focusStory()
  if (wasTheme && picked && plegma.active) {
    const at = diveSpot.get(picked.id)
    const to = at && !reduced.value && plegma.region ? targetCamera() : null
    if (at && to) {
      // The copy covers the cut: the camera is at the story at once, so its web grows under the dive, and the cards wait for the dive to be half done.
      diveInto(at)
      Object.assign(cam, to)
      flight = null
      window.setTimeout(() => plegma.setLanded(true), DIVE_MS * 0.5)
    }
  }
  wasTheme = false
  for (const g of [c, f]) { g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, width, height) }
  const z = cam.z
  const sec = reduced.value ? 0 : now / 1000
  const dt = Math.min(0.1, Math.max(0, (now - lastNow) / 1000))
  lastNow = now
  if (plegma.highlight) hlLast = plegma.highlight
  hlMix = ease(hlMix, plegma.highlight ? 1 : 0, dt)
  ringMix = reduced.value ? (plegma.ring === 'stance' ? 1 : 0) : ringMix + ((plegma.ring === 'stance' ? 1 : 0) - ringMix) * (1 - Math.exp(-dt * 4))
  for (const [key, v] of ringHot) {
    const next = ease(v, key === hoverRing ? 1 : 0, dt)
    if (next < 0.005 && key !== hoverRing) ringHot.delete(key)
    else ringHot.set(key, next)
  }
  if (hoverRing && !ringHot.has(hoverRing)) ringHot.set(hoverRing, 0)
  if (plegma.hoverStory !== null) lineLast = plegma.hoverStory
  lineMix = ease(lineMix, plegma.hoverStory !== null ? 1 : 0, dt)
  const story = focusStory()
  const other = plegma.compare !== null ? world.byId.get(plegma.compare) ?? null : null
  const issue = focusIssue()
  const outletOn = focusOutlet() !== null
  const onHome = !story && issue === null && !outletOn && plegma.homeDay === null
  if (onHome) { push = null; introKey = ''; introAt = -1; drawHero(now, sec, dt); return }
  // The intro of the web in view: it waits for the camera and for the view's free area, then grows (see INTRO_MS).
  const key = story ? `s${story.id}` : outletOn ? `o${focusOutlet()}` : issue !== null ? `t${issue}` : ''
  if (key !== introKey) { introKey = key; introAt = -1 }
  if (introAt < 0 && key && plegma.region && (!flight || (now - flight.t0) / Math.max(flight.dur, 1) >= INTRO_AT)) introAt = now
  introP = !key || reduced.value ? 1 : introAt < 0 ? 0 : clamp((now - introAt) / INTRO_MS, 0, 1)
  nodeIn = smooth(0, 0.18, introP)
  lineIn = smooth(0.3, 0.85, introP)
  ringIn = smooth(0.55, 1, introP)
  // The theme that is lit: the one of the story or the theme in focus, or the one under the pointer.
  const lit = hover ? hover.issue : story ? story.issue : issue
  const litCoded = lit !== null && !world.issues[lit]!.catchAll
  const core = issue !== null ? coreOf(issue) : story?.coded ? spokeSet(story.issue) : EMPTY
  const homeSet = new Set(webs)
  const dim = onHome ? 0.38 : issue !== null || outletOn ? 0.13 : 0.2
  push = story ? { s: story, r: articleWorldRadius(story) * 1.25 + CLEAR_PAD } : null
  const bz = onHome ? z : BACK_Z
  // The background is seen from the web: the world point at the middle of the map region stays there, and the world around it is drawn at the far zoom.
  const rb = regionBox(width, height, plegma.region ?? undefined)
  const fx = cam.x + (rb.cx - width / 2) / z
  const fy = cam.y + (rb.cy - height / 2) / z
  const dotBuckets: ({ colour: string, alpha: number, path: Path2D } | undefined)[] = []
  const drawn: { s: PlegmaStory, level: 1 | 2, alpha: number, focus: boolean, crisp: boolean }[] = []

  for (const s of visible(80, Math.min(z, bz))) {
    const isFocus = s === story || s === other
    const strong = isFocus || homeSet.has(s) || core.has(s) || s === hover
    // In a theme view the web is the theme: the map behind it is all background.
    const sameTheme = issue === null && !outletOn && litCoded && s.issue === lit && s.coded
    const alpha = strong ? 1 : onHome ? dim : sameTheme ? 0.7 : 0.55
    // In a view the story, its pair, the stories of the theme and the one under the pointer are crisp; the rest is a blurred background of dots with no lines.
    const crisp = !onHome && (isFocus || core.has(s) || s === hover)
    // Not in view, a story is the background: a dot of the world seen from far away, across the whole page, with no hole around the web.
    const back = !onHome && !strong
    const zz = back ? bz : z
    const base = back ? 0 : drawLevel(s, z, strong, isFocus)
    // On Home the webs of the week have their lines at the zoom that frames them all, and are drawn no smaller than at zoom 1.1 so that each one reads.
    const level = back ? 0 : onHome ? (base > 0 && homeSet.has(s) ? 2 : base) : issue !== null || outletOn ? 0 : crisp ? base : (Math.min(base, 1) as 0 | 1 | 2)
    // Zoomed far out, the smallest stories are faint specks that only cost drawing time: leave them out until the camera is nearer.
    if (level === 0 && zz < 0.3 && !strong && !sameTheme && s.n < PLEGMA_FAR_MIN) continue
    if (level === 0) {
      const r = isFocus ? 4 : clamp(0.7 + 0.35 * Math.log10(s.n + 1) * (zz < 0.22 ? 1.4 : 1.8) * Math.sqrt(Math.max(zz, 0.5)), 0.8, 5)
      const key = s.slot * 3 + (strong ? 2 : sameTheme ? 1 : 0)
      let bucket = dotBuckets[key]
      if (!bucket) { bucket = { colour: colourOf(s), alpha, path: new Path2D() }; dotBuckets[key] = bucket }
      const where = back ? s : placed(s)
      const bx = back ? (s.x - fx) * bz : (where.x - cam.x) * zz
      const by = back ? (s.y - fy) * bz : (where.y - cam.y) * zz
      const dd = (onHome || back) && sec ? orbit(bx, by, sec) : null
      const px = bx + (back ? rb.cx : width / 2) + (dd ? dd.x : 0)
      const py = by + (back ? rb.cy : height / 2) + (dd ? dd.y : 0)
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
  if (issue !== null || outletOn) drawTheme(f, sec, dt)
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
let walkAt = 0
const frame = (now: number) => {
  raf = 0
  if (!running()) return
  if (flight) {
    Object.assign(cam, cameraAt(flight, now, width))
    if (flightDone(flight, now)) { flight = null; plegma.setLanded(true) }
  }
  // A step toward a click in the hero eases in, with no pull back: it is a step, not a flight.
  if (walk && !flight) {
    const k = 1 - Math.exp(-Math.min(0.1, Math.max(0, (now - walkAt) / 1000)) * 2.6)
    cam.x += (walk.x - cam.x) * k
    cam.y += (walk.y - cam.y) * k
    cam.z *= Math.pow(walk.z / cam.z, k)
    if (Math.abs(walk.x - cam.x) < 0.5 && Math.abs(walk.y - cam.y) < 0.5 && Math.abs(walk.z / cam.z - 1) < 0.002) { Object.assign(cam, walk); walk = null }
  }
  walkAt = now
  draw(now)
  if (!reduced.value || flight || walk) raf = requestAnimationFrame(frame)
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
  walk = null
  const to = targetCamera()
  if (to) { if (flight) flight = redirectFlight(flight, cam, to, performance.now(), width, reduced.value); else { Object.assign(cam, to); plegma.setLanded(true) } }
  kick()
}

// ---- the pointer ----
// The stage is behind the page, so the pointer is read on the window; a card, a link or a control under it is not the map.
const CAPTURES = 'a, button, input, select, textarea, [role="dialog"], .dcard, .plegma-card, .plegma-day, .plegma-title, .plegma-dock, .kpi-tile, .page-head, .section-nav, .trail-bar, .header-bar, .sidebar, .page-footer, .tooltip'
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
  lantern.on = false
  if (!hover && hoverArticle < 0 && hoverNode < 0 && !hoverRing) return
  hover = null
  hoverArticle = -1
  hoverNode = -1
  hoverRing = ''
  tooltip.hide()
  if (reduced.value) kick()
}
useEventListener(window, 'pointermove', (e: PointerEvent) => {
  if (!plegma.active || !world || e.pointerType === 'touch' || !pointerFine.value || phone.value) return
  if ((e.target as Element | null)?.closest?.(CAPTURES)) return leave()
  const p = local(e)
  // In the hero the pointer is a lantern: a small patch of the ground under it clears.
  const inHero = plegma.focus === null && plegma.homeDay === null
  lantern.on = inHero && !reduced.value
  if (lantern.on) { lantern.x = p.x; lantern.y = p.y }
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
      // A node that stands for an article of the sample of headlines (or for several, one of which is in it) has the title of that article, with its outlet and day under it.
      const nodes = nodeCount(story.n)
      const from = Math.floor((i * story.n) / nodes)
      const to = Math.max(from + 1, Math.floor(((i + 1) * story.n) / nodes))
      let titled: typeof article | undefined
      for (let k = from; k < to && !titled; k++) if (list[k]!.title) titled = list[k]
      const group = article.group ?? t('story.nogroup')
      const date = fmtDate(world.dates[(titled ?? article).day]!)
      tooltip.show(titled
        ? {
            title: titled.title!,
            rows: [
              { label: titled.outlet, value: date, color: `var(--cat-${titled.slot})` },
              { label: titled.group ?? t('story.nogroup'), value: '' },
              ...(per > 1 ? [{ label: t('story.nodes.per'), value: fmtInt(per) }] : [])
            ],
            field: true
          }
        : {
            title: article.outlet,
            rows: [
              { label: group, value: date, color: `var(--cat-${article.slot})` },
              ...(per > 1 ? [{ label: t('story.nodes.per'), value: fmtInt(per) }] : [])
            ],
            field: true
          }, e)
      return
    }
    if (hoverArticle >= 0) { hoverArticle = -1; if (reduced.value) kick() }
    const arc = ringAt(story, p.x, p.y)
    if (arc) {
      const key = `${arc.kind}${arc.k}`
      if (hoverRing !== key && reduced.value) kick()
      hover = null
      hoverRing = key
      if (arc.kind === 'g') {
        const mine = list.filter(x => x.order === arc.k)
        const first = mine[0]
        tooltip.show({
          title: first?.group ?? t('story.nogroup'),
          rows: [{ label: t('home.field.articles'), value: `${fmtInt(mine.length)} · ${fmtPct(mine.length / list.length)}`, color: `var(--cat-${first?.slot ?? 0})` }],
          field: true
        }, e)
      } else {
        const counts = plegma.stance!
        const total = counts.reduce((x, y) => x + y, 0)
        tooltip.show({
          title: t(`stance.${['critical', 'neutral', 'supportive'][arc.k]}`),
          rows: [{ label: t('home.field.articles'), value: `${fmtInt(counts[arc.k]!)} · ${fmtPct(counts[arc.k]! / total)}`, color: `var(--stance-${['critical', 'neutral', 'supportive'][arc.k]})` }],
          field: true
        }, e)
      }
      return
    }
    if (hoverRing) { hoverRing = ''; tooltip.hide(); if (reduced.value) kick() }
  }
  // On the web of a theme the pointer finds a story or an outlet of a story; on the web of an outlet, a story or a day of it.
  if (webFocus()) {
    const i = themeNodeAt(p.x, p.y)
    const web = themeWebOf()
    if (i > 0 && web) {
      if (hoverNode !== i && reduced.value) kick()
      hover = null
      hoverNode = i
      const s = web.stories[web.story[i]!]!
      const o = web.outlet[i]! >= 0 ? s.outlets[web.outlet[i]!]! : null
      const mineOutlet = focusOutlet() !== null
      tooltip.show(mineOutlet
        ? o
          ? { title: s.name, rows: [{ label: o.name, value: fmtInt(o.n), color: `var(--cat-${s.slot ?? 0})` }], field: true }
          : { title: s.name, rows: [{ label: t('home.field.topic'), value: s.theme ?? '', color: `var(--cat-${s.slot ?? 0})` }, { label: t('home.field.articles'), value: fmtInt(s.n) }], field: true }
        : o
          ? { title: o.name, rows: [{ label: o.group ?? t('story.nogroup'), value: '', color: `var(--cat-${o.slot})` }, { label: s.name, value: fmtInt(o.n) }], field: true }
          : { title: s.name, rows: [{ label: t('home.field.articles'), value: fmtInt(s.n) }, { label: t('entity.fact.outlets'), value: fmtInt(s.media) }], field: true }, e)
      return
    }
    if (hoverNode >= 0) { hoverNode = -1; if (reduced.value) kick() }
    const arc = themeRingAt(p.x, p.y)
    if (arc) {
      const key = `${arc.kind}${arc.k}`
      if (hoverRing !== key && reduced.value) kick()
      hover = null
      hoverRing = key
      if (arc.kind === 'g') {
        const groups = plegma.themeGroups!
        const mine = groups[arc.k]!
        tooltip.show({
          title: mine.name,
          rows: [{ label: t('home.field.articles'), value: `${fmtInt(mine.n)} · ${fmtPct(mine.n / groups.reduce((x, y) => x + y.n, 0))}`, color: `var(--cat-${mine.slot})` }],
          field: true
        }, e)
      } else {
        const counts = plegma.stance!
        const total = counts.reduce((x, y) => x + y, 0)
        tooltip.show({
          title: t(`stance.${['critical', 'neutral', 'supportive'][arc.k]}`),
          rows: [{ label: t('home.field.articles'), value: `${fmtInt(counts[arc.k]!)} · ${fmtPct(counts[arc.k]! / total)}`, color: `var(--stance-${['critical', 'neutral', 'supportive'][arc.k]})` }],
          field: true
        }, e)
      }
      return
    }
    if (hoverRing) { hoverRing = ''; tooltip.hide(); if (reduced.value) kick() }
  }
  const best = pickAt(p.x, p.y, 14)
  if (!best) return leave()
  // Ground that is still black has nothing to tell yet.
  if (inHero && !heroCleared && (heroRev.get(best.id) ?? 0) < 0.9) { hover = null; tooltip.hide(); return }
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
  if (!plegma.active || !world || e.button !== 0 || e.defaultPrevented) return
  if ((e.target as Element | null)?.closest?.(CAPTURES)) return
  const box = canvas.value!.getBoundingClientRect()
  const p = { x: e.clientX - box.left, y: e.clientY - box.top }
  // In the hero a click explores: it opens no story (any pointer, a phone too).
  if (plegma.focus === null && plegma.homeDay === null) { explore(p.x, p.y); return }
  if (!pointerFine.value || phone.value || hoverArticle >= 0 || hoverRing) return
  // A story of the web of a theme opens that story.
  const web = webFocus() ? themeWebOf() : null
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
  weekWebs = homeWebs(world, ix, phone.value ? HOME_WEBS_PHONE : HOME_WEBS, lastCoded)
  webs = plegma.homeDay === null ? weekWebs : []
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
// Home under the hero picked a day (the map steps back to a dim background) or went back to the hero (the camera frames the best of the week again).
watch(() => plegma.homeDay, (day, was) => {
  if (!world) return
  webs = day === null ? weekWebs : []
  if (day === null && was !== null && plegma.active) fly()
  kick()
})
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
  <div class="plegma-stage" :class="{ 'is-view': plegma.focus !== null || plegma.homeDay !== null, 'is-fog': fogged && plegma.focus === null && plegma.homeDay === null, 'is-off': !plegma.active }" aria-hidden="true">
    <canvas ref="canvas" class="plegma-canvas plegma-canvas-back" />
    <canvas ref="canvasFocus" class="plegma-canvas plegma-canvas-focus" />
  </div>
</template>
