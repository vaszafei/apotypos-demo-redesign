import { articleOfNode, articleRadius, articleWebOf, matchesHighlight, nodeCount } from '../plegma-articles'
import type { PlegmaHighlight } from '../plegma-articles'
import { PLEGMA_REGION, frameStory, regionBox, toScreen } from '../plegma-camera'
import { ringEmptiedTo } from '../plegma-leave'
import { RING_START } from '../plegma-ring'
import type { PlegmaStory } from '../plegma-world'
import { TAU, arcThick, clamp, shareArcs } from './stage-draw-util'
import type { StageState } from './stage-state'
import type { StageCore, StageDeps } from './stage-core'
import { NAME_MAX, createStageNames } from './stage-names'
import type { NameItem } from './stage-names'

// The picked story: one node for each article, the ring of its groups or outlets or stance, what the pointer finds on it.
export const createStageArticles = (st: StageState, deps: StageDeps, core: StageCore) => {
  const { plegma, reduced } = deps
  const { placed, gatherTo, gatherR, colourOf } = core
  const { drawNames, stanceNames } = createStageNames(st, deps)
  // The web is the story's articles (utils/plegma/plegma-articles.ts). Its size on the screen is that of the free map region, so it is the same at any window; in the world it is
  // a disc of `Rt / zt` where zt is the zoom of the framing, so it grows and shrinks with the camera in a flight. The nodes go round on small circles, each its own way.
  const arts = { aw: null as ReturnType<typeof articleWebOf> | null, tab: '', fromTab: '', by: 'group' as By, from: null as ReturnType<typeof articleWebOf> | null, fromBy: 'group' as By, blend: 1, id: -1, cx: 0, cy: 0, R: 0, ring: 0, kx: 1, rWorld: 0, dr: 1, spacing: 0 }
  // When the outlets of the story are read the web changes from the plain disc to the sectors of its groups: the nodes move there, they do not jump.
  const MORPH_MS = 900
  let morphFrom: ReturnType<typeof articleWebOf> | null = null
  let morphAt = 0
  let morphBy: By = 'group'
  let morphTab = ''
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
  // The ring of the outlets has a sector for each outlet; the ring of the groups, and the stance (which keeps the groups), a sector for each group.
  const byOutlet = () => plegma.ring === 'outlets'
  type By = 'outlet' | 'group'
  const sectorBy = (by: By, x: { order: number, outletOrder: number }) => (by === 'outlet' ? x.outletOrder : x.order)
  const curBy = (): By => (byOutlet() ? 'outlet' : 'group')
  const sectorOf = (x: { order: number, outletOrder: number }) => sectorBy(curBy(), x)
  // The name and the group color slot of each sector of a ring (of the outlets or of the groups), from the articles; kept until the list or the ring changes.
  type ArcInfo = Map<number, { name: string, slot: number, n: number }>
  const infoCache = new Map<By, { list: unknown, info: ArcInfo }>()
  const infoOf = (by: By, list: NonNullable<typeof plegma.articles>): ArcInfo => {
    const hit = infoCache.get(by)
    if (hit && hit.list === list) return hit.info
    const info: ArcInfo = new Map()
    for (const x of list) {
      const k = sectorBy(by, x)
      const row = info.get(k)
      if (row) row.n++
      else info.set(k, { name: by === 'outlet' ? x.outlet : x.group ?? deps.t('story.nogroup'), slot: x.slot, n: 1 })
    }
    infoCache.set(by, { list, info })
    return info
  }
  const sectorsOf = (s: PlegmaStory) => {
    const list = plegma.articles
    if (!list || list.length !== s.n) return null
    const key = `${s.id}:${list.length}:${byOutlet()}`
    if (key !== sectorKey || list !== sectorFrom || !sectorList) {
      const nodes = nodeCount(s.n)
      sectorList = new Uint16Array(nodes)
      for (let i = 0; i < nodes; i++) {
        const article = list[articleOfNode(i, list.length)]!
        sectorList[i] = sectorOf(article)
      }
      sectorKey = key
      sectorFrom = list
    }
    return sectorList
  }
  const articleWorldRadius = (s: PlegmaStory) => {
    const region = plegma.region ?? undefined
    const box = regionBox(st.width, st.height, region ?? PLEGMA_REGION)
    return articleRadius(s.n, Math.min(box.w, box.h) * 0.41) / frameStory(s, st.width, st.height, region).z
  }
  // The ring around the picked web, from its radius on the screen.
  const ringOf = (R: number) => R * 1.2 + 6
  // The web is an ellipse, wider than tall, when the view gave it a region wider than tall (its width over its height, up to 1.6); a circle when it has no region.
  const articleAspect = () => {
    const region = plegma.region
    if (!region) return 1
    const box = regionBox(st.width, st.height, region)
    return clamp(box.w / Math.max(1, box.h), 1, 1.6)
  }
  const layoutArticles = (s: PlegmaStory, sec: number) => {
    const sectors = sectorsOf(s)
    const aw = articleWebOf(s.id, nodeCount(s.n), sectors ?? undefined, byOutlet() ? 'outlet' : 'group')
    if (aw !== arts.aw) {
      morphFrom = arts.aw && arts.id === s.id && arts.aw.n === aw.n && !reduced.value ? arts.aw : null
      morphBy = arts.by
      morphTab = arts.tab
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
    const kx = articleAspect()
    const spacing = aw.gap * R
    const amp = clamp(spacing * 0.2, 0.8, 3.2)
    if (ax.length < aw.n) { ax = new Float32Array(aw.n); ay = new Float32Array(aw.n) }
    for (let i = 0; i < aw.n; i++) {
      const a = sec * aw.speed[i]! + aw.phase[i]!
      // The nodes go round the center (the radius and the angle each ease), not straight across it, so they do not gather in a knot in the middle of a turn between two rings.
      let bx = aw.x[i]!
      let by = aw.y[i]!
      if (from) {
        const r0 = Math.hypot(from.x[i]!, from.y[i]!)
        const r1 = Math.hypot(bx, by)
        if (r0 < 1e-3 || r1 < 1e-3) { bx = from.x[i]! + (bx - from.x[i]!) * blend; by = from.y[i]! + (by - from.y[i]!) * blend }
        else {
          const t0 = Math.atan2(from.y[i]!, from.x[i]!)
          const turnBy = ((Math.atan2(by, bx) - t0 + 3 * Math.PI) % TAU) - Math.PI
          const r = r0 + (r1 - r0) * blend
          bx = Math.cos(t0 + turnBy * blend) * r
          by = Math.sin(t0 + turnBy * blend) * r
        }
      }
      // The first article does not move: it is the center the others go round.
      const reach = i === 0 && aw.arcs.length ? 0 : aw.reach[i]!
      ax[i] = p.x + bx * R * kx + Math.cos(a) * amp * reach
      ay[i] = p.y + by * R + Math.sin(a) * amp * reach
      if (st.introP < 1) { const at = gatherTo(i, aw.n, ax[i]!, ay[i]!); ax[i] = at.x; ay[i] = at.y }
    }
    Object.assign(arts, { aw, tab: plegma.ring, fromTab: morphTab, by: curBy(), from, fromBy: morphBy, blend, id: s.id, cx: p.x, cy: p.y, R, ring: ringOf(R), kx, rWorld, spacing, dr: clamp(spacing * 0.27, 1.2, 4.6) })
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
    const ux = (x - a.cx) / a.kx
    if (!aw.arcs.length || morphFrom || Math.abs(Math.hypot(ux, y - a.cy) - a.ring) > 7) return null
    const at = (Math.atan2(y - a.cy, ux) + Math.PI / 2 + TAU) % TAU
    const inside = (start: number, span: number) => span > 0 && (((at - start) % TAU) + TAU) % TAU <= span
    if (st.ringMix > 0.5) {
      const arcs = shareArcs(plegma.stance)
      if (!arcs) return null
      for (let k = 0; k < 3; k++) if (inside(arcs[k * 2]!, arcs[k * 2 + 1]!)) return { kind: 's' as const, k }
      return null
    }
    for (let k = 0; k < aw.arcs.length / 2; k++) if (inside(aw.arcs[k * 2]!, aw.arcs[k * 2 + 1]!)) return { kind: 'g' as const, k }
    return null
  }
  // The size of a node against the spacing of the web.
  const NODE_SCALE = 0.82
  // The names of the arcs of the ring of the outlets or the groups: every arc with a name, the outlet or the group of its articles and the dot of its color.
  const ringNames = (arcs: Float32Array, info: ArcInfo, total: number): NameItem[] =>
    [...info.entries()].filter(([k, v]) => (arcs[k * 2 + 1] ?? 0) > 0 && v.name).map(([k, v]) => ({
      mid: arcs[k * 2]! + arcs[k * 2 + 1]! / 2,
      span: arcs[k * 2 + 1]!,
      text: `${v.name.length > NAME_MAX ? `${v.name.slice(0, NAME_MAX - 1)}…` : v.name} · ${fmtPct(v.n / total)}`,
      dot: v.slot > 0 ? st.groupInk[v.slot] ?? st.ink : st.mute
    }))
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
    // A node is a small ring in the color of its group, with nothing inside it (the page shows through); the ones a card points at (below) are solid, so they stand out.
    const rims = new Path2D()
    const fills = new Map<number, Path2D>()
    for (let i = 1; i < aw.n; i++) {
      if (lit && lit[i]) continue
      const r = rOf(i) * NODE_SCALE
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
    g.lineWidth = clamp(a.dr * 0.34, 1, 1.6)
    for (const [slot, path] of fills) {
      g.strokeStyle = slot < 0 ? col : st.groupInk[slot] ?? st.mute
      g.globalAlpha = (1 - 0.35 * mix) * st.nodeIn
      g.stroke(path)
    }
    if (lit) {
      for (let i = 1; i < aw.n; i++) {
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
    // The center is the story, in the color of its theme: a disc with a soft light around it and a thin ring. The lines of the first articles of the groups begin at it.
    {
      const er = gatherR(0, Math.max(5, a.dr * 2.3))
      for (const [k, alpha] of [[3, 0.07], [2.2, 0.1]] as const) {
        g.globalAlpha = alpha * st.nodeIn
        g.fillStyle = col
        g.beginPath()
        g.arc(ax[0]!, ay[0]!, er * k, 0, TAU)
        g.fill()
      }
      g.globalAlpha = 0.6 * (1 - 0.5 * mix) * st.ringIn
      g.strokeStyle = col
      g.lineWidth = 1.2
      g.beginPath()
      g.arc(ax[0]!, ay[0]!, er * 1.7, 0, TAU)
      g.stroke()
      g.globalAlpha = st.nodeIn
      g.fillStyle = st.paper
      g.beginPath()
      g.arc(ax[0]!, ay[0]!, er + rim, 0, TAU)
      g.fill()
      g.fillStyle = col
      g.beginPath()
      g.arc(ax[0]!, ay[0]!, er, 0, TAU)
      g.fill()
    }
    // The ring: a thin line with nothing inside it. With the groups known it is an arc for each group, over the sector of its articles.
    g.lineCap = 'round'
    // Leaving the view: the arcs and their names go from the start of the ring on, the way they filled (stores/plegma.ts `leaving`, utils/plegma/plegma-leave.ts).
    const emptied = st.ringOut > 0 ? ringEmptiedTo(st.ringOut) : -Infinity
    const namesLeft = 1 - clamp(st.ringOut * 2, 0, 1)
    if (aw.arcs.length || a.from?.arcs.length) {
      g.lineWidth = 3
      // Turning to the stance the arcs of the groups go a quarter turn on and fade; the arcs of the stance come in from a quarter turn back.
      const stanceAt = st.ringMix > 0.01 ? shareArcs(plegma.stance) : null
      const groupsOut = stanceAt ? st.ringMix : 0
      const turn = groupsOut * (Math.PI / 2)
      // Turning from the outlets to the groups, or back, the arcs go the same way: the old ones a quarter turn on and fade, the new ones come in from a quarter turn back (nodes move meanwhile).
      const morphing = !!a.from && a.blend < 1
      // The arcs of the groups under the stance were not on the screen (the stance arcs were), so they do not go out; and they do not come in when the stance is where the ring goes.
      const out = morphing && a.fromBy !== a.by && a.fromTab !== 'stance' && a.from!.arcs.length ? a.blend : -1
      const arcSet = (arcs: Float32Array, by: By, extra: number, fade: number) => {
        const info = articles ? infoOf(by, articles) : null
        const top = info ? Math.max(1, ...[...info.values()].map(v => v.n)) : 1
        for (let k = 0; k < arcs.length / 2; k++) {
          const span = arcs[k * 2 + 1]!
          if (span <= 0) continue
          const slot = info?.get(k)?.slot ?? 0
          const on = by === a.by && !!st.hlLast && mix > 0.01 && (() => { const first = articles?.find(x => sectorBy(by, x) === k); return !!first && matchesHighlight(first, st.hlLast) })()
          const thick = arcThick(info?.get(k)?.n ?? 0, top)
          const pad = Math.min(span / 2, (thick / 2 + 1.5) / a.ring)
          const hot = by === a.by ? st.ringHot.get(`g${k}`) ?? 0 : 0
          const rest = on ? 1 : 0.85 * (1 - 0.35 * mix)
          g.strokeStyle = on || hot > 0.01 ? (slot > 0 ? st.groupInk[slot] ?? st.ink : st.mute) : st.softInk[slot] ?? st.mute
          g.lineWidth = thick + 1.4 * hot
          g.globalAlpha = (rest + (1 - rest) * hot) * fade * st.ringIn
          const from = Math.max(arcs[k * 2]! + pad, emptied)
          const to = arcs[k * 2]! + span - pad
          if (to <= from) continue
          g.beginPath()
          g.ellipse(a.cx, a.cy, a.ring * a.kx, a.ring, 0, from - Math.PI / 2 + extra, to - Math.PI / 2 + extra)
          g.stroke()
        }
      }
      const comeIn = morphing ? a.blend : 1
      if (out >= 0) arcSet(a.from!.arcs, a.fromBy, out * (Math.PI / 2) + turn, (1 - out) * (1 - groupsOut))
      if (groupsOut < 0.99 && aw.arcs.length && !(morphing && plegma.ring === 'stance')) arcSet(aw.arcs, a.by, turn - (out >= 0 ? (1 - a.blend) * (Math.PI / 2) : 0), (1 - groupsOut) * comeIn)
      if (articles && groupsOut < 0.5) {
        const names = 0.9 * (1 - groupsOut * 2) * (1 - 0.35 * mix) * st.ringIn * namesLeft
        if (out >= 0) drawNames(g, a, ringNames(a.from!.arcs, infoOf(a.fromBy, articles), articles.length), names * clamp(1 - out * 2, 0, 1))
        if (aw.arcs.length) drawNames(g, a, ringNames(aw.arcs, infoOf(a.by, articles), articles.length), names * (morphing ? clamp(a.blend * 2 - 1, 0, 1) : 1))
      }
      if (stanceAt && st.ringMix > 0.5) drawNames(g, a, stanceNames(stanceAt), 0.9 * (st.ringMix * 2 - 1) * st.ringIn * namesLeft, true)
      if (stanceAt) {
        const back = (1 - st.ringMix) * (Math.PI / 2)
        const counts = plegma.stance ?? []
        const topStance = Math.max(1, ...counts)
        for (let k = 0; k < 3; k++) {
          const span = stanceAt[k * 2 + 1]!
          if (span <= 0) continue
          const thick = arcThick(counts[k] ?? 0, topStance)
          const pad = Math.min(span / 2, (thick / 2 + 1.5) / a.ring)
          const hot = st.ringHot.get(`s${k}`) ?? 0
          g.strokeStyle = st.stanceInk[k] ?? st.mute
          g.lineWidth = thick + 2.5 * hot
          g.globalAlpha = (0.9 + 0.1 * hot) * st.ringMix * st.ringIn
          const from = Math.max(stanceAt[k * 2]! + pad, emptied)
          const to = stanceAt[k * 2]! + span - pad
          if (to <= from) continue
          g.beginPath()
          g.ellipse(a.cx, a.cy, a.ring * a.kx, a.ring, 0, from - Math.PI / 2 - back, to - Math.PI / 2 - back)
          g.stroke()
        }
      }
    } else {
      g.globalAlpha = 0.45 * st.ringIn
      g.strokeStyle = articles ? st.mute : col
      g.lineWidth = 1.2
      g.beginPath()
      g.ellipse(a.cx, a.cy, a.ring * a.kx, a.ring, 0, st.ringOut > 0 ? emptied - Math.PI / 2 : 0, st.ringOut > 0 ? RING_START + TAU - Math.PI / 2 : TAU)
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
  // The radius of the disc at the center of the web of the story, as drawn in the last frame (the dot of a theme comes to it, stage-draw.ts).
  const centerRadius = () => Math.max(5, arts.dr * 2.3)
  return { drawArticles, articleAt, ringAt, articleWorldRadius, articleAspect, ringOf, sectorOf, byOutlet, centerRadius }
}

export type StageArticles = ReturnType<typeof createStageArticles>
