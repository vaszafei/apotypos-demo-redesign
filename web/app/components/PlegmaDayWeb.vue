<script setup lang="ts">
import { useEventListener, useMediaQuery, useRafFn } from '@vueuse/core'
import { blendHex } from '~/utils/ink'
import { buildDayWeb, DAY_DATE, DAY_DOT, DAY_REST, DAY_STORY, DAY_THEME } from '~/utils/plegma-day'
import type { PlegmaDayTheme, PlegmaDayWeb } from '~/utils/plegma-day'

// The web of a day on Home, drawn in the free area under the calendar (utils/plegma-day.ts has the layout): the date at the center, the themes of the day around it, the largest stories of each
// theme, and a dot for each article of a story. It has the look of the web of a theme (components/PlegmaStage.vue drawTheme): solid nodes with a rim of the page's color, the calm colors of the
// groups, thin curved lines, a slow drift. A story on it is picked with a click and takes the card. The Plegma stage is behind it, as a dim map.
// The ring around it has an arc for each theme of the day, as wide as its share of the articles of the day (a theme with no color of its own is gray). A theme pointed at, on the
// ring, on the web or in the list beside it (`lit`), comes forward.
export interface DayRing { issue: number, name: string, slot: number, n: number }
const props = defineProps<{ themes: PlegmaDayTheme[], ring: DayRing[], lit: number | null, date: string, picked: number | null, active: boolean }>()
const emit = defineEmits<{ pick: [id: number], 'update:lit': [issue: number | null] }>()
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
const slotColour = (slot: number) => (slot > 0 ? cats[slot - 1] ?? mute : mute)

// The layout is the same for the same day; it is drawn again when the area changes shape.
// The web lies inside the ring, which is a circle: the layout is on the unit disc.
const aspect = computed(() => (size.value.h ? 1 : 0))
const seed = computed(() => [...props.date].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 9973, 7))
const web = computed<PlegmaDayWeb | null>(() => (props.themes.length && aspect.value ? buildDayWeb(props.themes, aspect.value, seed.value) : null))

let hx = new Float32Array(0)
let hy = new Float32Array(0)
let hover = -1
let hoverRing = -2
let mix = 0
let litStory = -1
let tmix = 0
let litTheme = -1
const arcHot = new Map<number, number>()
let last = 0
const storyOf = (w: PlegmaDayWeb, i: number) => props.themes[w.theme[i]!]!.stories[w.story[i]!]!
// The ring is as large as the area allows, and the web is a little smaller inside it.
const ringOf = () => Math.min(width, height) / 2 * 0.9 - 10
const scaleOf = () => ringOf() - 22
const radius = (w: PlegmaDayWeb, i: number, R: number) => {
  switch (w.kind[i]) {
    case DAY_DATE: return 9
    case DAY_THEME: return 6.5 + 4 * w.size[i]!
    case DAY_STORY: return 3.6 + 3.4 * w.size[i]!
    case DAY_DOT: return clamp(R * (0.004 + 0.0085 * w.size[i]!), 1.4, 5.2)
    default: return clamp(R * 0.004 * (0.6 + w.size[i]!), 1, 2.2)
  }
}
const layout = (w: PlegmaDayWeb, sec: number) => {
  if (hx.length < w.n) { hx = new Float32Array(w.n); hy = new Float32Array(w.n) }
  const R = scaleOf()
  const amp = clamp(R * 0.014, 1.5, 6)
  for (let i = 0; i < w.n; i++) {
    const a = sec * w.speed[i]! + w.phase[i]!
    const k = w.kind[i] === DAY_DATE ? 0 : w.kind[i] === DAY_THEME ? 0.5 : w.kind[i] === DAY_STORY ? 0.7 : w.reach[i]!
    hx[i] = width / 2 + w.x[i]! * R + Math.cos(a) * amp * k
    hy[i] = height / 2 + w.y[i]! * R + Math.sin(a) * amp * k
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
  const R = layout(w, reduced.value ? 0 : sec)
  // What is lit: the story pointed at, or the one picked; the others step back.
  const pointedStory = hover > 0 && (w.kind[hover] === DAY_STORY || w.kind[hover] === DAY_DOT) ? w.theme[hover]! * 100 + w.story[hover]! : null
  const pickedStory = props.picked !== null ? props.themes.flatMap((th, ti) => th.stories.map((s, si) => ({ id: s.id, key: ti * 100 + si }))).find(r => r.id === props.picked)?.key ?? null : null
  const lit = pointedStory ?? pickedStory
  if (lit !== null) litStory = lit
  mix = reduced.value ? (lit !== null ? 1 : 0) : mix + ((lit !== null ? 1 : 0) - mix) * (1 - Math.exp(-dt * 9))
  // A theme that is pointed at comes forward: the rest steps back, and the theme is drawn again at the end.
  const litIssue = props.lit
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
      continue
    }
    if (mix > 0.01 && isLit(i)) { curve(litLines, j, i, w.bow[e]!); continue }
    const slot = props.themes[w.theme[i]!]!.stories[w.story[i]!]!.dots[w.dot[i]!] ?? 0
    let path = lines.get(slot)
    if (!path) { path = new Path2D(); lines.set(slot, path) }
    curve(path, j, i, w.bow[e]!)
  }
  g.strokeStyle = ink
  g.globalAlpha = 0.3 * (1 - 0.6 * tmix)
  g.stroke(spokes)
  for (const [slot, path] of themeLines) { g.strokeStyle = slotColour(slot); g.globalAlpha = 0.45 * back; g.stroke(path) }
  for (const [slot, path] of lines) { g.strokeStyle = softInk[slot] ?? mute; g.globalAlpha = 0.6 * back; g.stroke(path) }
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
  for (const [slot, path] of rest) { g.fillStyle = slotColour(slot); g.globalAlpha = 0.4 * back; g.fill(path) }
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
  for (const [slot, path] of fills) { g.fillStyle = softInk[slot] ?? mute; g.globalAlpha = back; g.fill(path) }
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
    const r = radius(w, i, R)
    g.globalAlpha = 1
    g.fillStyle = paper
    g.beginPath()
    g.arc(hx[i]!, hy[i]!, r + 1.6, 0, TAU)
    g.fill()
    g.fillStyle = w.kind[i] === DAY_DATE ? ink : slotColour(props.themes[w.theme[i]!]!.slot)
    g.globalAlpha = w.kind[i] === DAY_STORY && !isLit(i) ? back : 1
    g.beginPath()
    g.arc(hx[i]!, hy[i]!, r, 0, TAU)
    g.fill()
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
    g.globalAlpha = 0.6 * tmix
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
  // The ring: an arc for each theme of the day, as wide as its share of the articles; the one pointed at is thicker.
  const total = props.ring.reduce((sum, r) => sum + r.n, 0)
  if (total > 0) {
    const ringR = ringOf()
    let from = 0
    g.lineCap = 'round'
    props.ring.forEach((r, k) => {
      const span = (r.n / total) * TAU
      const key = r.issue
      const hot = arcHot.get(key) ?? 0
      const goal = props.lit === r.issue || hoverRing === k ? 1 : 0
      arcHot.set(key, reduced.value ? goal : hot + (goal - hot) * (1 - Math.exp(-dt * 9)))
      const pad = Math.min(span / 2, 3 / ringR)
      g.strokeStyle = slotColour(r.slot)
      g.globalAlpha = 0.85 + 0.15 * (arcHot.get(key) ?? 0)
      g.lineWidth = 2 + 2.5 * (arcHot.get(key) ?? 0)
      g.beginPath()
      g.arc(width / 2, height / 2, ringR, from - Math.PI / 2 + pad, from + span - Math.PI / 2 - pad)
      g.stroke()
      from += span
    })
    g.lineCap = 'butt'
    g.globalAlpha = 1
  }
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
  for (let i = 0; i < w.n; i++) {
    if (w.kind[i] !== DAY_THEME) continue
    const name = props.themes[w.theme[i]!]!.name
    const text = name.length > 28 ? `${name.slice(0, 27).trimEnd()}…` : name
    const right = hx[i]! >= width / 2
    g.textAlign = right ? 'left' : 'right'
    const lx = hx[i]! + (right ? 1 : -1) * (radius(w, i, R) + 7)
    g.lineWidth = 3.5
    g.strokeStyle = paper
    g.globalAlpha = 0.9
    g.strokeText(text, lx, hy[i]! + 4)
    g.fillStyle = mute
    g.globalAlpha = 1
    g.fillText(text, lx, hy[i]! + 4)
  }
  g.textAlign = 'start'
  g.globalAlpha = 1
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
    if (w.kind[i] === DAY_REST) continue
    const d = Math.hypot(hx[i]! - x, hy[i]! - y) - radius(w, i, R)
    if (d < 6 && d < bestD) { bestD = d; best = i }
  }
  return best
}
// The arc of the ring under the pointer, or -2.
const arcAt = (x: number, y: number) => {
  const total = props.ring.reduce((sum, r) => sum + r.n, 0)
  if (!total) return -2
  const dx = x - width / 2
  const dy = y - height / 2
  if (Math.abs(Math.hypot(dx, dy) - ringOf()) > 9) return -2
  const angle = (((Math.atan2(dy, dx) + Math.PI / 2) % TAU) + TAU) % TAU
  let from = 0
  for (let k = 0; k < props.ring.length; k++) {
    from += (props.ring[k]!.n / total) * TAU
    if (angle <= from) return k
  }
  return props.ring.length - 1
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
  const issue = arc >= 0 ? props.ring[arc]!.issue : i > 0 && w ? props.themes[w.theme[i]!]!.issue : null
  if (issue !== props.lit) emit('update:lit', issue)
  if (arc >= 0) {
    const r = props.ring[arc]!
    const total = props.ring.reduce((sum, x) => sum + x.n, 0)
    tooltip.show({ title: r.name, rows: [{ label: t('home.field.articles'), value: `${fmtInt(r.n)} · ${fmtPct(r.n / total)}`, color: slotColour(r.slot) }], field: true }, e)
    return
  }
  if (!w || i < 0) { tooltip.hide(); return }
  const theme = props.themes[w.theme[i]!]!
  if (w.kind[i] === DAY_THEME) {
    tooltip.show({ title: theme.name, rows: [{ label: t('home.field.articles'), value: fmtInt(theme.n), color: slotColour(theme.slot) }], field: true }, e)
    return
  }
  const s = theme.stories[w.story[i]!]!
  const per = s.n / s.dots.length
  tooltip.show({ title: s.name, note: w.kind[i] === DAY_DOT ? t('home.web.dot', { n: fmtDec(per) }) : null, rows: [{ label: t('home.field.topic'), value: theme.name, color: slotColour(theme.slot) }, { label: t('home.field.articles'), value: fmtInt(s.n) }, { label: t('entity.fact.outlets'), value: fmtInt(s.media) }], field: true }, e)
}
const onLeave = () => { hover = -1; hoverRing = -2; emit('update:lit', null); tooltip.hide() }
const onClick = () => {
  const w = web.value
  if (!w || hover <= 0) return
  if (w.kind[hover] === DAY_STORY || w.kind[hover] === DAY_DOT) { tooltip.hide(); emit('pick', storyOf(w, hover).id) }
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
watch(() => [props.active, reduced.value] as const, ([on, still]) => {
  last = 0
  if (on && !still) loop.resume()
  else { loop.pause(); draw(performance.now() / 1000, 0.016) }
}, { immediate: true })
watch([web, () => props.picked, () => props.lit, () => props.ring], () => { if (!loop.isActive.value) draw(performance.now() / 1000, 0.016) })
useEventListener(document, 'visibilitychange', () => { if (document.hidden) loop.pause(); else if (props.active && !reduced.value) loop.resume() })
onBeforeUnmount(() => loop.pause())
</script>

<template>
  <div ref="box" class="plegma-day">
    <canvas ref="canvas" class="plegma-day-canvas" role="img" :aria-label="t('home.web.label', { date })" @pointermove="onMove" @pointerleave="onLeave" @click="onClick" />
  </div>
</template>
