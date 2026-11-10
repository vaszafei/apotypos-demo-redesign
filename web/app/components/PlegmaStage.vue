<script setup lang="ts">
import { useEventListener, useMediaQuery } from '@vueuse/core'
import { cameraAt, flightDone, frameHome, framePair, frameStory, frameTheme, redirectFlight, toScreen } from '~/utils/plegma-camera'
import type { PlegmaCamera, PlegmaFlight } from '~/utils/plegma-camera'
import { arcsOf, buildWorld, drawLevel, homeWebs, PLEGMA_FAR_MIN, PLEGMA_FOCUS_DOTS, PLEGMA_WEB_MIN, themeFrameSet, webOf } from '~/utils/plegma-world'
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

const stories = useFixtureLazy<PlegmaStoriesFile>('stories', { required: ['dates', 'issues', 'stories'] })
const home = useFixtureLazy<PlegmaHomeFile>('home', { required: ['issues', 'issueDaily'] })
const file = useFixtureLazy<PlegmaFile>('plegma', { required: ['places', 'world'] })

let world: PlegmaWorld | null = null
let byX: PlegmaStory[] = []
let ctx: CanvasRenderingContext2D | null = null
let width = 0
let height = 0
let dpr = 1
let raf = 0
let flight: PlegmaFlight | null = null
let hover: PlegmaStory | null = null
let webs: PlegmaStory[] = []
let ink = '#111'
let cats: string[] = []
const cam: PlegmaCamera = { x: 0, y: 0, z: 0.5 }

const EMPTY = new Set<PlegmaStory>()
const cores = new Map<number, Set<PlegmaStory>>()
const coreOf = (issue: number) => {
  let set = cores.get(issue)
  if (!set) { set = new Set(themeFrameSet(world!, issue)); cores.set(issue, set) }
  return set
}
const name = (s: PlegmaStory) => (locale.value === 'en' && s.en) || s.el
const colourOf = (s: PlegmaStory) => (s.slot > 0 ? cats[s.slot - 1] ?? ink : ink)
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))

// The colors are tokens, read when the theme changes (they depend on it).
const readTokens = () => {
  const style = getComputedStyle(document.documentElement)
  ink = style.getPropertyValue('--ink').trim() || '#111'
  cats = Array.from({ length: 8 }, (_, i) => style.getPropertyValue(`--cat-${i + 1}`).trim() || ink)
}

const focusStory = () => (world && plegma.focus?.kind === 'story' ? world.byId.get(plegma.focus.id) ?? null : null)
const focusIssue = () => (plegma.focus?.kind === 'theme' ? plegma.focus.issue : null)

// The camera that shows the focus: Home's best webs, a story in the map region, or a theme's largest stories.
const targetCamera = (): PlegmaCamera | null => {
  if (!world || !width) return null
  const story = focusStory()
  if (story) {
    const other = plegma.compare !== null ? world.byId.get(plegma.compare) : null
    return other ? framePair(story, other, width, height).camera : frameStory(story, width, height)
  }
  const issue = focusIssue()
  if (issue !== null) return frameTheme(themeFrameSet(world, issue), width, height)
  return webs.length ? frameHome(webs, width, height) : null
}

const fly = () => {
  const to = targetCamera()
  if (!to) return
  flight = redirectFlight(flight, cam, to, performance.now(), width, reduced.value)
  if (flight.dur <= 0) { Object.assign(cam, to); flight = null }
  kick()
}

// ---- drawing ----
const arcOf = (ctx2: CanvasRenderingContext2D, a: PlegmaStory, b: PlegmaStory, sign: number) => {
  const p = toScreen(cam, width, height, a)
  const q = toScreen(cam, width, height, b)
  const dx = q.x - p.x
  const dy = q.y - p.y
  ctx2.moveTo(p.x, p.y)
  ctx2.quadraticCurveTo((p.x + q.x) / 2 - dy * 0.22 * sign, (p.y + q.y) / 2 + dx * 0.22 * sign, q.x, q.y)
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
  if (!ctx || !world) return
  const c = ctx
  c.setTransform(dpr, 0, 0, dpr, 0, 0)
  c.clearRect(0, 0, width, height)
  const z = cam.z
  const sec = reduced.value ? 0 : now / 1000
  const story = focusStory()
  const other = plegma.compare !== null ? world.byId.get(plegma.compare) ?? null : null
  const issue = focusIssue()
  const onHome = !story && issue === null
  // The theme that is lit: the one of the story or the theme in focus, or the one under the pointer.
  const lit = hover ? hover.issue : story ? story.issue : issue
  const litCoded = lit !== null && !world.issues[lit]!.catchAll
  const core = issue !== null ? coreOf(issue) : EMPTY
  const homeSet = new Set(webs)
  const dim = onHome ? 0.38 : 0.24
  const dotBuckets: ({ colour: string, alpha: number, path: Path2D } | undefined)[] = []
  const drawn: { s: PlegmaStory, level: 1 | 2, alpha: number, focus: boolean }[] = []

  for (const s of visible(80)) {
    const isFocus = s === story || s === other
    const strong = isFocus || homeSet.has(s) || core.has(s) || s === hover
    const sameTheme = litCoded && s.issue === lit && s.coded
    const alpha = strong ? 1 : sameTheme ? 0.8 : dim
    const level = drawLevel(s, z, strong, isFocus)
    // Zoomed far out, the smallest stories are faint specks that only cost drawing time: leave them out until the camera is nearer.
    if (level === 0 && z < 0.3 && !strong && !sameTheme && s.n < PLEGMA_FAR_MIN) continue
    if (level === 0) {
      const r = isFocus ? 4 : clamp(0.7 + 0.35 * Math.log10(s.n + 1) * (z < 0.22 ? 1.4 : 1.8) * Math.sqrt(Math.max(z, 0.5)), 0.8, 5)
      const key = s.slot * 3 + (strong ? 2 : sameTheme ? 1 : 0)
      let bucket = dotBuckets[key]
      if (!bucket) { bucket = { colour: colourOf(s), alpha, path: new Path2D() }; dotBuckets[key] = bucket }
      const px = (s.x - cam.x) * z + width / 2
      const py = (s.y - cam.y) * z + height / 2
      bucket.path.moveTo(px + r, py)
      bucket.path.arc(px, py, r, 0, TAU)
    } else drawn.push({ s, level, alpha, focus: isFocus })
  }
  for (const bucket of dotBuckets) { if (!bucket) continue; c.globalAlpha = bucket.alpha; c.fillStyle = bucket.colour; c.fill(bucket.path) }

  // The webs: each dot wanders a few pixels on slow waves, so a web breathes.
  const rd = clamp(1.3 * Math.sqrt(z) + 0.9, 1.6, 4.4)
  c.lineWidth = 1
  for (const { s, level, alpha, focus } of drawn) {
    const w = webOf(world, s, focus ? PLEGMA_FOCUS_DOTS : 0)
    const p = toScreen(cam, width, height, s)
    const col = colourOf(s)
    const at = w.offs.map((o, i) => [p.x + o.x * z + Math.sin(sec * 0.55 + i * 1.7 + s.id) * 1.6, p.y + o.y * z + Math.cos(sec * 0.47 + i * 2.3 + s.id) * 1.6] as const)
    c.fillStyle = col
    c.strokeStyle = col
    if (level === 2) {
      c.globalAlpha = alpha * 0.55
      c.beginPath()
      for (const [i, j] of w.edges) { c.moveTo(at[i]![0], at[i]![1]); c.lineTo(at[j]![0], at[j]![1]) }
      c.stroke()
    }
    c.globalAlpha = alpha
    const dr = level === 2 ? rd : clamp(rd * 0.8, 1.2, 3)
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
  if (story) issues.add(story.issue)
  if (issue !== null) issues.add(issue)
  if (hover) issues.add(hover.issue)
  if (onHome) for (const s of webs) issues.add(s.issue)
  c.lineWidth = 1.2
  c.setLineDash([2, 5])
  for (const k of issues) {
    const arcs = arcsOf(world, k)
    if (!arcs.length) continue
    const slot = world.slotOf.get(k)
    c.strokeStyle = slot ? cats[slot - 1] ?? ink : ink
    c.globalAlpha = onHome ? 0.5 : 0.75
    c.beginPath()
    for (const a of arcs) arcOf(c, a.a, a.b, a.sign)
    c.stroke()
  }
  c.setLineDash([])
  c.globalAlpha = 1
}

// ---- the loop ----
// The stage draws while it is shown and the tab is visible; with reduced motion it draws one still frame when something changes.
const running = () => plegma.active && !document.hidden && !!world
const frame = (now: number) => {
  raf = 0
  if (!running()) return
  if (flight) {
    Object.assign(cam, cameraAt(flight, now, width))
    if (flightDone(flight, now)) flight = null
  }
  draw(now)
  if (!reduced.value || flight) raf = requestAnimationFrame(frame)
}
function kick () { if (!raf && running()) raf = requestAnimationFrame(frame) }
const halt = () => { if (raf) cancelAnimationFrame(raf); raf = 0 }

const resize = () => {
  const el = canvas.value
  if (!el) return
  const box = el.getBoundingClientRect()
  if (!box.width || !box.height || (box.width === width && box.height === height && dpr === Math.min(window.devicePixelRatio || 1, 2))) return
  dpr = Math.min(window.devicePixelRatio || 1, 2)
  width = box.width
  height = box.height
  el.width = Math.round(width * dpr)
  el.height = Math.round(height * dpr)
  ctx = el.getContext('2d')
  if (!world) return
  // A new size changes the framing: the camera cuts to it, unless a flight is under way (it flies on to the new target).
  const to = targetCamera()
  if (to) { if (flight) flight = redirectFlight(flight, cam, to, performance.now(), width, reduced.value); else Object.assign(cam, to) }
  kick()
}

// ---- the pointer ----
// The stage is behind the page, so the pointer is read on the window; a card, a link or a control under it is not the map.
const CAPTURES = 'a, button, input, select, textarea, [role="dialog"], .dcard, .kpi-tile, .page-head, .section-nav, .trail-bar, .header-bar, .sidebar, .page-footer, .tooltip'
const pickAt = (x: number, y: number, reach: number) => {
  if (!world) return null
  let best: PlegmaStory | null = null
  let bestDistance = reach
  for (const s of visible(reach / cam.z + 20)) {
    if (s.n < PLEGMA_WEB_MIN && s !== focusStory()) continue
    const p = toScreen(cam, width, height, s)
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
  if (!hover) return
  hover = null
  tooltip.hide()
  if (reduced.value) kick()
}
useEventListener(window, 'pointermove', (e: PointerEvent) => {
  if (!plegma.active || !world || e.pointerType === 'touch' || !pointerFine.value || phone.value) return
  if ((e.target as Element | null)?.closest?.(CAPTURES)) return leave()
  const p = local(e)
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
  if (!plegma.active || !world || !pointerFine.value || phone.value || e.button !== 0 || e.defaultPrevented) return
  if ((e.target as Element | null)?.closest?.(CAPTURES)) return
  const p = { x: e.clientX - canvas.value!.getBoundingClientRect().left, y: e.clientY - canvas.value!.getBoundingClientRect().top }
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
  webs = homeWebs(world, ix, phone.value ? HOME_WEBS_PHONE : HOME_WEBS)
  readTokens()
  // A cold open lands settled: no flight (R14).
  const to = targetCamera()
  if (to) Object.assign(cam, to)
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
watch(() => plegma.active, (active) => {
  if (!active) { halt(); leave(); return }
  const to = targetCamera()
  if (to && !flight && (Math.abs(to.x - cam.x) > 0.5 || Math.abs(to.y - cam.y) > 0.5 || Math.abs(to.z - cam.z) > 0.001)) fly()
  else kick()
})
watch(() => prefs.theme, async () => { await nextTick(); readTokens(); kick() })
watch(reduced, (still) => { if (still) { flight = null; const to = targetCamera(); if (to) Object.assign(cam, to) } kick() })
onBeforeUnmount(halt)
</script>

<template>
  <div class="plegma-stage" :hidden="!plegma.active" aria-hidden="true">
    <canvas ref="canvas" class="plegma-canvas" />
  </div>
</template>
