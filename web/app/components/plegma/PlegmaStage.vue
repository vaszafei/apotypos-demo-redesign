<script setup lang="ts">
import { useEventListener, useMediaQuery } from '@vueuse/core'
import { cameraAt, flightDone, redirectFlight } from '~/utils/plegma/plegma-camera'
import { buildWorld, homeWebs } from '~/utils/plegma/plegma-world'
import type { PlegmaFile, PlegmaHomeFile, PlegmaStoriesFile } from '~/utils/plegma/plegma-world'
import { homeIndex, HOME_WEBS, HOME_WEBS_PHONE } from '~/utils/home'
import { createStageState } from '~/utils/plegma/stage/stage-state'
import { createStageCore } from '~/utils/plegma/stage/stage-core'
import { createStageArticles } from '~/utils/plegma/stage/stage-articles'
import { createStageTheme } from '~/utils/plegma/stage/stage-theme'
import { createStageHero } from '~/utils/plegma/stage/stage-hero'
import { createStageDraw } from '~/utils/plegma/stage/stage-draw'
import { createStagePointer } from '~/utils/plegma/stage/stage-pointer'

// The Plegma: one canvas behind the pages, in the layout, so it outlives a page change and a flight can end on another page (KTD1). It draws every story of the
// fixtures at its permanent place (plegma.json), with the look of the home hero: a web for a story, a dot for the rest, dashed arcs along a theme. The route says what
// is in focus (stores/plegma.ts); when it changes the camera flies there (utils/plegma/plegma-camera.ts). On a route without the plegma page meta the stage is hidden and stops.
// The parts of the stage are in utils/plegma/stage/: the shared state, the core (focus, camera, colors), the story's articles, the theme's web, the hero, one frame, the pointer.
const plegma = usePlegmaStore()
const prefs = usePrefsStore()
const tooltip = useTooltipStore()
const { t, locale } = useI18n()
const reduced = useMediaQuery('(prefers-reduced-motion: reduce)')
const pointerFine = useMediaQuery('(hover: hover) and (pointer: fine)')
const phone = useMediaQuery('(max-width: 759px)')
const canvas = ref<HTMLCanvasElement>()
const canvasFocus = ref<HTMLCanvasElement>()
const st = createStageState()
const fogged = ref(true)
const deps = { plegma, reduced, locale }
const core = createStageCore(st, deps)
const { readTokens, behind, targetCamera } = core
const articles = createStageArticles(st, deps, core)
const theme = createStageTheme(st, deps, core)
const hero = createStageHero(st, { reduced, tooltip, fogged, kick: () => kick() }, core)
const draw = createStageDraw(st, { ...deps, canvas, canvasFocus }, core, articles, theme, hero).draw
const pointer = createStagePointer(st, { ...deps, pointerFine, phone, canvas, tooltip, t, kick: () => kick() }, core, articles, theme, hero)
const { leave } = pointer

const stories = useFixtureLazy<PlegmaStoriesFile>('stories', { required: ['dates', 'issues', 'stories'] })
const home = useFixtureLazy<PlegmaHomeFile>('home', { required: ['issues', 'issueDaily'] })
const file = useFixtureLazy<PlegmaFile>('plegma', { required: ['places', 'world'] })

let raf = 0

const fly = () => {
  const to = targetCamera()
  if (!to) return
  st.walk = null
  st.flight = redirectFlight(st.flight, st.cam, to, performance.now(), st.width, reduced.value)
  if (st.flight.dur <= 0) { Object.assign(st.cam, to); st.flight = null }
  plegma.setLanded(!st.flight)
  kick()
}

// ---- the loop ----
// The stage draws while it is shown and the tab is visible; with reduced motion it draws one still frame when something changes.
const running = () => plegma.active && !document.hidden && !!st.world
let walkAt = 0
const frame = (now: number) => {
  raf = 0
  if (!running()) return
  if (st.flight) {
    Object.assign(st.cam, cameraAt(st.flight, now, st.width))
    if (flightDone(st.flight, now)) { st.flight = null; plegma.setLanded(true) }
  }
  // A step toward a click in the hero eases in, with no pull back: it is a step, not a flight.
  if (st.walk && !st.flight) {
    const k = 1 - Math.exp(-Math.min(0.1, Math.max(0, (now - walkAt) / 1000)) * 2.6)
    st.cam.x += (st.walk.x - st.cam.x) * k
    st.cam.y += (st.walk.y - st.cam.y) * k
    st.cam.z *= Math.pow(st.walk.z / st.cam.z, k)
    if (Math.abs(st.walk.x - st.cam.x) < 0.5 && Math.abs(st.walk.y - st.cam.y) < 0.5 && Math.abs(st.walk.z / st.cam.z - 1) < 0.002) { Object.assign(st.cam, st.walk); st.walk = null }
  }
  walkAt = now
  draw(now)
  if (!reduced.value || st.flight || st.walk) raf = requestAnimationFrame(frame)
}
function kick () { if (!raf && running()) raf = requestAnimationFrame(frame) }
const halt = () => { if (raf) cancelAnimationFrame(raf); raf = 0 }

const resize = () => {
  const el = canvas.value
  const elFocus = canvasFocus.value
  if (!el || !elFocus) return
  const box = el.getBoundingClientRect()
  if (!box.width || !box.height || (box.width === st.width && box.height === st.height && st.dpr === Math.min(window.devicePixelRatio || 1, 2))) return
  st.dpr = Math.min(window.devicePixelRatio || 1, 2)
  st.width = box.width
  st.height = box.height
  el.width = Math.round(st.width * st.dpr)
  el.height = Math.round(st.height * st.dpr)
  st.ctx = el.getContext('2d')
  elFocus.width = el.width
  elFocus.height = el.height
  st.ctxFocus = elFocus.getContext('2d')
  if (!st.world) return
  // A new size changes the framing: the camera cuts to it, unless a flight is under way (it flies on to the new target).
  st.walk = null
  const to = targetCamera()
  if (to) { if (st.flight) st.flight = redirectFlight(st.flight, st.cam, to, performance.now(), st.width, reduced.value); else { Object.assign(st.cam, to); plegma.setLanded(true) } }
  kick()
}

// ---- the pointer ----
useEventListener(window, 'pointermove', pointer.onMove)
useEventListener(document, 'pointerleave', leave)
useEventListener(window, 'click', pointer.onClick)

// ---- start ----
const ready = computed(() => !!stories.data.value && !!home.data.value && !!file.data.value)
const start = () => {
  if (st.world || !ready.value) return
  st.world = buildWorld(stories.data.value!, home.data.value!, file.data.value!)
  const ix = homeIndex({ stories: stories.data.value!, detail: null })
  st.byX = st.world.stories.slice().sort((a, b) => a.x - b.x)
  // The latest week that has topics, so the webs have their colours (the October stories have no topic): the last day with a count in the topics' days.
  const lastCoded = home.data.value!.issueDaily.reduce((m, row) => Math.max(m, row.findLastIndex(v => v !== null)), 0)
  st.weekWebs = homeWebs(st.world, ix, phone.value ? HOME_WEBS_PHONE : HOME_WEBS, lastCoded)
  st.webs = !behind() ? st.weekWebs : []
  readTokens()
  // A cold open lands settled: no flight (R14).
  const to = targetCamera()
  if (to) Object.assign(st.cam, to)
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
watch(behind, (on, was) => {
  if (!st.world) return
  st.webs = on ? [] : st.weekWebs
  if (!on && was && plegma.active) fly()
  kick()
})
// The view measured the free area again (its title grew, the window changed): the camera frames the new area, inside a flight from where it is.
watch(() => plegma.region, () => {
  const to = targetCamera()
  if (!to || plegma.focus === null) return
  if (st.flight) st.flight = redirectFlight(st.flight, st.cam, to, performance.now(), st.width, reduced.value)
  else Object.assign(st.cam, to)
  kick()
}, { deep: true })
watch(() => plegma.active, (active) => {
  if (!active) { halt(); leave(); return }
  const to = targetCamera()
  if (to && !st.flight && (Math.abs(to.x - st.cam.x) > 0.5 || Math.abs(to.y - st.cam.y) > 0.5 || Math.abs(to.z - st.cam.z) > 0.001)) fly()
  else kick()
})
watch(() => [plegma.articles, plegma.highlight, plegma.hoverStory, plegma.related, plegma.themeStories], () => kick())
watch(() => prefs.theme, async () => { await nextTick(); readTokens(); kick() })
watch(reduced, (still) => { if (still) { st.flight = null; const to = targetCamera(); if (to) Object.assign(st.cam, to); plegma.setLanded(true) } kick() })
onBeforeUnmount(halt)
</script>

<template>
  <div class="plegma-stage" :class="{ 'is-view': plegma.focus !== null || behind(), 'is-fog': fogged && plegma.focus === null && !behind(), 'is-off': !plegma.active }" aria-hidden="true">
    <canvas ref="canvas" class="plegma-canvas plegma-canvas-back" />
    <canvas ref="canvasFocus" class="plegma-canvas plegma-canvas-focus" />
  </div>
</template>
