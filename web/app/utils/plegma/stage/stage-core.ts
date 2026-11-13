import { frameHome, framePair, frameStory, frameTheme, toScreen } from '../plegma-camera'
import type { PlegmaCamera, PlegmaPoint } from '../plegma-camera'
import { themeCore, themeFrameSet } from '../plegma-world'
import type { PlegmaStory } from '../plegma-world'
import { clamp, mixHex, orbit } from './stage-draw-util'
import type { StageState } from './stage-state'
import type { Ref } from 'vue'

// What every part of the stage uses: which story, theme or outlet is in focus, the camera that frames it, the colors, where a story is drawn (pushed, drifting, gathering in)
// and which stories are on the screen.
export interface StageDeps { plegma: ReturnType<typeof usePlegmaStore>, reduced: Ref<boolean>, locale: Ref<string> }

export const createStageCore = (st: StageState, deps: StageDeps) => {
  const { plegma, reduced, locale } = deps
  const cores = new Map<number, Set<PlegmaStory>>()
  const coreOf = (issue: number) => {
    let set = cores.get(issue)
    if (!set) { set = new Set(themeFrameSet(st.world!, issue)); cores.set(issue, set) }
    return set
  }
  const spokes = new Map<number, Set<PlegmaStory>>()
  // The stories a coded story is joined to: the largest of its theme.
  const spokeSet = (issue: number) => {
    let set = spokes.get(issue)
    if (!set) { set = new Set(themeCore(st.world!, issue)); spokes.set(issue, set) }
    return set
  }
  const name = (s: PlegmaStory) => (locale.value === 'en' && s.en) || s.el
  const colourOf = (s: PlegmaStory) => (s.slot > 0 ? st.cats[s.slot - 1] ?? st.mute : st.mute)
  const drift = (s: PlegmaStory, sec: number) => orbit((s.x - st.cam.x) * st.cam.z, (s.y - st.cam.y) * st.cam.z, sec)
  // The colors are tokens, read when the theme changes (they depend on it).
  const readTokens = () => {
    const style = getComputedStyle(document.documentElement)
    st.ink = style.getPropertyValue('--ink').trim() || '#111'
    st.mute = style.getPropertyValue('--text-secondary').trim() || st.mute
    st.paper = style.getPropertyValue('--surface-page').trim() || st.paper
    st.fontText = style.getPropertyValue('--font-text').trim() || st.fontText
    st.cats = Array.from({ length: 8 }, (_, i) => style.getPropertyValue(`--cat-${i + 1}`).trim() || st.mute)
    st.groupInk = Array.from({ length: 10 }, (_, i) => style.getPropertyValue(`--cat-${i}`).trim() || st.mute)
    st.stanceInk = ['critical', 'neutral', 'supportive'].map(k => style.getPropertyValue(`--stance-${k}`).trim() || st.mute)
    st.softInk = st.groupInk.map(c => mixHex(c, st.groupInk[0] ?? st.mute, 0.3))
  }
  // The map is only a dim world behind the page: Home's «Η επικαιρότητα» with a day picked, or a page of Μέσα that draws its own web (stores/plegma.ts backdrop).
  const behind = () => plegma.homeDay !== null || plegma.backdrop
  const focusStory = () => (st.world && plegma.focus?.kind === 'story' ? st.world.byId.get(plegma.focus.id) ?? null : null)
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
    if (!st.world || !st.width) return null
    const story = focusStory()
    if (story) {
      const other = plegma.compare !== null ? st.world.byId.get(plegma.compare) : null
      const region = plegma.region ?? undefined
      return other ? framePair(story, other, st.width, st.height, region).camera : frameStory(story, st.width, st.height, region)
    }
    const issue = focusIssue()
    if (issue !== null) {
      // A theme is framed on its largest stories; its web lies over this background.
      return frameTheme([...coreOf(issue)], st.width, st.height, plegma.region ?? undefined)
    }
    // Behind a page that draws its own web the world is framed as on Home, so its dust fills the screen.
    if (behind()) return st.weekWebs.length ? frameHome(st.weekWebs, st.width, st.height) : null
    return st.webs.length ? frameHome(st.webs, st.width, st.height) : null
  }
  // A story or a theme in view keeps a clear space around its web: the other stories near it are pushed out a little (a place on the screen, not in the world),
  // so the web does not sit in a crowd. Inside the radius R they are moved to between R and 1.4 R; outside it the push dies away.
  const CLEAR_PAD = 30
  const CLEAR_PUSH = 0.4
  const spot = { x: 0, y: 0 }
  const placed = (s: PlegmaStory): PlegmaPoint => {
    if (!st.push || s === st.push.s) return s
    const dx = s.x - st.push.s.x
    const dy = s.y - st.push.s.y
    const d = Math.hypot(dx, dy)
    const r = st.push.r
    if (d >= r * 5 || d === 0) return s
    const moved = d < r ? r + (d / r) * r * CLEAR_PUSH : d + r * CLEAR_PUSH * Math.exp(-(d - r) / r)
    spot.x = st.push.s.x + (dx / d) * moved
    spot.y = st.push.s.y + (dy / d) * moved
    return spot
  }
  let ge = new Float32Array(0)
  const gatherSpot = { x: 0, y: 0 }
  // Node `i` of a web whose center is (cx, cy) with radius R and whose place is (tx, ty): how far along it is now (ge[i]) and where it is.
  const gatherTo = (i: number, n: number, tx: number, ty: number, cx: number, cy: number, R: number) => {
    if (ge.length < n) ge = new Float32Array(n)
    const reach = Math.min(1, Math.hypot(tx - cx, ty - cy) / Math.max(R, 1))
    const delay = reach * 0.42 + ((i * 0.618034) % 1) * 0.12
    const t = clamp((st.introP - delay) / 0.46, 0, 1)
    const e = 1 - Math.pow(1 - t, 3)
    ge[i] = e
    gatherSpot.x = cx + (tx - cx) * e
    gatherSpot.y = cy + (ty - cy) * e
    return gatherSpot
  }
  // A node's radius on its way: a small dot at first, then its own.
  const gatherR = (i: number, r: number) => (st.introP < 1 ? r * (0.3 + 0.7 * (ge[i] ?? 1)) : r)
  const ease = (value: number, target: number, dt: number) => (reduced.value ? target : value + (target - value) * (1 - Math.exp(-dt * 9)))
  // The stories inside the screen: the list is sorted by x, so a zoomed camera looks at a small part of it.
  const visible = (margin: number, zz = st.cam.z) => {
    const half = st.width / 2 / zz + margin
    const x0 = st.cam.x - half
    const x1 = st.cam.x + half
    let lo = 0
    let hi = st.byX.length
    while (lo < hi) { const mid = (lo + hi) >> 1; if (st.byX[mid]!.x < x0) lo = mid + 1; else hi = mid }
    const y0 = st.cam.y - st.height / 2 / zz - margin
    const y1 = st.cam.y + st.height / 2 / zz + margin
    const out: PlegmaStory[] = []
    for (let i = lo; i < st.byX.length && st.byX[i]!.x <= x1; i++) if (st.byX[i]!.y >= y0 && st.byX[i]!.y <= y1) out.push(st.byX[i]!)
    return out
  }
  const arcOf = (ctx2: CanvasRenderingContext2D, a: PlegmaStory, b: PlegmaStory, sign: number, sec = 0) => {
    const p = { ...toScreen(st.cam, st.width, st.height, placed(a)) }
    if (sec) { const d = drift(a, sec); p.x += d.x; p.y += d.y }
    const q = { ...toScreen(st.cam, st.width, st.height, placed(b)) }
    if (sec) { const d = drift(b, sec); q.x += d.x; q.y += d.y }
    const dx = q.x - p.x
    const dy = q.y - p.y
    ctx2.moveTo(p.x, p.y)
    ctx2.quadraticCurveTo((p.x + q.x) / 2 - dy * 0.22 * sign, (p.y + q.y) / 2 + dx * 0.22 * sign, q.x, q.y)
  }
  return { coreOf, spokeSet, name, colourOf, drift, readTokens, behind, focusStory, focusIssue, focusOutlet, webFocus, targetCamera, CLEAR_PAD, placed, gatherTo, gatherR, ease, visible, arcOf }
}

export type StageCore = ReturnType<typeof createStageCore>
