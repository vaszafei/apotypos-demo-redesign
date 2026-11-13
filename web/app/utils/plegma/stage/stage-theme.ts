import { regionBox } from '../plegma-camera'
import { buildThemeWeb } from '../plegma-theme'
import type { PlegmaThemeWeb } from '../plegma-theme'
import { TAU, clamp, shareArcs } from './stage-draw-util'
import type { StageState } from './stage-state'
import type { StageCore, StageDeps } from './stage-core'

// A theme or an outlet in view: its web in the middle of the map region, and what the pointer finds on it.
export const createStageTheme = (st: StageState, deps: StageDeps, core: StageCore) => {
  const { plegma, reduced } = deps
  const { webFocus, focusOutlet, focusIssue, gatherTo, gatherR, ease } = core
  // The arc of the ring of a theme under the pointer: a group, or a stance once the ring has turned to it.
  const themeRingAt = (x: number, y: number) => {
    const disc = themeDisc()
    const groups = plegma.themeGroups
    if (!disc || !groups?.length || Math.abs(Math.hypot(x - disc.x, y - disc.y) - disc.r) > 7) return null
    const at = (Math.atan2(y - disc.y, x - disc.x) + Math.PI / 2 + TAU) % TAU
    const inside = (start: number, span: number) => span > 0 && (at - start + TAU) % TAU <= span
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
      if (st.introP < 1) { const at = gatherTo(i, web.n, hx[i]!, hy[i]!, disc.x, disc.y, disc.r); hx[i] = at.x; hy[i] = at.y }
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
    if (lit) themeLit = lit
    themeMix = ease(themeMix, lit ? 1 : 0, dt)
    if (web && plegma.region) {
      const { disc, unit } = layoutTheme(web, sec)
      const k = web.stories.length
      const mix = themeMix
      st.wasTheme = true
      st.diveSpot.clear()
      for (let i = 0; i < k; i++) st.diveSpot.set(web.stories[i]!.id, { x: hx[1 + i]!, y: hy[1 + i]! })
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
        circle(rims, i, r + rim)
        if (mix > 0.01 && on(i)) continue
        const group = nodeSlot(i)
        let path = fills.get(group)
        if (!path) { path = new Path2D(); fills.set(group, path) }
        circle(path, i, r)
      }
      for (let i = 0; i <= k; i++) circle(rims, i, themeNodeRadius(web, i, unit) + 1.6)
      g.globalAlpha = st.nodeIn
      g.fillStyle = st.paper
      g.fill(rims)
      for (const [group, path] of fills) { g.fillStyle = st.softInk[group] ?? st.mute; g.globalAlpha = back * st.nodeIn; g.fill(path) }
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
        g.fill()
      }
      g.globalAlpha = st.nodeIn
      g.fillStyle = colour
      g.beginPath()
      g.arc(hx[0]!, hy[0]!, themeNodeRadius(web, 0, unit), 0, TAU)
      g.fill()
      g.strokeStyle = st.ink
      g.globalAlpha = 0.5 * st.ringIn
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
        g.lineCap = 'round'
        if (groupsOut < 0.99) for (let k = 0; k < groupAt.length / 2; k++) {
          const span = groupAt[k * 2 + 1]!
          if (span <= 0) continue
          const slot = plegma.themeGroups![k]!.slot
          const hot = st.ringHot.get(`g${k}`) ?? 0
          g.strokeStyle = hot > 0.01 ? (slot > 0 ? st.groupInk[slot] ?? st.ink : st.mute) : st.softInk[slot] ?? st.mute
          g.lineWidth = 2 + 2.5 * hot
          g.globalAlpha = (0.85 + 0.15 * hot) * (1 - groupsOut) * st.ringIn
          const pad = Math.min(span / 2, 3 / disc.r)
          g.beginPath()
          g.arc(disc.x, disc.y, disc.r, groupAt[k * 2]! - Math.PI / 2 + pad + turn, groupAt[k * 2]! + span - Math.PI / 2 - pad + turn)
          g.stroke()
        }
        if (stanceAt) {
          const back = (1 - st.ringMix) * (Math.PI / 2)
          for (let k = 0; k < 3; k++) {
            const span = stanceAt[k * 2 + 1]!
            if (span <= 0) continue
            const hot = st.ringHot.get(`s${k}`) ?? 0
            g.strokeStyle = st.stanceInk[k] ?? st.mute
            g.lineWidth = 2 + 2.5 * hot
            g.globalAlpha = (0.9 + 0.1 * hot) * st.ringMix * st.ringIn
            const pad = Math.min(span / 2, 3 / disc.r)
            g.beginPath()
            g.arc(disc.x, disc.y, disc.r, stanceAt[k * 2]! - Math.PI / 2 + pad - back, stanceAt[k * 2]! + span - Math.PI / 2 - pad - back)
            g.stroke()
          }
        }
      } else {
        g.strokeStyle = colour
        g.globalAlpha = 0.45 * st.ringIn
        g.lineWidth = 1.2
        g.beginPath()
        g.arc(disc.x, disc.y, disc.r, 0, TAU)
        g.stroke()
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
