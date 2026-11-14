import { articleOfNode, articleRadius, articleWebOf, matchesHighlight, nodeCount } from '../plegma-articles'
import type { PlegmaHighlight } from '../plegma-articles'
import { PLEGMA_REGION, frameStory, regionBox, toScreen } from '../plegma-camera'
import type { PlegmaStory } from '../plegma-world'
import { TAU, clamp, shareArcs } from './stage-draw-util'
import type { StageState } from './stage-state'
import type { StageCore, StageDeps } from './stage-core'

// The picked story: one node for each article, the ring of its groups or outlets or stance, what the pointer finds on it.
export const createStageArticles = (st: StageState, deps: StageDeps, core: StageCore) => {
  const { plegma, reduced } = deps
  const { placed, gatherTo, gatherR, colourOf } = core
  // The web is the story's articles (utils/plegma/plegma-articles.ts). Its size on the screen is that of the free map region, so it is the same at any window; in the world it is
  // a disc of `Rt / zt` where zt is the zoom of the framing, so it grows and shrinks with the camera in a flight. The nodes go round on small circles, each its own way.
  const arts = { aw: null as ReturnType<typeof articleWebOf> | null, id: -1, cx: 0, cy: 0, R: 0, ring: 0, rWorld: 0, dr: 1, spacing: 0 }
  // When the outlets of the story are read the web changes from the plain disc to the sectors of its groups: the nodes move there, they do not jump.
  const MORPH_MS = 900
  let morphFrom: ReturnType<typeof articleWebOf> | null = null
  let morphAt = 0
  let ax = new Float32Array(0)
  let ay = new Float32Array(0)
  let hlMatch = new Uint8Array(0)
  let hlKey = ''
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
  // The list is part of the key: the articles are replaced (not only added) when the groups arrive after them, with the same length and new groups and slots.
  let sectorKey = ''
  let sectorFrom: unknown = null
  let sectorList: Uint16Array | null = null
  let sectorSlot: number[] = []
  // The ring of the outlets has a sector for each outlet; the ring of the groups, and the stance (which keeps the groups), a sector for each group.
  const byOutlet = () => plegma.ring === 'outlets'
  const sectorOf = (x: { order: number, outletOrder: number }) => (byOutlet() ? x.outletOrder : x.order)
  const sectorsOf = (s: PlegmaStory) => {
    const list = plegma.articles
    if (!list || list.length !== s.n) return null
    const key = `${s.id}:${list.length}:${byOutlet()}`
    if (key !== sectorKey || list !== sectorFrom || !sectorList) {
      const nodes = nodeCount(s.n)
      sectorList = new Uint16Array(nodes)
      sectorSlot = []
      for (let i = 0; i < nodes; i++) {
        const article = list[articleOfNode(i, list.length)]!
        sectorList[i] = sectorOf(article)
        sectorSlot[sectorOf(article)] = article.slot
      }
      sectorKey = key
      sectorFrom = list
    }
    return sectorList
  }
  const articleWorldRadius = (s: PlegmaStory) => {
    const region = plegma.region ?? undefined
    const box = regionBox(st.width, st.height, region ?? PLEGMA_REGION)
    return articleRadius(s.n, Math.min(box.w, box.h) * 0.36) / frameStory(s, st.width, st.height, region).z
  }
  // The ring around the picked web, from its radius on the screen.
  const ringOf = (R: number) => R * 1.2 + 6
  const layoutArticles = (s: PlegmaStory, sec: number) => {
    const sectors = sectorsOf(s)
    const aw = articleWebOf(s.id, nodeCount(s.n), sectors ?? undefined, byOutlet() ? 'outlet' : 'group')
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
    const p = toScreen(st.cam, st.width, st.height, placed(s))
    const rWorld = articleWorldRadius(s)
    const R = rWorld * st.cam.z
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
      if (st.introP < 1) { const at = gatherTo(i, aw.n, ax[i]!, ay[i]!, p.x, p.y, ringOf(R)); ax[i] = at.x; ay[i] = at.y }
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
    if (st.ringMix > 0.5) {
      const arcs = shareArcs(plegma.stance)
      if (!arcs) return null
      for (let k = 0; k < 3; k++) if (inside(arcs[k * 2]!, arcs[k * 2 + 1]!)) return { kind: 's' as const, k }
      return null
    }
    for (let k = 0; k < aw.arcs.length / 2; k++) if (inside(aw.arcs[k * 2]!, aw.arcs[k * 2 + 1]!)) return { kind: 'g' as const, k }
    return null
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
    const inkOf = (slot: number) => (slot < 0 ? col : st.softInk[slot] ?? st.mute)
    const mix = st.hlMix
    const lit = articles && st.hlLast && mix > 0.01 ? matchNodes(s, st.hlLast, articles) : null
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
        g.globalAlpha = (a.spacing < 7 ? 0.4 : 0.55) * (1 - 0.35 * mix) * st.lineIn
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
    g.globalAlpha = st.nodeIn
    g.fillStyle = st.paper
    g.fill(rims)
    for (const [slot, path] of fills) {
      g.fillStyle = inkOf(slot)
      g.globalAlpha = (1 - 0.5 * mix) * st.nodeIn
      g.fill(path)
    }
    if (lit) {
      for (let i = 0; i < aw.n; i++) {
        if (!lit[i]) continue
        const slot = slotOf(i)
        const colour = slot > 0 ? st.groupInk[slot] ?? st.ink : st.mute
        const r = rOf(i) * (1 + 0.22 * mix)
        g.fillStyle = colour
        g.globalAlpha = 0.1 * mix * st.nodeIn
        g.beginPath()
        g.arc(ax[i]!, ay[i]!, r * 1.8, 0, TAU)
        g.fill()
        g.globalAlpha = 1
        g.fillStyle = st.paper
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
      g.globalAlpha = 0.55 * (1 - 0.5 * mix) * st.ringIn
      g.strokeStyle = st.ink
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
      const stanceAt = st.ringMix > 0.01 ? shareArcs(plegma.stance) : null
      const groupsOut = stanceAt ? st.ringMix : 0
      const turn = groupsOut * (Math.PI / 2)
      if (groupsOut < 0.99) for (let k = 0; k < aw.arcs.length / 2; k++) {
        const span = aw.arcs[k * 2 + 1]!
        if (span <= 0) continue
        const slot = sectorSlot[k] ?? 0
        const on = !!st.hlLast && mix > 0.01 && (() => { const first = articles?.find(x => sectorOf(x) === k); return !!first && matchesHighlight(first, st.hlLast) })()
        const pad = Math.min(span / 2, 3 / a.ring)
        const hot = st.ringHot.get(`g${k}`) ?? 0
        const rest = on ? 1 : 0.85 * (1 - 0.35 * mix)
        g.strokeStyle = on || hot > 0.01 ? (slot > 0 ? st.groupInk[slot] ?? st.ink : st.mute) : st.softInk[slot] ?? st.mute
        g.lineWidth = 2 + 1.2 * hot
        g.globalAlpha = (rest + (1 - rest) * hot) * (1 - groupsOut) * st.ringIn
        g.beginPath()
        g.arc(a.cx, a.cy, a.ring, aw.arcs[k * 2]! - Math.PI / 2 + pad + turn, aw.arcs[k * 2]! + span - Math.PI / 2 - pad + turn)
        g.stroke()
      }
      if (stanceAt) {
        const back = (1 - st.ringMix) * (Math.PI / 2)
        for (let k = 0; k < 3; k++) {
          const span = stanceAt[k * 2 + 1]!
          if (span <= 0) continue
          const pad = Math.min(span / 2, 3 / a.ring)
          const hot = st.ringHot.get(`s${k}`) ?? 0
          g.strokeStyle = st.stanceInk[k] ?? st.mute
          g.lineWidth = 2 + 2.5 * hot
          g.globalAlpha = (0.9 + 0.1 * hot) * st.ringMix * st.ringIn
          g.beginPath()
          g.arc(a.cx, a.cy, a.ring, stanceAt[k * 2]! - Math.PI / 2 + pad - back, stanceAt[k * 2]! + span - Math.PI / 2 - pad - back)
          g.stroke()
        }
      }
    } else {
      g.globalAlpha = 0.45 * st.ringIn
      g.strokeStyle = articles ? st.mute : col
      g.lineWidth = 1.2
      g.beginPath()
      g.arc(a.cx, a.cy, a.ring, 0, TAU)
      g.stroke()
    }
    g.lineCap = 'butt'
    if (st.hoverArticle >= 0 && st.hoverArticle < aw.n) {
      g.globalAlpha = 0.85
      g.strokeStyle = st.ink
      g.lineWidth = 1.2
      g.beginPath()
      g.arc(ax[st.hoverArticle]!, ay[st.hoverArticle]!, rOf(st.hoverArticle) + rim + 2, 0, TAU)
      g.stroke()
    }
    g.globalAlpha = 1
  }
  return { drawArticles, articleAt, ringAt, articleWorldRadius, ringOf, sectorOf, byOutlet }
}

export type StageArticles = ReturnType<typeof createStageArticles>
