<script setup lang="ts">
import { useEventListener, useMediaQuery } from '@vueuse/core'
import type { PlegmaPoint } from '~/utils/plegma/plegma-camera'
import { cameraAt, flightDone, redirectFlight, regionBox, toScreen, toWorld } from '~/utils/plegma/plegma-camera'
import { arcsOf, buildWorld, drawLevel, homeWebs, PLEGMA_FAR_MIN, PLEGMA_FOCUS_DOTS, PLEGMA_WEB_MIN, webOf } from '~/utils/plegma/plegma-world'
import { heroClearMs, heroReach, heroWebOf, HERO_SPEED, lanternReveal, looseOf, smooth, waveReveal } from '~/utils/plegma/plegma-hero'
import type { HeroSource } from '~/utils/plegma/plegma-hero'
import { articleOfNode, articlesPerNode, nodeCount } from '~/utils/plegma/plegma-articles'
import type { PlegmaFile, PlegmaHomeFile, PlegmaStoriesFile, PlegmaStory } from '~/utils/plegma/plegma-world'
import { homeIndex, HOME_WEBS, HOME_WEBS_PHONE } from '~/utils/home'
import { createStageState } from '~/utils/plegma/stage/stage-state'
import { createStageCore } from '~/utils/plegma/stage/stage-core'
import { createStageArticles } from '~/utils/plegma/stage/stage-articles'
import { createStageTheme } from '~/utils/plegma/stage/stage-theme'
import { clamp, mixHex, orbit, TAU, withAlpha } from '~/utils/plegma/stage/stage-draw-util'

// The Plegma: one canvas behind the pages, in the layout, so it outlives a page change and a flight can end on another page (KTD1). It draws every story of the
// fixtures at its permanent place (plegma.json), with the look of the home hero: a web for a story, a dot for the rest, dashed arcs along a theme. The route says what
// is in focus (stores/plegma.ts); when it changes the camera flies there (utils/plegma/plegma-camera.ts). On a route without the plegma page meta the stage is hidden and stops.
// The parts of the stage are in utils/plegma/stage/: the shared state, the core (focus, camera, colors), the story's articles, the theme's web.
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
const deps = { plegma, reduced, locale }
const core = createStageCore(st, deps)
const { coreOf, spokeSet, name, colourOf, drift, readTokens, behind, focusStory, focusIssue, focusOutlet, webFocus, targetCamera, CLEAR_PAD, placed, gatherTo, gatherR, ease, visible, arcOf } = core
const { drawArticles, articleAt, ringAt, articleWorldRadius, ringOf, sectorOf, byOutlet } = createStageArticles(st, deps, core)
const { themeDisc, themeWebOf, themeNodeAt, themeRingAt, drawTheme } = createStageTheme(st, deps, core)

const stories = useFixtureLazy<PlegmaStoriesFile>('stories', { required: ['dates', 'issues', 'stories'] })
const home = useFixtureLazy<PlegmaHomeFile>('home', { required: ['issues', 'issueDaily'] })
const file = useFixtureLazy<PlegmaFile>('plegma', { required: ['places', 'world'] })

let raf = 0

const EMPTY = new Set<PlegmaStory>()
// The most lines from a picked story to other stories.
const SPOKES_MAX = 6

// The world behind a view is seen from far away (the page is its background); the web in view is drawn at the camera's own zoom in front of it.
const BACK_Z = 0.66

// A web that comes into view (a story, a theme, an outlet) is not there at once: it grows. Its nodes leave the center and go to their places, the nearer ones first, then its lines
// and its ring come in. It starts when the camera is half way through its flight (the web would be drawn on a moving map before), and only when the view has measured its
// free area, so it never grows unseen. With reduced motion it is all at once.
const INTRO_MS = 1100
const INTRO_AT = 0.3
let introKey = ''
let introAt = -1






const fly = () => {
  const to = targetCamera()
  if (!to) return
  st.walk = null
  st.flight = redirectFlight(st.flight, st.cam, to, performance.now(), st.width, reduced.value)
  if (st.flight.dur <= 0) { Object.assign(st.cam, to); st.flight = null }
  plegma.setLanded(!st.flight)
  kick()
}

// ---- the picked story: one node for each article ----
let lineMix = 0
let lineLast: number | null = null
let lastNow = 0



// ---- drawing ----

// ---- a theme in view ----



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
let walks = 0
const fogged = ref(true)
const nodeAt = new Float32Array(64)
const explore = (x: number, y: number) => {
  const at = toWorld(st.cam, st.width, st.height, { x, y })
  heroSources.push({ x: at.x, y: at.y, t0: performance.now() })
  if (heroSources.length > 6) heroSources.splice(1, 1)
  if (walks < HERO_WALK_MAX) {
    walks++
    const framed = targetCamera()
    st.walk = { x: st.cam.x + (at.x - st.cam.x) * HERO_WALK_PULL, y: st.cam.y + (at.y - st.cam.y) * HERO_WALK_PULL, z: Math.min(st.cam.z * HERO_WALK_ZOOM, (framed?.z ?? st.cam.z) * 1.35) }
    if (reduced.value) { Object.assign(st.cam, st.walk); st.walk = null }
  }
  tooltip.hide()
  kick()
}
const drawHero = (now: number, sec: number, dt: number) => {
  const c = st.ctx!
  const f = st.ctxFocus!
  const z = st.cam.z
  if (heroT0 < 0) heroT0 = now
  const first = heroSources[0]
  st.heroCleared = !!first && (reduced.value || now - first.t0 >= heroClearMs(st.width, st.height))
  if (fogged.value === st.heroCleared) fogged.value = !st.heroCleared
  st.lantern.v = ease(st.lantern.v, st.lantern.on && !st.heroCleared ? 1 : 0, dt)
  const appearAll = reduced.value ? 1 : smooth(0, 1, (now - heroT0) / (HERO_APPEAR + 300))
  // How clear a point is: the best of the waves that have passed it and the lantern. `pad` keeps a wide web lit while the lantern is near its edge.
  const clear = (wx: number, wy: number, sx: number, sy: number, pad: number) => {
    let r = 0
    for (const src of heroSources) r = Math.max(r, waveReveal(Math.hypot(wx - src.x, wy - src.y) * z, reduced.value ? 1e6 : now - src.t0))
    if (st.lantern.v > 0.01) r = Math.max(r, 0.7 * st.lantern.v * lanternReveal(Math.max(0, Math.hypot(sx - st.lantern.x, sy - st.lantern.y) - pad), LANTERN))
    return r
  }
  const homeSet = new Set(st.webs)
  const fogBuckets: Path2D[] = [new Path2D(), new Path2D(), new Path2D(), new Path2D()]
  const dotBuckets = new Map<number, { colour: string, alpha: number, path: Path2D }>()
  const list: { s: PlegmaStory, strong: boolean }[] = []
  for (const s of visible(80, z)) {
    const strong = homeSet.has(s)
    const base = drawLevel(s, z, strong, false)
    if (base > 0) { list.push({ s, strong }); continue }
    if (z < 0.3 && !strong && s.n < PLEGMA_FAR_MIN) continue
    const r = clamp(0.7 + 0.35 * Math.log10(s.n + 1) * (z < 0.22 ? 1.4 : 1.8) * Math.sqrt(Math.max(z, 0.5)), 0.8, 5)
    const bx = (s.x - st.cam.x) * z
    const by = (s.y - st.cam.y) * z
    const dd = sec ? orbit(bx, by, sec) : null
    const px = bx + st.width / 2 + (dd ? dd.x : 0)
    const py = by + st.height / 2 + (dd ? dd.y : 0)
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
  c.fillStyle = st.ink
  fogBuckets.forEach((p, q) => { if (q < 4) { c.globalAlpha = 0.17 * appearAll * (1 - q / 4); c.fill(p) } })
  for (const b of dotBuckets.values()) { f.globalAlpha = b.alpha * appearAll; f.fillStyle = b.colour; f.fill(b.path) }

  // The webs: loose and black until the wave passes, then they gather into their clusters; the clusters sway as one, the nodes a little on their own.
  const rd = clamp(1.3 * Math.sqrt(z) + 0.9, 1.6, 4.4)
  const zw = Math.max(z, 1.1)
  let cleared = 0
  for (const { s, strong } of list) {
    const w = heroWebOf(st.world!, s)
    const p = toScreen(st.cam, st.width, st.height, s)
    const dd = sec ? drift(s, sec) : null
    const cx = p.x + (dd ? dd.x : 0)
    const cy = p.y + (dd ? dd.y : 0)
    if (cx < -w.r * zw * 3 || cx > st.width + w.r * zw * 3 || cy < -w.r * zw * 3 || cy > st.height + w.r * zw * 3) continue
    const target = clear(s.x, s.y, cx, cy, w.r * zw)
    const was = st.heroRev.get(s.id) ?? 0
    const rev = reduced.value ? target : was + (target - was) * (1 - Math.exp(-dt * (target > was ? 7 : 2.5)))
    st.heroRev.set(s.id, rev > 0.995 ? 1 : rev)
    if (homeSet.has(s)) cleared += rev
    const e = 1 - Math.pow(1 - rev, 3)
    // Unexplored, the web as a whole also lies away from its place; the click brings it home.
    const away = looseOf(s.id, 99)
    const ox = away.x * HERO_AWAY * (1 - e)
    const oy = away.y * HERO_AWAY * (1 - e)
    const appear = reduced.value ? 1 : smooth(0, 1, (now - heroT0 - (cx / Math.max(st.width, 1)) * 700 - 150) / HERO_APPEAR)
    const hot = st.hover === s ? 1.25 : 1
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
      c.strokeStyle = st.ink
      c.fillStyle = st.ink
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
      const ink2 = mixHex(st.ink, col, smooth(0, 0.75, rev))
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
  const shown = st.webs.length ? cleared / st.webs.length : 0
  if (shown > 0.02) {
    const issues = new Set<number>()
    for (const s of st.webs) issues.add(s.issue)
    f.lineWidth = 1.2
    f.setLineDash([2, 5])
    for (const k of issues) {
      const arcs = arcsOf(st.world!, k)
      if (!arcs.length) continue
      const slot = st.world!.slotOf.get(k)
      f.strokeStyle = slot ? st.cats[slot - 1] ?? st.mute : st.mute
      f.globalAlpha = 0.5 * shown
      f.beginPath()
      for (const arc of arcs) arcOf(f, arc.a, arc.b, arc.sign, sec)
      f.stroke()
    }
    f.setLineDash([])
  }
  // The rings: where a click was, the edge of its wave; before the first click an invitation, a ring that goes out from the largest web now and then.
  f.strokeStyle = st.ink
  f.lineWidth = 1
  for (const src of heroSources) {
    const reach = HERO_SPEED * (now - src.t0) / 1000
    const max = heroReach(st.width, st.height)
    if (reach <= 0 || reach >= max) continue
    const at = toScreen(st.cam, st.width, st.height, src)
    f.globalAlpha = 0.16 * (1 - reach / max)
    f.beginPath()
    f.arc(at.x, at.y, reach, 0, TAU)
    f.stroke()
  }
  if (!heroSources.length && !reduced.value && sec > HINT_AFTER && st.lantern.v < 0.05 && st.webs.length) {
    const t = ((sec - HINT_AFTER) % HINT_EVERY) / 2.4
    if (t < 1) {
      const at = toScreen(st.cam, st.width, st.height, st.webs[0]!)
      const dd = drift(st.webs[0]!, sec)
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
// region and grows, and fades out as the web of the story grows in its place. `st.wasTheme` is the theme in view in the last frame; `st.diveSpot` is its story nodes' places.
const DIVE_MS = 900
const DIVE_SCALE = 3.4
const diveInto = (at: PlegmaPoint) => {
  const stage = canvas.value?.parentElement
  if (!stage || !canvas.value || !canvasFocus.value || reduced.value || !plegma.region) return
  const rb = regionBox(st.width, st.height, plegma.region)
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
  if (!st.ctx || !st.ctxFocus || !st.world) return
  const c = st.ctx
  const f = st.ctxFocus
  const homeNow = !focusStory() && focusIssue() === null && focusOutlet() === null && !behind()
  if (wasHome && !homeNow && plegma.active) keepHeroFrame()
  wasHome = homeNow
  const picked = focusStory()
  if (st.wasTheme && picked && plegma.active) {
    const at = st.diveSpot.get(picked.id)
    const to = at && !reduced.value && plegma.region ? targetCamera() : null
    if (at && to) {
      // The copy covers the cut: the camera is at the story at once, so its web grows under the dive, and the cards wait for the dive to be half done.
      diveInto(at)
      Object.assign(st.cam, to)
      st.flight = null
      window.setTimeout(() => plegma.setLanded(true), DIVE_MS * 0.5)
    }
  }
  st.wasTheme = false
  for (const g of [c, f]) { g.setTransform(st.dpr, 0, 0, st.dpr, 0, 0); g.clearRect(0, 0, st.width, st.height) }
  const z = st.cam.z
  const sec = reduced.value ? 0 : now / 1000
  const dt = Math.min(0.1, Math.max(0, (now - lastNow) / 1000))
  lastNow = now
  if (plegma.highlight) st.hlLast = plegma.highlight
  st.hlMix = ease(st.hlMix, plegma.highlight ? 1 : 0, dt)
  st.ringMix = reduced.value ? (plegma.ring === 'stance' ? 1 : 0) : st.ringMix + ((plegma.ring === 'stance' ? 1 : 0) - st.ringMix) * (1 - Math.exp(-dt * 4))
  for (const [key, v] of st.ringHot) {
    const next = ease(v, key === st.hoverRing ? 1 : 0, dt)
    if (next < 0.005 && key !== st.hoverRing) st.ringHot.delete(key)
    else st.ringHot.set(key, next)
  }
  if (st.hoverRing && !st.ringHot.has(st.hoverRing)) st.ringHot.set(st.hoverRing, 0)
  if (plegma.hoverStory !== null) lineLast = plegma.hoverStory
  lineMix = ease(lineMix, plegma.hoverStory !== null ? 1 : 0, dt)
  const story = focusStory()
  const other = plegma.compare !== null ? st.world.byId.get(plegma.compare) ?? null : null
  const issue = focusIssue()
  const outletOn = focusOutlet() !== null
  const onHome = !story && issue === null && !outletOn && !behind()
  if (onHome) { st.push = null; introKey = ''; introAt = -1; drawHero(now, sec, dt); return }
  // The intro of the web in view: it waits for the camera and for the view's free area, then grows (see INTRO_MS).
  const key = story ? `s${story.id}` : outletOn ? `o${focusOutlet()}` : issue !== null ? `t${issue}` : ''
  if (key !== introKey) { introKey = key; introAt = -1 }
  if (introAt < 0 && key && plegma.region && (!st.flight || (now - st.flight.t0) / Math.max(st.flight.dur, 1) >= INTRO_AT)) introAt = now
  st.introP = !key || reduced.value ? 1 : introAt < 0 ? 0 : clamp((now - introAt) / INTRO_MS, 0, 1)
  st.nodeIn = smooth(0, 0.18, st.introP)
  st.lineIn = smooth(0.3, 0.85, st.introP)
  st.ringIn = smooth(0.55, 1, st.introP)
  // The theme that is lit: the one of the story or the theme in focus, or the one under the pointer.
  const lit = st.hover ? st.hover.issue : story ? story.issue : issue
  const litCoded = lit !== null && !st.world.issues[lit]!.catchAll
  const core = issue !== null ? coreOf(issue) : story?.coded ? spokeSet(story.issue) : EMPTY
  const homeSet = new Set(st.webs)
  const dim = onHome ? 0.38 : issue !== null || outletOn ? 0.13 : 0.2
  st.push = story ? { s: story, r: articleWorldRadius(story) * 1.25 + CLEAR_PAD } : null
  const bz = onHome ? z : BACK_Z
  // The background is seen from the web: the world point at the middle of the map region stays there, and the world around it is drawn at the far zoom.
  const rb = regionBox(st.width, st.height, plegma.region ?? undefined)
  const fx = st.cam.x + (rb.cx - st.width / 2) / z
  const fy = st.cam.y + (rb.cy - st.height / 2) / z
  const dotBuckets: ({ colour: string, alpha: number, path: Path2D } | undefined)[] = []
  const drawn: { s: PlegmaStory, level: 1 | 2, alpha: number, focus: boolean, crisp: boolean }[] = []

  for (const s of visible(80, Math.min(z, bz))) {
    const isFocus = s === story || s === other
    const strong = isFocus || homeSet.has(s) || core.has(s) || s === st.hover
    // In a theme view the web is the theme: the map behind it is all background.
    const sameTheme = issue === null && !outletOn && litCoded && s.issue === lit && s.coded
    const alpha = strong ? 1 : onHome ? dim : sameTheme ? 0.7 : 0.55
    // In a view the story, its pair, the stories of the theme and the one under the pointer are crisp; the rest is a blurred background of dots with no lines.
    const crisp = !onHome && (isFocus || core.has(s) || s === st.hover)
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
      const bx = back ? (s.x - fx) * bz : (where.x - st.cam.x) * zz
      const by = back ? (s.y - fy) * bz : (where.y - st.cam.y) * zz
      const dd = (onHome || back) && sec ? orbit(bx, by, sec) : null
      const px = bx + (back ? rb.cx : st.width / 2) + (dd ? dd.x : 0)
      const py = by + (back ? rb.cy : st.height / 2) + (dd ? dd.y : 0)
      bucket.path.moveTo(px + r, py)
      bucket.path.arc(px, py, r, 0, TAU)
    } else drawn.push({ s, level, alpha, focus: isFocus, crisp })
  }
  for (const bucket of dotBuckets) { if (!bucket) continue; c.globalAlpha = bucket.alpha; c.fillStyle = bucket.colour; c.fill(bucket.path) }

  // The webs: each dot goes round on a small circle of its own, so a web breathes; the lines are not straight, each bows to one side.
  const rd = clamp(1.3 * Math.sqrt(z) + 0.9, 1.6, 4.4)
  c.lineWidth = 1
  for (const { s, level, alpha, focus, crisp } of drawn) {
    const c = crisp ? f : st.ctx!
    if (s === story && level > 0) { drawArticles(c, s, level as 1 | 2, sec); continue }
    const w = webOf(st.world, s, focus ? PLEGMA_FOCUS_DOTS : 0)
    const p = toScreen(st.cam, st.width, st.height, placed(s))
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
      c.fillStyle = st.paper
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
  if (st.hover && !(story && st.hover.issue === story.issue)) issues.add(st.hover.issue)
  if (onHome) for (const s of st.webs) issues.add(s.issue)
  const a = onHome ? c : f
  a.lineWidth = 1.2
  a.setLineDash([2, 5])
  for (const k of issues) {
    const arcs = arcsOf(st.world, k)
    if (!arcs.length) continue
    const slot = st.world.slotOf.get(k)
    a.strokeStyle = slot ? st.cats[slot - 1] ?? st.mute : st.mute
    a.globalAlpha = onHome ? 0.5 : 0.6
    a.beginPath()
    for (const arc of arcs) arcOf(a, arc.a, arc.b, arc.sign, onHome ? sec : 0)
    a.stroke()
  }
  a.setLineDash([])
  if (issue !== null || outletOn) drawTheme(f, sec, dt)
  // A story with a theme of its own is joined, by curved lines, to the largest stories of that theme and to the stories its card lists; they leave from the edge of its web,
  // spread around it by the direction they go in, and fade toward the other story. The story a card of other stories points at has its line lit: solid, glowing, flowing.
  const pointed = lineLast !== null && lineMix > 0.01 ? st.world.byId.get(lineLast) ?? null : null
  if (story && !onHome && (story.coded || pointed)) {
    const here = toScreen(st.cam, st.width, st.height, placed(story))
    const ring = ringOf(articleWorldRadius(story) * st.cam.z)
    const edge = ring + 9
    const colour = story.slot > 0 ? colourOf(story) : st.cats[0] ?? st.mute
    const listed: PlegmaStory[] = []
    for (const id of plegma.related) { const b = st.world.byId.get(id); if (b && b !== story) listed.push(b) }
    const rest: PlegmaStory[] = []
    if (story.coded) for (const b of spokeSet(story.issue)) if (b !== story && !listed.includes(b)) rest.push(b)
    // The stories its card lists, then the nearest of the largest of its theme: a few lines read, two dozen are a fan.
    rest.sort((b1, b2) => Math.hypot(b1.x - story.x, b1.y - story.y) - Math.hypot(b2.x - story.x, b2.y - story.y))
    const targets = story.coded ? [...listed, ...rest.slice(0, Math.max(0, SPOKES_MAX - listed.length))] : []
    if (pointed && pointed !== story && !targets.includes(pointed)) targets.push(pointed)
    const lines = targets.map((b) => {
      const q = toScreen(st.cam, st.width, st.height, placed(b))
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
      f.strokeStyle = st.ink
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
// The stage is behind the page, so the pointer is read on the window; a card, a link or a control under it is not the map.
const CAPTURES = 'a, button, input, select, textarea, [role="dialog"], .dcard, .plegma-card, .plegma-day, .plegma-title, .plegma-dock, .kpi-tile, .page-head, .section-nav, .trail-bar, .header-bar, .sidebar, .page-footer, .tooltip'
const pickAt = (x: number, y: number, reach: number) => {
  if (!st.world) return null
  let best: PlegmaStory | null = null
  let bestDistance = reach
  for (const s of visible(reach / st.cam.z + 20)) {
    if (s.n < PLEGMA_WEB_MIN && s !== focusStory()) continue
    const p = { ...toScreen(st.cam, st.width, st.height, placed(s)) }
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
  st.lantern.on = false
  if (!st.hover && st.hoverArticle < 0 && st.hoverNode < 0 && !st.hoverRing) return
  st.hover = null
  st.hoverArticle = -1
  st.hoverNode = -1
  st.hoverRing = ''
  if (st.ringLit) { st.ringLit = false; plegma.setHighlight(null) }
  tooltip.hide()
  if (reduced.value) kick()
}
useEventListener(window, 'pointermove', (e: PointerEvent) => {
  if (!plegma.active || !st.world || e.pointerType === 'touch' || !pointerFine.value || phone.value) return
  if ((e.target as Element | null)?.closest?.(CAPTURES)) return leave()
  const p = local(e)
  // In the hero the pointer is a lantern: a small patch of the ground under it clears.
  const inHero = plegma.focus === null && !behind()
  st.lantern.on = inHero && !reduced.value
  if (st.lantern.on) { st.lantern.x = p.x; st.lantern.y = p.y }
  // On the picked story the pointer finds an article first: its outlet and its day.
  const story = focusStory()
  const list = plegma.articles
  if (story && list && list.length === story.n && plegma.landed) {
    const i = articleAt(story, p.x, p.y)
    if (i >= 0) {
      const article = list[articleOfNode(i, list.length)]!
      const per = articlesPerNode(story.n)
      if (st.hoverArticle !== i && reduced.value) kick()
      st.hover = null
      st.hoverArticle = i
      if (st.ringLit) { st.ringLit = false; plegma.setHighlight(null) }
      // A node that stands for an article of the sample of headlines (or for several, one of which is in it) has the title of that article, with its outlet and day under it.
      const nodes = nodeCount(story.n)
      const from = Math.floor((i * story.n) / nodes)
      const to = Math.max(from + 1, Math.floor(((i + 1) * story.n) / nodes))
      let titled: typeof article | undefined
      for (let k = from; k < to && !titled; k++) if (list[k]!.title) titled = list[k]
      const group = article.group ?? t('story.nogroup')
      const date = fmtDate(st.world.dates[(titled ?? article).day]!)
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
    if (st.hoverArticle >= 0) { st.hoverArticle = -1; if (reduced.value) kick() }
    const arc = ringAt(story, p.x, p.y)
    if (arc) {
      const key = `${arc.kind}${arc.k}`
      if (st.hoverRing !== key && reduced.value) kick()
      const changed = st.hoverRing !== key
      st.hover = null
      st.hoverRing = key
      if (arc.kind === 'g') {
        const mine = list.filter(x => sectorOf(x) === arc.k)
        const first = mine[0]
        if (changed && first) { plegma.setHighlight(byOutlet() ? { group: first.group, outlet: first.outlet } : { group: first.group }); st.ringLit = true }
        tooltip.show({
          title: byOutlet() ? first?.outlet ?? '' : first?.group ?? t('story.nogroup'),
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
    if (st.hoverRing) { st.hoverRing = ''; tooltip.hide(); if (reduced.value) kick() }
    if (st.ringLit) { st.ringLit = false; plegma.setHighlight(null) }
  }
  // On the web of a theme the pointer finds a story or an outlet of a story; on the web of an outlet, a story or a day of it.
  if (webFocus()) {
    const i = themeNodeAt(p.x, p.y)
    const web = themeWebOf()
    if (i > 0 && web) {
      if (st.hoverNode !== i && reduced.value) kick()
      st.hover = null
      st.hoverNode = i
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
    if (st.hoverNode >= 0) { st.hoverNode = -1; if (reduced.value) kick() }
    const arc = themeRingAt(p.x, p.y)
    if (arc) {
      const key = `${arc.kind}${arc.k}`
      if (st.hoverRing !== key && reduced.value) kick()
      st.hover = null
      st.hoverRing = key
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
    if (st.hoverRing) { st.hoverRing = ''; tooltip.hide(); if (reduced.value) kick() }
  }
  const best = pickAt(p.x, p.y, 14)
  if (!best) return leave()
  // Ground that is still black has nothing to tell yet.
  if (inHero && !st.heroCleared && (st.heroRev.get(best.id) ?? 0) < 0.9) { st.hover = null; tooltip.hide(); return }
  if (st.hover !== best && reduced.value) kick()
  st.hover = best
  const issueName = (st.world.issues[best.issue]!)
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
  if (!plegma.active || !st.world || e.button !== 0 || e.defaultPrevented) return
  if ((e.target as Element | null)?.closest?.(CAPTURES)) return
  const box = canvas.value!.getBoundingClientRect()
  const p = { x: e.clientX - box.left, y: e.clientY - box.top }
  // In the hero a click explores: it opens no story (any pointer, a phone too).
  if (plegma.focus === null && !behind()) { explore(p.x, p.y); return }
  if (!pointerFine.value || phone.value || st.hoverArticle >= 0 || st.hoverRing) return
  // A story of the web of a theme opens that story.
  const web = webFocus() ? themeWebOf() : null
  if (web && st.hoverNode > 0 && st.hoverNode < web.n) {
    const id = web.stories[web.story[st.hoverNode]!]!.id
    tooltip.hide()
    st.hoverNode = -1
    navigateTo(storyHref(id))
    return
  }
  const best = pickAt(p.x, p.y, 18)
  if (best) { tooltip.hide(); st.hover = null; navigateTo(storyHref(best.id)) }
})

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
