import { toScreen, toWorld } from '../plegma-camera'
import { HERO_SPEED, heroClearMs, heroReach, heroWebOf, lanternReveal, looseOf, smooth, waveReveal } from '../plegma-hero'
import type { HeroSource } from '../plegma-hero'
import { PLEGMA_FAR_MIN, arcsOf, drawLevel } from '../plegma-world'
import type { PlegmaStory } from '../plegma-world'
import { TAU, clamp, mixHex, orbit } from './stage-draw-util'
import type { StageState } from './stage-state'
import type { StageCore } from './stage-core'
import type { Ref } from 'vue'

// The hero: unexplored ground. With the hero in view the map is black, blurred nodes; a click starts a wave that clears the ground and the camera takes a step.
export interface HeroDeps { reduced: Ref<boolean>, tooltip: ReturnType<typeof useTooltipStore>, fogged: Ref<boolean>, kick: () => void }

export const createStageHero = (st: StageState, deps: HeroDeps, core: StageCore) => {
  const { reduced, tooltip, fogged, kick } = deps
  const { visible, drift, arcOf, colourOf, ease, targetCamera } = core
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
  return { explore, drawHero }
}

export type StageHero = ReturnType<typeof createStageHero>
