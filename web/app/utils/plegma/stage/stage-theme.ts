import { regionBox } from '../plegma-camera'
import { ringEmptiedTo } from '../plegma-leave'
import { RING_START } from '../plegma-ring'
import { smooth } from '../plegma-hero'
import { buildThemeWeb } from '../plegma-theme'
import type { PlegmaThemeWeb } from '../plegma-theme'
import { TAU, arcThick, clamp, shareArcs } from './stage-draw-util'
import type { StageState } from './stage-state'
import type { StageCore, StageDeps } from './stage-core'
import { NAME_MAX, createStageNames } from './stage-names'
import type { NameItem } from './stage-names'

// A theme or an outlet in view: its web in the middle of the map region, and what the pointer finds on it.
// The names of the stories that show while a theme opens: the length of the intro of the web (stage-draw.ts INTRO_MS), how long after its dot a name starts, how long one takes to come, stays and goes, and the longest line of a name in px and the height of a line.
const INTRO_S = 1.1
const INTRO_NAMES_LAG = 0.05
const INTRO_NAMES_IN = 0.3
const INTRO_NAMES_HOLD = 1.0
const INTRO_NAMES_OUT = 0.4
const INTRO_NAME_W = 190
const INTRO_NAME_LINE = 15
export const createStageTheme = (st: StageState, deps: StageDeps, core: StageCore) => {
  const { plegma, reduced } = deps
  const { webFocus, focusOutlet, focusIssue, gatherTo, gatherR, ease } = core
  const { drawNames, drawNamesColumns, stanceNames } = createStageNames(st, deps)
  // A theme's web (not an outlet's) has the look of the story's: small rings with nothing inside, thicker arcs, and the name of each arc.
  const NODE_SCALE = 0.82
  // The arc of the ring of a theme under the pointer: a group, or a stance once the ring has turned to it.
  const themeRingAt = (x: number, y: number) => {
    const disc = themeDisc()
    const groups = plegma.themeGroups
    if (!disc || !groups?.length || ringTurn.from || Math.abs(Math.hypot(x - disc.x, y - disc.y) - disc.r) > 7) return null
    const at = (Math.atan2(y - disc.y, x - disc.x) + Math.PI / 2 + TAU) % TAU
    const inside = (start: number, span: number) => span > 0 && (((at - start) % TAU) + TAU) % TAU <= span
    const arcs = st.ringMix > 0.5 ? shareArcs(plegma.stance) : shareArcs(groups.map(g => g.n))
    if (!arcs) return null
    for (let k = 0; k < arcs.length / 2; k++) if (inside(arcs[k * 2]!, arcs[k * 2 + 1]!)) return { kind: st.ringMix > 0.5 ? 's' as const : 'g' as const, k }
    return null
  }
  // The web of the theme (utils/plegma/plegma-theme.ts), in the middle of the map region: the theme at the center, its stories on the first circle, the outlets of each story
  // around it in the sector of the story. It has the look of the web of a story: solid nodes with a rim of the page's color, the calm colors of the groups, a ring of arcs.
  const themed = { key: '', web: null as PlegmaThemeWeb | null, index: new Map<number, number>() }
  let hx = new Float32Array(0)
  let hy = new Float32Array(0)
  // What is pointed at: a story (in the card of the stories or on the web) or an outlet (on the web: it comes forward in every story that has it). It eases in and out.
  let themeMix = 0
  let themeLit: { story: number, outlet: string | null } = { story: -1, outlet: null }
  // The story is lit by the pointer on its node: the tooltip names it then, so the web does not write the name again (a story pointed at in a card has no tooltip, and the web names it).
  let themeLitOnNode = false
  // How long (s) the names of the stories have been in view since the dots of a theme came in (see the block before «The name of the story pointed at»).
  let introNames = 0
  // Turning the ring from the outlets to the groups (or back) the old arcs go a quarter turn on and fade while the new ones come in from a quarter turn back, as on the web of a story.
  const RING_MORPH_MS = 900
  type ThemeGroups = NonNullable<typeof plegma.themeGroups>
  const ringTurn = { key: '', tab: '', list: null as ThemeGroups | null, from: null as ThemeGroups | null, at: 0 }
  const ringBlend = () => {
    const list = plegma.themeGroups
    const key = list?.map(x => x.name).join('|') ?? ''
    if (key !== ringTurn.key) {
      // Not from the stance: the arcs of the groups were not on the screen then, the arcs of the stance were.
      ringTurn.from = ringTurn.list?.length && list?.length && !reduced.value && ringTurn.tab !== 'stance' ? ringTurn.list : null
      ringTurn.at = performance.now()
      ringTurn.key = key
    }
    ringTurn.list = list
    ringTurn.tab = plegma.ring
    if (!ringTurn.from) return { from: null, blend: 1 }
    const k = (performance.now() - ringTurn.at) / RING_MORPH_MS
    if (k >= 1) { ringTurn.from = null; return { from: null, blend: 1 } }
    return { from: ringTurn.from, blend: 1 - Math.pow(1 - k, 3) }
  }
  const themeDisc = () => {
    if (!plegma.region) return null
    const box = regionBox(st.width, st.height, plegma.region)
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
  // On a theme's web a story is as large as its articles (the area follows them), from 3.5 to 12 px; on an outlet's web the stories keep their small size.
  const themeNodeRadius = (web: PlegmaThemeWeb, i: number, unit: number) =>
    gatherR(i, i === 0 ? 8 : web.outlet[i]! < 0 ? (focusOutlet() === null ? 3.5 + 8.5 * web.size[i]! : 4.2 + 3.2 * web.size[i]!) : clamp(unit * (0.13 + 0.12 * web.size[i]!), 1.6, 5))
  // When each node of the web comes in (0 to 1, as gatherTo takes it): the stories by their size, the largest first, then each of its outlets a little after it; the center first of all.
  const arrival = new WeakMap<PlegmaThemeWeb, number[]>()
  const storyArrival = (web: PlegmaThemeWeb) => {
    let list = arrival.get(web)
    if (!list) {
      const k = web.stories.length
      const bySize = Array.from({ length: k }, (_, i) => i).sort((a, b) => web.size[1 + b]! - web.size[1 + a]! || a - b)
      list = new Array<number>(k)
      bySize.forEach((story, rank) => { list![story] = k > 1 ? (rank / (k - 1)) * 0.8 : 0 })
      arrival.set(web, list)
    }
    return list
  }
  const arrivalOf = (web: PlegmaThemeWeb, i: number) => {
    if (i === 0) return 0
    const o = storyArrival(web)[web.story[i]!] ?? 0
    return web.outlet[i]! < 0 ? o : Math.min(1, o + 0.04 + 0.12 * ((i * 0.618034) % 1))
  }
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
      if (st.introP < 1) { const at = gatherTo(i, web.n, hx[i]!, hy[i]!, arrivalOf(web, i)); hx[i] = at.x; hy[i] = at.y }
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
    const slotColour = (sl: number) => (sl > 0 ? st.cats[sl - 1] ?? st.mute : st.mute)
    const slot = outlet ? plegma.outletSlot : issue !== null ? st.world!.slotOf.get(issue) ?? 0 : 0
    const colour = slot > 0 ? slotColour(slot) : outlet ? st.ink : st.mute
    const fresh = !outlet
    const web = themeWebOf()
    const nodeSlot = (i: number) => {
      const s = web!.stories[web!.story[i]!]!
      return outlet ? s.slot ?? 0 : s.outlets[web!.outlet[i]!]!.slot
    }
    const storyColour = (i: number) => (outlet ? slotColour(web!.stories[i]!.slot ?? 0) : colour)
    g.font = `11px ${st.fontText}`
    g.textBaseline = 'alphabetic'
    // The story or the outlet pointed at, in the card or on the web.
    const node = web && st.hoverNode > 0 && st.hoverNode < web.n ? st.hoverNode : -1
    const cardStory = plegma.hoverStory !== null ? themed.index.get(plegma.hoverStory) ?? -1 : -1
    const lit = node > 0 ? (web!.outlet[node]! >= 0 ? { story: -1, outlet: web!.stories[web!.story[node]!]!.outlets[web!.outlet[node]!]!.name } : { story: web!.story[node]!, outlet: null }) : cardStory >= 0 ? { story: cardStory, outlet: null } : null
    if (lit) { themeLit = lit; themeLitOnNode = node > 0 }
    themeMix = ease(themeMix, lit ? 1 : 0, dt)
    if (web && plegma.region) {
      const { disc, unit } = layoutTheme(web, sec)
      const k = web.stories.length
      const mix = themeMix
      st.wasTheme = true
      st.diveSpot.clear()
      for (let i = 0; i < k; i++) st.diveSpot.set(web.stories[i]!.id, { x: hx[1 + i]!, y: hy[1 + i]!, r: themeNodeRadius(web, 1 + i, unit) })
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
          // A theme's web has no lines from the theme to its stories: the stories stand where they are.
          if (fresh) continue
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
      g.globalAlpha = 0.4 * back * st.lineIn
      for (const [key, path] of spokes) { g.strokeStyle = outlet ? slotColour(key) : colour; g.stroke(path) }
      for (const [group, path] of lines) { g.strokeStyle = st.softInk[group] ?? st.mute; g.globalAlpha = 0.6 * back * st.lineIn; g.stroke(path) }
      if (mix > 0.01) { g.strokeStyle = st.ink; g.globalAlpha = 0.45 * mix * st.lineIn; g.stroke(litLines) }
      // The nodes: a rim of the page's color under each, then its color.
      const rims = new Path2D()
      const fills = new Map<number, Path2D>()
      const rim = clamp(unit * 0.07, 0.7, 1.4)
      const circle = (path: Path2D, i: number, r: number) => { path.moveTo(hx[i]! + r, hy[i]!); path.arc(hx[i]!, hy[i]!, r, 0, TAU) }
      for (let i = 1 + k; i < web.n; i++) {
        const r = themeNodeRadius(web, i, unit)
        circle(rims, i, (fresh ? r * NODE_SCALE : r) + rim)
        if (mix > 0.01 && on(i)) continue
        const group = nodeSlot(i)
        let path = fills.get(group)
        if (!path) { path = new Path2D(); fills.set(group, path) }
        circle(path, i, fresh ? r * NODE_SCALE : r)
      }
      for (let i = 0; i <= k; i++) circle(rims, i, themeNodeRadius(web, i, unit) + 1.6)
      g.globalAlpha = st.nodeIn
      g.fillStyle = st.paper
      g.fill(rims)
      if (fresh) {
        // A node is a small ring in the color of its group with nothing inside it; the ones pointed at (below) are solid.
        g.lineWidth = clamp(unit * 0.06, 1, 1.6)
        for (const [group, path] of fills) { g.strokeStyle = group > 0 ? st.groupInk[group] ?? st.mute : st.mute; g.globalAlpha = back * st.nodeIn; g.stroke(path) }
      } else for (const [group, path] of fills) { g.fillStyle = st.softInk[group] ?? st.mute; g.globalAlpha = back * st.nodeIn; g.fill(path) }
      if (mix > 0.01) {
        for (let i = 1 + k; i < web.n; i++) {
          if (!on(i)) continue
          const group = nodeSlot(i)
          const r = themeNodeRadius(web, i, unit) * (1 + 0.25 * mix)
          g.fillStyle = group > 0 ? st.groupInk[group] ?? st.ink : st.mute
          g.globalAlpha = (0.7 + 0.3 * mix) * st.nodeIn
          g.beginPath()
          g.arc(hx[i]!, hy[i]!, r, 0, TAU)
          g.fill()
        }
      }
      // The stories and the theme: the color of the theme. A story that is pointed at, or that has the outlet pointed at, keeps its strength.
      for (let i = 1; i <= k; i++) {
        const strong = mix < 0.01 || (themeLit.outlet !== null ? web.stories[i - 1]!.outlets.some(o => o.name === themeLit.outlet) : themeLit.story === i - 1)
        g.fillStyle = storyColour(i - 1)
        g.globalAlpha = (strong ? 1 : back) * st.nodeIn
        g.beginPath()
        g.arc(hx[i]!, hy[i]!, themeNodeRadius(web, i, unit), 0, TAU)
        if (fresh) {
          // On a theme's web a story is a gray circle with nothing inside it (its size follows its articles), the way the outlets are small circles in their group's color.
          g.strokeStyle = st.mute
          g.lineWidth = 2
          g.globalAlpha = (strong ? 1 : back) * st.nodeIn
          g.stroke()
        } else g.fill()
      }
      g.globalAlpha = st.nodeIn
      g.fillStyle = colour
      g.beginPath()
      g.arc(hx[0]!, hy[0]!, themeNodeRadius(web, 0, unit), 0, TAU)
      if (fresh) {
        g.strokeStyle = st.mute
        g.lineWidth = 2
        g.globalAlpha = st.nodeIn
        g.stroke()
      } else g.fill()
      g.strokeStyle = st.ink
      g.globalAlpha = 0.5 * st.ringIn * (1 - st.ringOut)
      g.lineWidth = 1
      g.beginPath()
      g.arc(hx[0]!, hy[0]!, themeNodeRadius(web, 0, unit) + 4, 0, TAU)
      g.stroke()
      // The ring: a thin line, or, once the groups of the theme are known, an arc for each group (as wide as its share of the articles of the theme); it turns to the arcs of the
      // stance the way the ring of a story does.
      const groupAt = plegma.themeGroups?.length ? shareArcs(plegma.themeGroups.map(x => x.n)) : null
      if (groupAt) {
        const stanceAt = st.ringMix > 0.01 ? shareArcs(plegma.stance) : null
        const groupsOut = stanceAt ? st.ringMix : 0
        const turn = groupsOut * (Math.PI / 2)
        // Leaving the view: the arcs are emptied from the start of the ring on, the way they filled.
        const emptied = st.ringOut > 0 ? ringEmptiedTo(st.ringOut) : -Infinity
        g.lineCap = 'round'
        const { from: oldGroups, blend } = ringBlend()
        const oldAt = oldGroups ? shareArcs(oldGroups.map(x => x.n)) : null
        const arcSet = (list: ThemeGroups, arcs: Float32Array, extra: number, fade: number, hotOn: boolean) => {
          const top = Math.max(1, ...list.map(x => x.n))
          for (let k = 0; k < arcs.length / 2; k++) {
            const span = arcs[k * 2 + 1]!
            if (span <= 0) continue
            const slot = list[k]!.slot
            // As thick as its articles against the largest arc's: ARC_MIN px for the smallest to ARC_MAX px for the largest (a theme's web only; the web of a group or an outlet keeps its look).
            const thick = fresh ? arcThick(list[k]!.n, top) : 2
            const hot = hotOn ? st.ringHot.get(`g${k}`) ?? 0 : 0
            g.strokeStyle = hot > 0.01 ? (slot > 0 ? st.groupInk[slot] ?? st.ink : st.mute) : st.softInk[slot] ?? st.mute
            g.lineWidth = fresh ? thick + 1.4 * hot : thick + 2.5 * hot
            g.globalAlpha = (0.85 + 0.15 * hot) * fade * st.ringIn
            const pad = Math.min(span / 2, (fresh ? thick / 2 + 1.5 : 3) / disc.r)
            const from = Math.max(arcs[k * 2]! + pad, emptied)
            const to = arcs[k * 2]! + span - pad
            if (to <= from) continue
            g.beginPath()
            g.arc(disc.x, disc.y, disc.r, from - Math.PI / 2 + extra, to - Math.PI / 2 + extra)
            g.stroke()
          }
        }
        if (groupsOut < 0.99) {
          if (oldAt) arcSet(oldGroups!, oldAt, blend * (Math.PI / 2) + turn, (1 - blend) * (1 - groupsOut), false)
          arcSet(plegma.themeGroups!, groupAt, turn - (oldAt ? (1 - blend) * (Math.PI / 2) : 0), (1 - groupsOut) * blend, true)
        }
        if (stanceAt) {
          const back = (1 - st.ringMix) * (Math.PI / 2)
          const counts = plegma.stance ?? []
          const topStance = Math.max(1, ...counts)
          for (let k = 0; k < 3; k++) {
            const span = stanceAt[k * 2 + 1]!
            if (span <= 0) continue
            const hot = st.ringHot.get(`s${k}`) ?? 0
            const thick = fresh ? arcThick(counts[k] ?? 0, topStance) : 2
            g.strokeStyle = st.stanceInk[k] ?? st.mute
            g.lineWidth = thick + 2.5 * hot
            g.globalAlpha = (0.9 + 0.1 * hot) * st.ringMix * st.ringIn
            const pad = Math.min(span / 2, (fresh ? thick / 2 + 1.5 : 3) / disc.r)
            const from = Math.max(stanceAt[k * 2]! + pad, emptied)
            const to = stanceAt[k * 2]! + span - pad
            if (to <= from) continue
            g.beginPath()
            g.arc(disc.x, disc.y, disc.r, from - Math.PI / 2 - back, to - Math.PI / 2 - back)
            g.stroke()
          }
        }
        // The names and their lines go in the first half of the leave, while the arcs empty.
        const namesLeft = 1 - clamp(st.ringOut * 2, 0, 1)
        // The stance arcs are named on every web with a ring of arcs; the arcs of the outlets or groups only on the web of a theme (the web of a group names its outlets beside their dots).
        {
          const ring = { cx: disc.x, cy: disc.y, ring: disc.r, kx: 1 }
          if (fresh && groupsOut < 0.5) {
            const namesOf = (list: ThemeGroups, arcs: Float32Array): NameItem[] => list.flatMap((x, k) => {
              const total = list.reduce((sum, y) => sum + y.n, 0)
              const span = arcs[k * 2 + 1] ?? 0
              if (span <= 0 || !x.name) return []
              return [{ mid: arcs[k * 2]! + span / 2, span, text: `${x.name.length > NAME_MAX ? `${x.name.slice(0, NAME_MAX - 1)}…` : x.name} · ${fmtPct(x.n / total)}`, dot: x.slot > 0 ? st.groupInk[x.slot] ?? st.ink : st.mute }]
            })
            const names = 0.9 * (1 - groupsOut * 2) * (1 - 0.35 * mix) * st.ringIn * namesLeft
            if (oldAt) drawNamesColumns(g, ring, namesOf(oldGroups!, oldAt), names * clamp(1 - blend * 2, 0, 1))
            drawNamesColumns(g, ring, namesOf(plegma.themeGroups!, groupAt), names * (oldAt ? clamp(blend * 2 - 1, 0, 1) : 1))
          }
          if (stanceAt && st.ringMix > 0.5) drawNames(g, ring, stanceNames(stanceAt), 0.9 * (st.ringMix * 2 - 1) * st.ringIn * namesLeft, true)
        }
      } else {
        // The thin ring (a group, an outlet): it fills from the start of the ring clockwise as the web comes in, and empties from the start on while the view is left.
        const filled = RING_START + TAU * st.ringIn
        const emptied = st.ringOut > 0 ? ringEmptiedTo(st.ringOut) : RING_START
        if (filled > emptied + 0.001) {
          g.strokeStyle = colour
          g.globalAlpha = 0.45
          g.lineWidth = 1.2
          g.beginPath()
          g.arc(disc.x, disc.y, disc.r, emptied - Math.PI / 2, filled - Math.PI / 2)
          g.stroke()
        }
      }
      g.lineCap = 'butt'
      if (node > 0) {
        g.strokeStyle = st.ink
        g.globalAlpha = 0.85
        g.lineWidth = 1.2
        g.beginPath()
        g.arc(hx[node]!, hy[node]!, themeNodeRadius(web, node, unit) + rim + 2.5, 0, TAU)
        g.stroke()
      }
      // Opening a theme, the names of its stories show beside their dots while the dots come in: one after another, each with its dot (the largest story first, the others a little after, graded), each rising a little as it comes, and each
      // goes after a moment in the same order. Each is on the side of its dot where there is room (not on another name), in lines of at most INTRO_NAME_W px, the whole title; a story with no room has none. The story pointed at
      // has its own name below, so it has none here.
      introNames = st.introP <= 0 ? 0 : introNames + dt
      const namesEnd = INTRO_NAMES_LAG + (0.1 + 0.8 * 0.44) * INTRO_S + INTRO_NAMES_IN + INTRO_NAMES_HOLD + INTRO_NAMES_OUT
      // The web of a group (every node a link to an outlet) keeps its names: few outlets, so each stays written beside its dot, and they go with the ring when the view is left.
      const keep = k > 0 && web.stories.every(s => s.href)
      if ((fresh || keep) && st.introP > 0 && (keep || (!reduced.value && introNames < namesEnd)) && st.ringOut < 1) {
        g.font = `12px ${st.fontText}`
        g.textBaseline = 'middle'
        g.lineJoin = 'round'
        const from = storyArrival(web)
        const boxes: { x0: number, x1: number, y0: number, y1: number }[] = []
        for (let i = 0; i < k; i++) {
          // The whole title, in lines of at most INTRO_NAME_W px.
          const lines: string[] = []
          let line = ''
          for (const word of web.stories[i]!.name.split(/\s+/)) {
            const next = line ? `${line} ${word}` : word
            if (line && g.measureText(next).width > INTRO_NAME_W) { lines.push(line); line = word } else line = next
          }
          if (line) lines.push(line)
          const w = Math.max(...lines.map(l => g.measureText(l).width))
          const h = lines.length * INTRO_NAME_LINE
          const nx = hx[1 + i]!
          const ny = hy[1 + i]!
          const gap = themeNodeRadius(web, 1 + i, unit) + 6
          const inward = nx <= disc.x
          const spot = [[inward, 0], [!inward, 0], [inward, -0.6], [inward, 0.6], [!inward, -0.6], [!inward, 0.6], [inward, -1.1], [inward, 1.1], [!inward, -1.1], [!inward, 1.1]].map(([right, k2]) => {
            const x0 = right ? nx + gap : nx - gap - w
            const cy = ny + (k2 as number) * h
            return { right: right as boolean, x0, x1: x0 + w, y0: cy - h / 2, y1: cy + h / 2 }
          }).find(b => !boxes.some(o => b.x0 < o.x1 + 4 && b.x1 > o.x0 - 4 && b.y0 < o.y1 + 2 && b.y1 > o.y0 - 2) && (keep || (b.x0 > disc.x - disc.r && b.x1 < disc.x + disc.r)))
          if (!spot) continue
          boxes.push(spot)
          if (themeLit.story === i && mix > 0.5) continue
          const t0 = INTRO_NAMES_LAG + (0.1 + from[i]! * 0.44) * INTRO_S
          const rise = reduced.value ? 1 : smooth(t0, t0 + INTRO_NAMES_IN, introNames)
          const alpha = rise * (keep ? 1 - clamp(st.ringOut * 2, 0, 1) : (1 - smooth(t0 + INTRO_NAMES_IN + INTRO_NAMES_HOLD, t0 + INTRO_NAMES_IN + INTRO_NAMES_HOLD + INTRO_NAMES_OUT, introNames)) * (1 - st.ringOut))
          if (alpha < 0.01) continue
          g.textAlign = spot.right ? 'left' : 'right'
          const x = spot.right ? spot.x0 : spot.x1
          lines.forEach((text, n) => {
            const y = spot.y0 + (n + 0.5) * INTRO_NAME_LINE + (1 - rise) * 7
            g.globalAlpha = 0.95 * alpha
            g.strokeStyle = st.paper
            g.lineWidth = 4
            g.strokeText(text, x, y)
            g.globalAlpha = alpha
            g.fillStyle = st.ink
            g.fillText(text, x, y)
          })
        }
        g.font = `11px ${st.fontText}`
        g.textBaseline = 'alphabetic'
        g.globalAlpha = 1
      }
      // The name of the story pointed at, outside the ring.
      const order = web.stories.map((_, i) => i)
      if (themeLit.story >= 0 && mix > 0.5) { order.splice(order.indexOf(themeLit.story), 1); order.unshift(themeLit.story) }
      const taken: { x0: number, x1: number, y0: number, y1: number }[] = []
      g.lineJoin = 'round'
      for (const i of order) {
        const first = themeLit.story === i && mix > 0.5
        // The web is the size of a story's, so there is no room for the names around it: only the story pointed at has its name.
        if (!first || themeLitOnNode) continue
        if (fresh) {
          // On a theme's web the whole title of the story is at its circle: beside it, on the side toward the middle of the web, in lines of at most 190 px.
          const nx = hx[1 + i]!
          const ny = hy[1 + i]!
          const toRight = nx <= disc.x
          const gap = themeNodeRadius(web, 1 + i, unit) + 8
          g.font = `600 12px ${st.fontText}`
          g.textBaseline = 'middle'
          const lines: string[] = []
          let line = ''
          for (const word of web.stories[i]!.name.split(/\s+/)) {
            const next = line ? `${line} ${word}` : word
            if (line && g.measureText(next).width > 190) { lines.push(line); line = word } else line = next
          }
          if (line) lines.push(line)
          g.textAlign = toRight ? 'left' : 'right'
          const x = nx + (toRight ? gap : -gap)
          lines.forEach((text, n) => {
            const y = ny + (n - (lines.length - 1) / 2) * 15
            g.globalAlpha = 0.95
            g.strokeStyle = st.paper
            g.lineWidth = 4
            g.strokeText(text, x, y)
            g.globalAlpha = 1
            g.fillStyle = st.ink
            g.fillText(text, x, y)
          })
          g.font = `11px ${st.fontText}`
          g.textBaseline = 'alphabetic'
          continue
        }
        // The name is outside the ring, the way its story lies from the theme.
        const a = Math.atan2(web.y[1 + i]!, web.x[1 + i]!)
        const sx = Math.cos(a)
        const lx = disc.x + sx * (disc.r + 10)
        const ly = disc.y + Math.sin(a) * (disc.r + 10) + 4
        const full = web.stories[i]!.name
        const align = sx > 0.25 ? 'left' : sx < -0.25 ? 'right' : 'center'
        // A name has the room from the ring to the side of the map cell: a longer one is cut to fit it.
        const sides = regionBox(st.width, st.height, plegma.region)
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
        g.strokeStyle = st.paper
        g.lineWidth = 3.5
        g.strokeText(text, lx, ly)
        g.globalAlpha = first ? 1 : mix > 0.01 ? 0.55 : 1
        g.fillStyle = first ? st.ink : st.mute
        g.fillText(text, lx, ly)
      }
    }
    g.textAlign = 'start'
    g.globalAlpha = 1
  }
  return { themeDisc, themeWebOf, themeNodeAt, themeRingAt, drawTheme }
}

export type StageTheme = ReturnType<typeof createStageTheme>
