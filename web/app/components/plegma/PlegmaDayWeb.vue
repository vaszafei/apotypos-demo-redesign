<script setup lang="ts">
import { useEventListener, useMediaQuery, useRafFn } from '@vueuse/core'
import { blendHex } from '~/utils/ink'
import { buildDayWeb, DAY_DATE, DAY_DOT, DAY_REST, DAY_STORY, DAY_THEME, matchWebs, storiesAsThemes } from '~/utils/plegma/plegma-day'
import type { PlegmaDayTheme, PlegmaDayWeb } from '~/utils/plegma/plegma-day'
import { NAME_MAX, drawColumns } from '~/utils/plegma/stage/stage-names'
import type { NameItem } from '~/utils/plegma/stage/stage-names'

// The web of a day on Home, drawn in the free area under the calendar (utils/plegma/plegma-day.ts has the layout): the date at the center, the themes of the day around it, the largest stories of each
// theme, and a dot for each article of a story. It has the look of the web of a theme (components/PlegmaStage.vue drawTheme): solid nodes with a rim of the page's color, the calm colors of the
// groups, thin curved lines, a slow drift. A story on it is picked with a click and takes the card. The Plegma stage is behind it, as a dim map.
// The web has two forms, `mode`: the stories of the day around the date (the ring around it has an arc for each outlet, as wide as its share of the articles of the day, in the color of its
// group), and the themes of the day, each with its stories (the ring has an arc for each theme; a theme with no color of its own is gray). The nodes of a story and its dots are the same
// in both, so a change of `mode` moves them from one place to the other, the themes and the faint dots fade in or out, and the ring turns into the other ring. In the form of the themes a
// theme pointed at, on the ring, on the web or in the list beside it (`lit`), comes forward.
const GROW_MS = 1400
export interface DayRing { issue: number, name: string, slot: number, n: number }
export interface DayOutlet { name: string, slot: number, n: number, group?: string | null }
// The pages of Μέσα use it for a period too: `date` is then the text at the center (a count, with `sub` under it), `labels` the most theme names it writes (the largest first),
// `themeLabel` names the theme in the tooltip of a story when the themes are something else (the groups of Ιδιοκτησία, whose stories are their outlets: a story with no `media` has no row of them),
// `spread` that many themes go round the center by the golden angle (utils/plegma/plegma-day.ts), `zoom` the share of the area the web fills (the ring included), `shares` that a theme is as large as its share
// of the ring (the area of its node is its articles), `ellipse` that the ring is an ellipse as wide as the area allows (the web lies in it, and the arcs of the outlets are named with their share outside it), `grouped` that the stories are grouped by their themes (the nodes of the themes and their names) while the ring stays the outlets; and `shares` that a theme is as large as its share
// of the ring (the area of its node is its articles) and its share is written after its name and in its tooltip, `growMs` how long the growth takes, `hoverStory` the id of a story that is pointed at in a list beside the web (it is lit and its title is written at its circle, as when the pointer is on it), `names` that it has the look of the web of a story and of a theme (components/PlegmaStage.vue: a story is a gray circle as large as its articles, a dot a small ring in the color of its group, no lines from the center to the stories, the names of the arcs in two columns beside the ring), `grow` that the web grows out of the center when it comes into view and again when its data changes, and `label` the name of the picture for a screen reader.
const props = withDefaults(defineProps<{ themes: PlegmaDayTheme[], ring: DayRing[], outlets: DayOutlet[], mode: 'stories' | 'themes', lit: number | null, date: string, picked: number | null, active: boolean, sub?: string, labels?: number, grow?: boolean, label?: string, spread?: boolean, themeLabel?: string, zoom?: number, shares?: boolean, ellipse?: boolean, grouped?: boolean, names?: boolean, hoverStory?: number | null, growMs?: number }>(), { sub: undefined, labels: Infinity, grow: false, label: undefined, spread: false, themeLabel: undefined, zoom: 1, shares: false, ellipse: false, grouped: false, names: false, hoverStory: null, growMs: GROW_MS })
const emit = defineEmits<{ pick: [id: number], pickTheme: [issue: number], 'update:lit': [issue: number | null] }>()
const { t } = useI18n()
const tooltip = useTooltipStore()
const prefs = usePrefsStore()
const reduced = useMediaQuery('(prefers-reduced-motion: reduce)')
const TAU = Math.PI * 2
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))

const box = ref<HTMLElement>()
const canvas = ref<HTMLCanvasElement>()
let ctx: CanvasRenderingContext2D | null = null
let width = 0
let height = 0
const size = ref({ w: 0, h: 0 })

// The colors are tokens, read when the theme changes.
let ink = '#111'
let mute = '#6b6f78'
let paper = '#f6f4ef'
let fontText = 'system-ui, sans-serif'
let cats: string[] = []
let groupInk: string[] = []
let softInk: string[] = []
const readTokens = () => {
  const style = getComputedStyle(document.documentElement)
  ink = style.getPropertyValue('--ink').trim() || ink
  mute = style.getPropertyValue('--text-secondary').trim() || mute
  paper = style.getPropertyValue('--surface-page').trim() || paper
  fontText = style.getPropertyValue('--font-text').trim() || fontText
  cats = Array.from({ length: 8 }, (_, i) => style.getPropertyValue(`--cat-${i + 1}`).trim() || mute)
  groupInk = Array.from({ length: 10 }, (_, i) => style.getPropertyValue(`--cat-${i}`).trim() || mute)
  softInk = groupInk.map(c => (/^#[0-9a-f]{6}$/i.test(c) && /^#[0-9a-f]{6}$/i.test(groupInk[0]!) ? blendHex(c, groupInk[0]!, 0.7) : c))
}
// With many themes (`spread`) the ones with no color of their own are the light gray of the page's charts, so the colored ones stand out.
const slotColour = (slot: number) => (slot > 0 ? cats[slot - 1] ?? mute : props.spread ? groupInk[0] ?? mute : mute)

// The layout is the same for the same day; it is drawn again when the area changes shape.
// The web lies inside the ring, which is a circle: the layout is on the unit disc.
// With `ellipse` the layout box is `aspect` times as wide as it is high, and the ring is the ellipse that holds it, with room for the names of the arcs on the sides.
const aspect = computed(() => {
  if (!size.value.h) return 0
  if (!props.ellipse) return 1
  const ry = size.value.h / 2 * 0.8 - 10
  return Math.round(clamp((size.value.w / 2 - 100) / ry, 1, 2.1) * 20) / 20
})
const seed = computed(() => [...props.date].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 9973, 7))
const web = computed<PlegmaDayWeb | null>(() => (props.themes.length && aspect.value ? buildDayWeb(props.themes, aspect.value, seed.value, props.spread) : null))
// The same stories with no themes between them, and which node of it each node of `web` is.
const flat = computed(() => {
  const w = web.value
  if (!w || !aspect.value) return null
  const themes = storiesAsThemes(props.themes)
  const b = buildDayWeb(themes, aspect.value, seed.value, props.spread)
  return { b, match: matchWebs(props.themes, w, themes, b) }
})

let hx = new Float32Array(0)
let hy = new Float32Array(0)
let hover = -1
let hoverRing = -2
let mix = 0
let litStory = -1
let titleKey = -1
let titleMix = 0
let tmix = 0
// 0 for the form of the stories, 1 for the form of the themes; `form` is the same eased, for the places and the fades.
let themed = props.mode === 'themes' || (props.grouped && props.names) ? 1 : 0
let form = themed
let litTheme = -1
const arcHot = new Map<string, number>()
let last = 0
// The growth out of the center (`grow`): the time it started, or -1 before it starts; the themes come first, then the stories, then the dots, and the ring is drawn round.
let growAt = -1
let grown = 1
const growOf = (kind: number) => {
  const d = kind === DAY_THEME ? 0 : kind === DAY_STORY ? 0.14 : kind === DAY_REST ? 0.22 : kind === DAY_DOT ? 0.3 : 0
  const k = clamp((grown - d) / (1 - d), 0, 1)
  return 1 - (1 - k) ** 3
}
const ringTotal = computed(() => props.ring.reduce((sum, r) => sum + r.n, 0))
const shareOf = (n: number) => (ringTotal.value ? ` ${fmtPct(n / ringTotal.value)}` : '')
const ringN = (issue: number) => props.ring.find(r => r.issue === issue)?.n ?? 0
const storyOf = (w: PlegmaDayWeb, i: number) => props.themes[w.theme[i]!]!.stories[w.story[i]!]!
// The ring is as large as the area allows, and the web is a little smaller inside it; with `names` the two columns of names beside it need NAMES_ROOM on each side.
const NAMES_ROOM = 170
const ringOf = () => (props.ellipse ? Math.min(height / 2 * 0.8 - 10, (width / 2 - 100) / Math.max(1, aspect.value)) : props.names ? Math.max(80, Math.min(height / 2 * 0.9 - 10, width / 2 - NAMES_ROOM)) : (Math.min(width, height) / 2 * 0.9 - 10)) * props.zoom
const ringRx = () => ringOf() * (props.ellipse ? aspect.value : 1)
// Where a share of the ring is: the arcs are as long as their shares along the ellipse (the table gives the angle of the ellipse for the length from the top).
const perim = computed(() => {
  const rx = ringRx()
  const ry = ringOf()
  const N = 720
  const cum = new Float32Array(N + 1)
  for (let k = 1; k <= N; k++) { const a = ((k - 0.5) / N) * TAU; cum[k] = cum[k - 1]! + Math.hypot(rx * Math.sin(a), ry * Math.cos(a)) * (TAU / N) }
  return cum
})
const paramOf = (frac: number) => {
  const cum = perim.value
  const N = cum.length - 1
  const target = clamp(frac, 0, 1) * cum[N]!
  let lo = 0
  let hi = N
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (cum[mid]! < target) lo = mid; else hi = mid }
  const span = cum[hi]! - cum[lo]! || 1
  return ((lo + (target - cum[lo]!) / span) / N) * TAU
}
const fracOf = (param: number) => {
  const cum = perim.value
  const N = cum.length - 1
  const k = clamp((param / TAU) * N, 0, N)
  const lo = Math.floor(k)
  return (cum[lo]! + (cum[Math.min(N, lo + 1)]! - cum[lo]!) * (k - lo)) / cum[N]!
}
const scaleOf = () => ringOf() - 22
const radius = (w: PlegmaDayWeb, i: number, R: number) => {
  switch (w.kind[i]) {
    case DAY_DATE: return 9
    case DAY_THEME: return props.shares ? Math.max(4.5, 21 * w.size[i]!) : props.themes.length > 12 ? 2.6 + 6 * w.size[i]! : 6.5 + 4 * w.size[i]!
    case DAY_STORY: return props.names ? 3.5 + 8.5 * w.size[i]! : 3.6 + 3.4 * w.size[i]!
    case DAY_DOT: return clamp(R * (0.004 + 0.0085 * w.size[i]!), 1.4, 5.2) * (props.names ? 0.82 : 1)
    default: return clamp(R * 0.004 * (0.6 + w.size[i]!), 1, 2.2)
  }
}
const layout = (w: PlegmaDayWeb, sec: number) => {
  if (hx.length < w.n) { hx = new Float32Array(w.n); hy = new Float32Array(w.n) }
  const R = scaleOf()
  const amp = clamp(R * 0.014, 1.5, 6)
  const f = flat.value
  for (let i = 0; i < w.n; i++) {
    const a = sec * w.speed[i]! + w.phase[i]!
    const k = w.kind[i] === DAY_DATE ? 0 : w.kind[i] === DAY_THEME ? 0.5 : w.kind[i] === DAY_STORY ? 0.7 : w.reach[i]!
    const j = f ? f.match[i]! : -1
    const px = j >= 0 ? f!.b.x[j]! + (w.x[i]! - f!.b.x[j]!) * form : w.x[i]!
    const py = j >= 0 ? f!.b.y[j]! + (w.y[i]! - f!.b.y[j]!) * form : w.y[i]!
    const e = grown < 1 ? growOf(w.kind[i]!) : 1
    hx[i] = width / 2 + (px * R + Math.cos(a) * amp * k) * e
    hy[i] = height / 2 + (py * R + Math.sin(a) * amp * k) * e
  }
  return R
}

const draw = (sec: number, dt: number) => {
  const w = web.value
  if (!ctx || !w || !width) return
  const g = ctx
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  g.setTransform(dpr, 0, 0, dpr, 0, 0)
  g.clearRect(0, 0, width, height)
  grown = growAt < 0 ? (props.grow && !reduced.value ? 0 : 1) : clamp((performance.now() - growAt) / props.growMs, 0, 1)
  g.globalAlpha = 1
  const goal = props.mode === 'themes' || props.grouped ? 1 : 0
  themed = reduced.value ? goal : themed + (goal - themed) * (1 - Math.exp(-dt * 3))
  if (Math.abs(goal - themed) < 0.002) themed = goal
  form = themed * themed * (3 - 2 * themed)
  const R = layout(w, reduced.value ? 0 : sec)
  // What is lit: the story pointed at, or the one picked; the others step back.
  const pointedStory = hover > 0 && (w.kind[hover] === DAY_STORY || w.kind[hover] === DAY_DOT) ? w.theme[hover]! * 100 + w.story[hover]! : null
  const pickedStory = props.picked !== null ? props.themes.flatMap((th, ti) => th.stories.map((s, si) => ({ id: s.id, key: ti * 100 + si }))).find(r => r.id === props.picked)?.key ?? null : null
  const listedStory = props.hoverStory !== null ? props.themes.flatMap((th, ti) => th.stories.map((s, si) => ({ id: s.id, key: ti * 100 + si }))).find(r => r.id === props.hoverStory)?.key ?? null : null
  const titled = pointedStory ?? listedStory
  const lit = titled ?? pickedStory
  if (lit !== null) litStory = lit
  if (titled !== null) titleKey = titled
  titleMix = reduced.value ? (titled !== null ? 1 : 0) : titleMix + ((titled !== null ? 1 : 0) - titleMix) * (1 - Math.exp(-dt * 9))
  mix = reduced.value ? (lit !== null ? 1 : 0) : mix + ((lit !== null ? 1 : 0) - mix) * (1 - Math.exp(-dt * 9))
  // A theme that is pointed at comes forward: the rest steps back, and the theme is drawn again at the end.
  const litIssue = form > 0.5 ? props.lit : null
  const themeAt = litIssue === null ? -1 : props.themes.findIndex(x => x.issue === litIssue)
  if (themeAt >= 0) litTheme = themeAt
  tmix = reduced.value ? (themeAt >= 0 ? 1 : 0) : tmix + ((themeAt >= 0 ? 1 : 0) - tmix) * (1 - Math.exp(-dt * 9))
  const back = (1 - 0.65 * mix) * (1 - 0.6 * tmix)
  const isLit = (i: number) => w.kind[i] !== DAY_DATE && w.kind[i] !== DAY_THEME && w.kind[i] !== DAY_REST && w.theme[i]! * 100 + w.story[i]! === litStory
  const curve = (path: Path2D, i: number, j: number, bow: number) => {
    const dx = hx[j]! - hx[i]!
    const dy = hy[j]! - hy[i]!
    path.moveTo(hx[i]!, hy[i]!)
    path.quadraticCurveTo((hx[i]! + hx[j]!) / 2 - dy * bow, (hy[i]! + hy[j]!) / 2 + dx * bow, hx[j]!, hy[j]!)
  }
  // The lines: the date to each theme (the ink), a theme to its stories (its color), and the small web of a story (the calm color of the group of the dot).
  g.lineCap = 'round'
  g.lineWidth = 1
  const spokes = new Path2D()
  const themeLines = new Map<number, Path2D>()
  const directLines = new Map<number, Path2D>()
  const lines = new Map<number, Path2D>()
  const litLines = new Path2D()
  for (let e = 0; e < w.bow.length; e++) {
    const i = w.edges[e * 2]!
    const j = w.edges[e * 2 + 1]!
    if (w.kind[i] === DAY_THEME) { curve(spokes, j, i, w.bow[e]!); continue }
    if (w.kind[i] === DAY_STORY) {
      const slot = props.themes[w.theme[i]!]!.slot
      let path = themeLines.get(slot)
      if (!path) { path = new Path2D(); themeLines.set(slot, path) }
      curve(path, j, i, w.bow[e]!)
      let direct = directLines.get(slot)
      if (!direct) { direct = new Path2D(); directLines.set(slot, direct) }
      curve(direct, 0, i, w.bow[e]!)
      continue
    }
    if (mix > 0.01 && isLit(i)) { curve(litLines, j, i, w.bow[e]!); continue }
    const slot = props.themes[w.theme[i]!]!.stories[w.story[i]!]!.dots[w.dot[i]!] ?? 0
    let path = lines.get(slot)
    if (!path) { path = new Path2D(); lines.set(slot, path) }
    curve(path, j, i, w.bow[e]!)
  }
  const lineIn = grown < 1 ? growOf(DAY_DOT) : 1
  g.strokeStyle = ink
  g.globalAlpha = 0.3 * (1 - 0.6 * tmix) * form * lineIn
  if (!props.names) g.stroke(spokes)
  if (form > 0.01) for (const [slot, path] of themeLines) { g.strokeStyle = slotColour(slot); g.globalAlpha = 0.45 * back * form * lineIn; g.stroke(path) }
  if (form < 0.99 && !props.names) for (const [slot, path] of directLines) { g.strokeStyle = slotColour(slot); g.globalAlpha = 0.45 * back * (1 - form) * lineIn; g.stroke(path) }
  for (const [slot, path] of lines) { g.strokeStyle = softInk[slot] ?? mute; g.globalAlpha = 0.6 * back * lineIn; g.stroke(path) }
  if (mix > 0.01) { g.strokeStyle = ink; g.globalAlpha = 0.45 * mix; g.stroke(litLines) }
  // The faint dots of the stories that are not shown: the color of their theme.
  const circle = (path: Path2D, i: number, r: number) => { path.moveTo(hx[i]! + r, hy[i]!); path.arc(hx[i]!, hy[i]!, r, 0, TAU) }
  const rest = new Map<number, Path2D>()
  for (let i = 0; i < w.n; i++) {
    if (w.kind[i] !== DAY_REST) continue
    const slot = props.themes[w.theme[i]!]!.slot
    let path = rest.get(slot)
    if (!path) { path = new Path2D(); rest.set(slot, path) }
    circle(path, i, radius(w, i, R))
  }
  for (const [slot, path] of rest) { g.fillStyle = slotColour(slot); g.globalAlpha = 0.4 * back * form; g.fill(path) }
  // The dots of the stories: a rim of the page's color under each, then the color of the group.
  const rims = new Path2D()
  const fills = new Map<number, Path2D>()
  const litDots: number[] = []
  for (let i = 0; i < w.n; i++) {
    if (w.kind[i] !== DAY_DOT) continue
    const r = radius(w, i, R)
    circle(rims, i, r + 0.9)
    if (mix > 0.01 && isLit(i)) { litDots.push(i); continue }
    const slot = storyOf(w, i).dots[w.dot[i]!] ?? 0
    let path = fills.get(slot)
    if (!path) { path = new Path2D(); fills.set(slot, path) }
    circle(path, i, r)
  }
  g.globalAlpha = 1
  g.fillStyle = paper
  g.fill(rims)
  // With `names` a dot is a small ring in the color of its group with nothing inside it (the dots pointed at, below, are solid).
  if (props.names) {
    g.lineWidth = clamp(R * 0.004, 1, 1.4)
    for (const [slot, path] of fills) { g.strokeStyle = slot > 0 ? groupInk[slot] ?? mute : mute; g.globalAlpha = back; g.stroke(path) }
    g.lineWidth = 1
  } else for (const [slot, path] of fills) { g.fillStyle = softInk[slot] ?? mute; g.globalAlpha = back; g.fill(path) }
  for (const i of litDots) {
    const slot = storyOf(w, i).dots[w.dot[i]!] ?? 0
    g.fillStyle = slot > 0 ? groupInk[slot] ?? ink : mute
    g.globalAlpha = 0.7 + 0.3 * mix
    g.beginPath()
    g.arc(hx[i]!, hy[i]!, radius(w, i, R) * (1 + 0.25 * mix), 0, TAU)
    g.fill()
  }
  // The stories, the themes and the date.
  for (let i = 0; i < w.n; i++) {
    if (w.kind[i] !== DAY_STORY && w.kind[i] !== DAY_THEME && w.kind[i] !== DAY_DATE) continue
    const fade = w.kind[i] === DAY_THEME ? form : 1
    if (fade < 0.01) continue
    const r = radius(w, i, R)
    g.globalAlpha = fade
    g.fillStyle = paper
    g.beginPath()
    g.arc(hx[i]!, hy[i]!, r + 1.6, 0, TAU)
    g.fill()
    g.globalAlpha = w.kind[i] === DAY_STORY && !isLit(i) ? back : fade
    g.beginPath()
    g.arc(hx[i]!, hy[i]!, r, 0, TAU)
    if (props.names) {
      // A story is a gray circle with nothing inside it (its size follows its articles), the date a gray one, a theme one in its color.
      g.strokeStyle = w.kind[i] === DAY_THEME ? slotColour(props.themes[w.theme[i]!]!.slot) : mute
      g.lineWidth = 2
      g.stroke()
      g.lineWidth = 1
    } else {
      g.fillStyle = w.kind[i] === DAY_DATE ? ink : slotColour(props.themes[w.theme[i]!]!.slot)
      g.fill()
    }
  }
  g.strokeStyle = ink
  g.globalAlpha = 0.5
  g.beginPath()
  g.arc(hx[0]!, hy[0]!, radius(w, 0, R) + 4, 0, TAU)
  g.stroke()
  // The picked story is ringed.
  if (props.picked !== null) {
    for (let i = 0; i < w.n; i++) {
      if (w.kind[i] !== DAY_STORY || storyOf(w, i).id !== props.picked) continue
      g.globalAlpha = 0.85
      g.lineWidth = 1.2
      g.beginPath()
      g.arc(hx[i]!, hy[i]!, radius(w, i, R) + 4.5, 0, TAU)
      g.stroke()
    }
  }
  // The lit theme again, in full: its lines, its faint dots, its dots and stories.
  if (tmix > 0.01 && litTheme >= 0 && litTheme < props.themes.length) {
    const th = props.themes[litTheme]!
    const mine = (i: number) => w.theme[i] === litTheme
    const emLines = new Path2D()
    for (let e = 0; e < w.bow.length; e++) {
      const i = w.edges[e * 2]!
      if (mine(i)) curve(emLines, w.edges[e * 2 + 1]!, i, w.bow[e]!)
    }
    g.strokeStyle = slotColour(th.slot)
    g.globalAlpha = 0.6 * tmix * form
    g.stroke(emLines)
    for (let i = 0; i < w.n; i++) {
      if (!mine(i) || w.kind[i] === DAY_DATE) continue
      const r = radius(w, i, R)
      const slot = w.kind[i] === DAY_DOT ? storyOf(w, i).dots[w.dot[i]!] ?? 0 : th.slot
      g.globalAlpha = tmix
      g.fillStyle = paper
      g.beginPath(); g.arc(hx[i]!, hy[i]!, r + (w.kind[i] === DAY_DOT ? 0.9 : 1.6), 0, TAU); g.fill()
      g.fillStyle = w.kind[i] === DAY_DOT ? (slot > 0 ? groupInk[slot] ?? ink : mute) : slotColour(th.slot)
      g.globalAlpha = tmix * (w.kind[i] === DAY_REST ? 0.7 : 1)
      g.beginPath(); g.arc(hx[i]!, hy[i]!, r, 0, TAU); g.fill()
    }
    g.globalAlpha = 1
  }
  // The ring: an arc for each outlet of the day (the stories) or each theme (the themes), as wide as its share of the articles; the one pointed at is thicker. The two rings fade into each other.
  const ringR = ringOf()
  const ringX = ringRx()
  const per = perim.value[perim.value.length - 1]!
  const sweepFrac = grown < 1 ? 1 - (1 - clamp(grown / 0.8, 0, 1)) ** 3 : 1
  const arcs = (items: { slot: number, n: number, name?: string }[], tag: string, alpha: number, hotOf: (k: number) => boolean) => {
    const total = items.reduce((sum, r) => sum + r.n, 0)
    if (total <= 0 || alpha < 0.01) return
    let from = 0
    g.lineCap = 'round'
    const named: NameItem[] = []
    items.forEach((r, k) => {
      const span = r.n / total
      const key = `${tag}${k}`
      const hot = arcHot.get(key) ?? 0
      const goal = hotOf(k) ? 1 : 0
      arcHot.set(key, reduced.value ? goal : hot + (goal - hot) * (1 - Math.exp(-dt * 9)))
      const pad = Math.min(span / 2, 3 / per)
      if (from + pad >= sweepFrac) { from += span; return }
      const heat = arcHot.get(key) ?? 0
      g.strokeStyle = props.names ? (heat > 0.01 ? slotColour(r.slot) : softInk[r.slot] ?? mute) : slotColour(r.slot)
      g.globalAlpha = (0.85 + 0.15 * heat) * alpha
      g.lineWidth = props.names ? 3 + 1.4 * heat : 2 + 2.5 * heat
      g.beginPath()
      g.ellipse(width / 2, height / 2, ringX, ringR, 0, paramOf(from + pad) - Math.PI / 2, paramOf(Math.min(from + span - pad, sweepFrac)) - Math.PI / 2)
      g.stroke()
      // The name and the share of a large arc, outside the ring.
      if (props.ellipse && tag === 'o' && r.name && span >= 0.035 && grown >= 1) {
        const m = paramOf(from + span / 2) - Math.PI / 2
        const c = Math.cos(m)
        const sn = Math.sin(m)
        const nm = r.name.replace(/^Συμφέροντα\s+/, '')
        const text = `${nm.length > 17 ? `${nm.slice(0, 16).trimEnd()}…` : nm} ${fmtPct(span)}`
        g.font = `11px ${fontText}`
        g.textAlign = c > 0.25 ? 'left' : c < -0.25 ? 'right' : 'center'
        g.lineWidth = 3.5
        g.strokeStyle = paper
        g.globalAlpha = 0.9
        const tx = width / 2 + (ringX + 10) * c
        const ty = height / 2 + (ringR + 10) * sn + (Math.abs(c) <= 0.25 ? (sn > 0 ? 8 : -2) : 4)
        g.strokeText(text, tx, ty)
        g.fillStyle = mute
        g.globalAlpha = 1
        g.fillText(text, tx, ty)
        g.textAlign = 'start'
      }
      if (props.names && r.name && span > 0) named.push({ mid: (from + span / 2) * TAU, span: span * TAU, text: r.name.length > NAME_MAX ? `${r.name.slice(0, NAME_MAX - 1)}…` : r.name, dot: r.slot > 0 ? groupInk[r.slot] ?? ink : mute, hot: heat > 0.5 })
      from += span
    })
    g.lineCap = 'butt'
    g.globalAlpha = 1
    if (named.length && grown >= 1) drawColumns(g, { fontText, paper, ink, mute }, { x0: 0, y0: 0, x1: width, y1: height }, { cx: width / 2, cy: height / 2, ring: ringR, kx: 1 }, named, 0.9 * alpha)
  }
  arcs(props.outlets, 'o', props.grouped ? 1 : 1 - form, k => (props.grouped || form < 0.5) && hoverRing === k)
  arcs(props.ring, 't', props.grouped ? 0 : form, k => form >= 0.5 && (props.lit === props.ring[k]!.issue || hoverRing === k))
  // The date at the center and the name of each theme beside its node: the only words on the web.
  g.font = `600 14px ${fontText}`
  g.textBaseline = 'alphabetic'
  g.lineJoin = 'round'
  g.textAlign = 'center'
  g.lineWidth = 4
  g.strokeStyle = paper
  g.globalAlpha = 0.9
  g.strokeText(props.date, hx[0]!, hy[0]! + 28)
  g.fillStyle = ink
  g.globalAlpha = 1
  g.fillText(props.date, hx[0]!, hy[0]! + 28)
  g.font = `11px ${fontText}`
  if (props.sub) {
    g.lineWidth = 3.5
    g.strokeText(props.sub, hx[0]!, hy[0]! + 42)
    g.fillStyle = mute
    g.fillText(props.sub, hx[0]!, hy[0]! + 42)
  }
  for (let i = 0; i < w.n; i++) {
    if (w.kind[i] !== DAY_THEME) continue
    if (form < 0.01 || w.theme[i]! >= props.labels || (props.names && !props.grouped)) continue
    const th = props.themes[w.theme[i]!]!
    const name = th.name
    const short = name.length > 28 ? `${name.slice(0, 27).trimEnd()}…` : name
    const full = props.shares ? `${short}${shareOf(ringN(th.issue))}` : short
    // The name is on the outer side of its node; when the area ends before the name does, the name is cut to fit (the share stays).
    const right = hx[i]! >= width / 2
    const fits = (txt: string) => g.measureText(txt).width + radius(w, i, R) + 7 <= (right ? width - hx[i]! : hx[i]!)
    let text = full
    for (let cut = short.length; cut > 6 && !fits(text); cut--) text = `${short.slice(0, cut - 1).trimEnd()}…${props.shares ? shareOf(ringN(th.issue)) : ''}`
    g.textAlign = right ? 'left' : 'right'
    const lx = hx[i]! + (right ? 1 : -1) * (radius(w, i, R) + 7)
    g.lineWidth = 3.5
    g.strokeStyle = paper
    const labelIn = grown < 1 ? growOf(DAY_DOT) : 1
    g.globalAlpha = 0.9 * form * labelIn
    g.strokeText(text, lx, hy[i]! + 4)
    g.fillStyle = mute
    g.globalAlpha = form * labelIn
    g.fillText(text, lx, hy[i]! + 4)
  }
  g.textAlign = 'start'
  g.globalAlpha = 1
  // With `names` the whole title of the story pointed at (on the web or in the list) is at its circle, on the side toward the middle of the web, in lines of at most 190 px.
  if (props.names && titleMix > 0.02 && titleKey >= 0) {
    const at = Array.from({ length: w.n }, (_, i) => i).find(i => w.kind[i] === DAY_STORY && w.theme[i]! * 100 + w.story[i]! === titleKey)
    const named = at !== undefined ? storyOf(w, at) : null
    if (at !== undefined && named) {
      const toRight = hx[at]! <= width / 2
      const gap = radius(w, at, R) + 8
      g.font = `600 12px ${fontText}`
      g.textBaseline = 'middle'
      g.textAlign = toRight ? 'left' : 'right'
      g.lineJoin = 'round'
      const rows: string[] = []
      let row = ''
      for (const word of named.name.split(/\s+/)) {
        const next = row ? `${row} ${word}` : word
        if (row && g.measureText(next).width > 190) { rows.push(row); row = word } else row = next
      }
      if (row) rows.push(row)
      const x = hx[at]! + (toRight ? gap : -gap)
      rows.forEach((text, n) => {
        const y = hy[at]! + (n - (rows.length - 1) / 2) * 15
        g.globalAlpha = 0.95 * titleMix
        g.strokeStyle = paper
        g.lineWidth = 4
        g.strokeText(text, x, y)
        g.globalAlpha = titleMix
        g.fillStyle = ink
        g.fillText(text, x, y)
      })
      g.textBaseline = 'alphabetic'
      g.textAlign = 'start'
      g.lineJoin = 'miter'
      g.globalAlpha = 1
    }
  }
  if (hover > 0 && (w.kind[hover] === DAY_STORY || w.kind[hover] === DAY_THEME)) {
    g.strokeStyle = ink
    g.globalAlpha = 0.85
    g.lineWidth = 1.2
    g.beginPath()
    g.arc(hx[hover]!, hy[hover]!, radius(w, hover, R) + 4, 0, TAU)
    g.stroke()
    g.globalAlpha = 1
  }
}

const resize = () => {
  const el = canvas.value
  const holder = box.value
  if (!el || !holder) return
  const rect = holder.getBoundingClientRect()
  if (!rect.width || !rect.height) return
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  width = rect.width
  height = rect.height
  el.width = Math.round(width * dpr)
  el.height = Math.round(height * dpr)
  ctx = el.getContext('2d')
  size.value = { w: width, h: height }
  draw(performance.now() / 1000, 0.016)
}

// The node under the pointer: a story, a theme or one of the dots of a story (which stands for its story).
const nodeAt = (x: number, y: number) => {
  const w = web.value
  if (!w) return -1
  const R = scaleOf()
  let best = -1
  let bestD = Infinity
  for (let i = 1; i < w.n; i++) {
    if (w.kind[i] === DAY_REST || (w.kind[i] === DAY_THEME && form < 0.5)) continue
    const d = Math.hypot(hx[i]! - x, hy[i]! - y) - radius(w, i, R)
    if (d < 6 && d < bestD) { bestD = d; best = i }
  }
  return best
}
// The ring in use: the outlets in the form of the stories, the themes in the form of the themes.
const ringItems = (): { name: string, slot: number, n: number, issue?: number }[] => (props.mode === 'themes' ? props.ring : props.outlets)
// The arc of the ring under the pointer, or -2.
const arcAt = (x: number, y: number) => {
  const items = ringItems()
  const total = items.reduce((sum, r) => sum + r.n, 0)
  if (!total) return -2
  const dx = x - width / 2
  const dy = y - height / 2
  const rx = ringRx()
  const ry = ringOf()
  if (Math.abs(Math.hypot(dx / rx, dy / ry) - 1) * Math.min(rx, ry) > 9) return -2
  const param = (((Math.atan2(dy / ry, dx / rx) + Math.PI / 2) % TAU) + TAU) % TAU
  const angle = fracOf(param) * TAU
  let from = 0
  for (let k = 0; k < items.length; k++) {
    from += (items[k]!.n / total) * TAU
    if (angle <= from) return k
  }
  return items.length - 1
}
const onMove = (e: PointerEvent) => {
  const w = web.value
  const rect = canvas.value!.getBoundingClientRect()
  const px = e.clientX - rect.left
  const py = e.clientY - rect.top
  const i = nodeAt(px, py)
  if (i !== hover) hover = i
  const arc = i < 0 ? arcAt(px, py) : -2
  hoverRing = arc
  const items = ringItems()
  const issue = props.mode !== 'themes' && !props.grouped ? null : arc >= 0 ? items[arc]!.issue ?? null : i > 0 && w ? props.themes[w.theme[i]!]!.issue : null
  if (issue !== props.lit) emit('update:lit', issue)
  if (arc >= 0) {
    const r = items[arc]!
    const total = items.reduce((sum, x) => sum + x.n, 0)
    tooltip.show({ title: r.name, rows: [{ label: t('home.field.articles'), value: `${fmtInt(r.n)} · ${fmtPct(r.n / total)}`, color: slotColour(r.slot) }], field: true }, e)
    return
  }
  if (!w || i < 0) { tooltip.hide(); return }
  const theme = props.themes[w.theme[i]!]!
  if (w.kind[i] === DAY_THEME) {
    tooltip.show({ title: theme.name, rows: [{ label: t('home.field.articles'), value: props.shares ? `${fmtInt(ringN(theme.issue))} ·${shareOf(ringN(theme.issue))}` : fmtInt(theme.n), color: slotColour(theme.slot) }], field: true }, e)
    return
  }
  const s = theme.stories[w.story[i]!]!
  const per = s.n / s.dots.length
  tooltip.show({ title: s.name, note: w.kind[i] === DAY_DOT ? t('home.web.dot', { n: fmtDec(per) }) : null, rows: [{ label: props.themeLabel ?? t('home.field.topic'), value: theme.name, color: slotColour(theme.slot) }, { label: t('home.field.articles'), value: fmtInt(s.n) }, ...(s.media > 0 ? [{ label: t('entity.fact.outlets'), value: fmtInt(s.media) }] : [])], field: true }, e)
}
const onLeave = () => { hover = -1; hoverRing = -2; emit('update:lit', null); tooltip.hide() }
const onClick = () => {
  const w = web.value
  if (props.mode === 'themes' && hoverRing >= 0 && hover < 0) { emit('pickTheme', props.ring[hoverRing]!.issue); return }
  if (!w || hover <= 0) return
  if (w.kind[hover] === DAY_STORY || w.kind[hover] === DAY_DOT) { tooltip.hide(); emit('pick', storyOf(w, hover).id) }
  else if (w.kind[hover] === DAY_THEME) emit('pickTheme', props.themes[w.theme[hover]!]!.issue)
}

onMounted(() => {
  readTokens()
  const watcher = new ResizeObserver(resize)
  if (box.value) watcher.observe(box.value)
  onBeforeUnmount(() => { watcher.disconnect(); tooltip.hide() })
  resize()
})
watch(() => prefs.theme, async () => { await nextTick(); readTokens() })
const loop = useRafFn(({ timestamp }) => {
  const now = timestamp / 1000
  draw(now, Math.min(0.1, last ? now - last : 0.016))
  last = now
}, { immediate: false })
const startGrow = () => { if (props.grow && !reduced.value && web.value) growAt = performance.now() }
watch(() => [props.active, !!web.value] as const, ([on, ready]) => { if (on && ready && growAt < 0) startGrow() }, { immediate: true })
// The same web again for another day (not for the same stories with other colors): the old picture fades and swells away over the new web, which grows out of the center.
const storiesKey = (themes: PlegmaDayTheme[]) => themes.map(th => th.stories.map(s => `${s.id}:${s.n}`).join(',')).join('|')
const fadeOld = () => {
  const el = canvas.value
  const holder = box.value
  if (!el || !holder || reduced.value) return
  const copy = document.createElement('canvas')
  copy.width = el.width
  copy.height = el.height
  copy.getContext('2d')?.drawImage(el, 0, 0)
  copy.className = 'plegma-day-canvas plegma-day-old'
  holder.append(copy)
  copy.animate([{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(1.05)' }], { duration: 380, easing: 'ease-out', fill: 'forwards' }).finished.then(() => copy.remove(), () => copy.remove())
}
watch(() => storiesKey(props.themes), (now, was) => { if (props.grow && props.active && was && now !== was && web.value) { fadeOld(); startGrow() } })
watch(() => [props.active, reduced.value] as const, ([on, still]) => {
  last = 0
  if (on && !still) loop.resume()
  else { loop.pause(); draw(performance.now() / 1000, 0.016) }
}, { immediate: true })
watch([web, () => props.picked, () => props.lit, () => props.hoverStory, () => props.ring, () => props.outlets], () => { if (!loop.isActive.value) draw(performance.now() / 1000, 0.016) })
watch(() => props.mode, () => { if (loop.isActive.value) return; themed = props.mode === 'themes' ? 1 : 0; draw(performance.now() / 1000, 0.016) })
useEventListener(document, 'visibilitychange', () => { if (document.hidden) loop.pause(); else if (props.active && !reduced.value) loop.resume() })
onBeforeUnmount(() => loop.pause())
// Where a story or a theme is on the canvas (px), for the dive into its page: its node, or the middle of the web when it has none (a story beyond the largest ones, a theme in the form of the stories).
const spotOf = (target: { story?: number, theme?: number }) => {
  const w = web.value
  const at = w ? Array.from({ length: w.n }, (_, i) => i).find(i => (target.story !== undefined ? w.kind[i] === DAY_STORY && storyOf(w, i).id === target.story : w.kind[i] === DAY_THEME && props.themes[w.theme[i]!]!.issue === target.theme)) : undefined
  return at !== undefined && (target.story !== undefined || form > 0.5) ? { x: hx[at]!, y: hy[at]! } : { x: width / 2, y: height / 2 }
}
defineExpose({ spotOf, canvas })
</script>

<template>
  <div ref="box" class="plegma-day">
    <canvas ref="canvas" class="plegma-day-canvas" role="img" :aria-label="label ?? t('home.web.label', { date })" @pointermove="onMove" @pointerleave="onLeave" @click="onClick" />
  </div>
</template>
