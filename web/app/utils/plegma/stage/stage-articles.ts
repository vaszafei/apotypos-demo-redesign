import { articleOfNode, articleRadius, articleWebOf, matchesHighlight, nodeCount } from '../plegma-articles'
import type { PlegmaArticle, PlegmaHighlight } from '../plegma-articles'
import { branchLag, branchRadius, buildBranchWeb, placeBranchNames } from '../plegma-branches'
import { athensWall, storySteps } from '../story-steps'
import type { BranchName, BranchNameAsk, PlegmaBranchWeb } from '../plegma-branches'
import { isZoomed, resetWebZoom, stepZoom } from '../plegma-zoom'
import { PLEGMA_REGION, frameStory, regionBox, toScreen } from '../plegma-camera'
import { ringEmptiedTo } from '../plegma-leave'
import { RING_START } from '../plegma-ring'
import type { PlegmaStory } from '../plegma-world'
import { TAU, arcThick, clamp, shareArcs, withAlpha } from './stage-draw-util'
import type { StageState } from './stage-state'
import type { StageCore, StageDeps } from './stage-core'
import { NAME_MAX, createStageNames } from './stage-names'
import type { NameItem } from './stage-names'

// The picked story: one node for each article, the ring of its groups or outlets or stance, what the pointer finds on it.
// The start node of Κλαδιά: a little smaller than the center of a circle web (2.3), and its names (the start, the outlet, the time) above it or under it, not on its left.
const startRadius = (dr: number) => Math.max(4, dr * 1.9)
const START_NAMES: 'above' | 'under' = 'above'
// The strip between the branches and the axis where the articles over time are drawn: low and flat, so it reads as the ground of the web.
const bandRoom = (h: number) => Math.round(Math.min(90, Math.max(48, h * 0.11)))

export const createStageArticles = (st: StageState, deps: StageDeps, core: StageCore) => {
  const { plegma, reduced } = deps
  const { placed, gatherTo, gatherR, colourOf } = core
  const { drawNames, stanceNames } = createStageNames(st, deps)
  // The web is the story's articles (utils/plegma/plegma-articles.ts). Its size on the screen is that of the free map region, so it is the same at any window; in the world it is
  // a disc of `Rt / zt` where zt is the zoom of the framing, so it grows and shrinks with the camera in a flight. The nodes go round on small circles, each its own way.
  // `branch`: the web is Κλαδιά (below), and `k` its scale against the framing of the story.
  const arts = { aw: null as ReturnType<typeof articleWebOf> | null, tab: '', fromTab: '', by: 'group' as By, from: null as ReturnType<typeof articleWebOf> | null, fromBy: 'group' as By, blend: 1, id: -1, cx: 0, cy: 0, R: 0, ring: 0, kx: 1, rWorld: 0, dr: 1, spacing: 0, branch: false, k: 1 }
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
  const matchNodes = (s: PlegmaStory, h: PlegmaHighlight, list: NonNullable<typeof plegma.articles>, nodes: number) => {
    const key = `${s.id}|${'picks' in h ? `p${h.story}` : 'from' in h ? `${h.from}-${h.to}` : `${h.group}|${h.outlet ?? ''}`}|${list.length}|${nodes}`
    if (key === hlKey) return hlMatch
    hlKey = key
    hlMatch = new Uint8Array(nodes)
    for (let i = 0; i < nodes; i++) {
      const from = Math.floor((i * s.n) / nodes)
      const to = Math.max(from + 1, Math.floor(((i + 1) * s.n) / nodes))
      for (let k = from; k < to; k++) if (matchesHighlight(list[k]!, h, k)) { hlMatch[i] = 1; break }
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
  // Κλαδιά (utils/plegma/plegma-branches.ts): a story whose articles have their time is its web spread by time,
  // in the whole free cell, with no ring. One node for each article. The web and its names are made once for a story and a size of the region, in pixels of the framing; the frame scales them with the camera.
  type Band = { x: Float32Array, n: Float32Array, top: number, spans: { from: number, to: number }[], step: number }
  const branch = { band: null as Band | null, bandOf: null as ((lo: number, hi: number) => Band | null) | null, within: null as ((a: number, b: number) => { lo: number, hi: number }) | null,
    zoomBand: null as Band | null, zoomKey: '', key: '', list: null as unknown, web: null as PlegmaBranchWeb | null, aw: null as ReturnType<typeof articleWebOf> | null, names: [] as BranchName[], fz: 1, w: 0, h: 0,
    asks: null as ((X: ArrayLike<number>, Y: ArrayLike<number>, z: number, cam: { x: number, y: number }) => { asks: BranchNameAsk[], ticks: number[] }) | null, ticks: [] as number[] }
  const measure = (text: string, size: number, weight: number) => {
    const g = st.ctxFocus
    if (!g) return text.length * size * 0.54
    g.font = `${weight === 400 ? '' : `${weight} `}${size}px ${st.fontText}`
    return g.measureText(text).width
  }
  const shortGroup = (group: string | null) => (group ?? deps.t('story.nogroup')).replace(/^(Συμφέροντα|Όμιλος)\s+/, '')
  const lagText = (m: number) => { const lag = branchLag(m); return deps.t(lag.key, { n: lag.n }) }
  const whenText = (minute: number) => `${fmtDay(athensDate(minute))}, ${athensClock(minute)}`
  const branchOf = (s: PlegmaStory) => {
    const list = plegma.articles
    if (!list || !list.length || list.length !== s.n || list[0]!.time === undefined || !plegma.region) return null
    const box = regionBox(st.width, st.height, plegma.region)
    const key = `${s.id}|${Math.round(box.w)}|${Math.round(box.h)}|${deps.locale.value}`
    if (key === branch.key && list === branch.list) return branch
    const times = list.map(a => a.time!)
    const first = list[0]!
    const starts: [string, number, number][] = [[deps.t('story.branches.started'), 11.5, 400], [first.outlet, 14, 600], [whenText(times[0]!), 11.5, 400]]
    // The names of the start node keep clear of its thin ring (centerRadius, at the framing). They are above it (or under it, START_NAMES), so the web needs room on its left only for the node.
    const pad = startRadius(branchRadius(list.length) / NODE_SCALE) * 1.7 + 8
    const left = pad
    const byGroup = new Map<number, { a: PlegmaArticle, n: number }>()
    for (const a of list) { const g = byGroup.get(a.order); if (g) g.n++; else byGroup.set(a.order, { a, n: 1 }) }
    const endText = (g: number) => { const row = byGroup.get(g)!; return `${shortGroup(row.a.group)} · ${fmtPct(row.n / list.length)}` }
    const input = { times, groups: list.map(a => a.order), seed: s.id, w: box.w, h: box.h, left, band: bandRoom(box.h) }
    const web = buildBranchWeb({ ...input, right: Math.max(0, ...[...byGroup.keys()].map(g => measure(endText(g), 11.5, 400))) + 34 })
    const firsts = web.firsts.slice(0, web.n < 12 ? 9 : 4)
    const lagOf = (i: number) => lagText(times[i]! - times[0]!)
    const dayText = (i: number) => fmtDay(athensDate(times[i]!))
    // The names at a zoom (utils/plegma/plegma-zoom.ts): the nodes as drawn (X, Y, in px of the region from its middle) and the camera of the zoom. At every zoom the start node, the
    // axis, the first articles, the ends of the branches and each other outlet where it first shows; from 3.1 to 3.4 every article in view with
    // its outlet and day in place of the outlets, the first of a group also how long after the first article it came.
    const band = (z: number, a: number, b: number) => clamp((z - a) / (b - a), 0, 1)
    const asksAt = (X: ArrayLike<number>, Y: ArrayLike<number>, z: number, cam: { x: number, y: number }) => {
      const rz = web.r * Math.pow(z, 0.45)
      const inBox = (i: number) => Math.abs(X[i]!) < box.w / 2 && Math.abs(Y[i]!) < box.h / 2
      const o3 = band(z, 3.1, 3.4)
      const asks: BranchNameAsk[] = []
      const ticks: number[] = []
      const startPad = pad * Math.pow(z, 0.45)
      const startY = START_NAMES === 'above' ? [-(startPad + 33), -(startPad + 16), -startPad] : [startPad + 7, startPad + 24, startPad + 40]
      if (inBox(0)) starts.forEach(([text, size, weight], k) => asks.push({ x: X[0]! - 6, y: Y[0]! + startY[k]!, text, size, weight, anchor: 'start', mute: k !== 1, fixed: true }))
      // The axis stays under the branches; more marks find room as the web opens.
      for (const [m, mark] of web.marks.entries()) {
        const x = m ? (mark.x - cam.x) * z : X[0]!
        if (Math.abs(x) > box.w / 2 - 10 || ticks.some(u => Math.abs(u - x) < (mark.kind === 'hour' ? 62 : 46)) || (m && x < X[0]! + 64 * z)) continue
        ticks.push(x)
        asks.push({ x, y: web.axisY, text: mark.kind === 'hour' ? athensClock(mark.minute) : fmtDay(athensDate(mark.minute)), size: 11, anchor: 'middle', mute: mark.kind === 'hour', fixed: true })
      }
      // Outlets picked to compare: only theirs are named (with the dot of their color), and the others' first articles are not.
      const pick = plegma.outletPick.size ? plegma.outletPick : null
      const named = (i: number) => !pick || pick.has(list[i]!.outlet)
      const dotOf = (i: number) => (pick ? plegma.inkSlot(list[i]!) : undefined)
      const asked = new Set<number>()
      for (const i of firsts) {
        if (!inBox(i) || !named(i)) continue
        asked.add(i)
        asks.push({ x: X[i]! + rz + 4, y: Y[i]! + (o3 > 0 ? 4 : -7), text: o3 > 0 ? `${list[i]!.outlet} · ${dayText(i)} · ${lagOf(i)}` : `${list[i]!.outlet} ${lagOf(i)}`, dot: dotOf(i) })
      }
      // A branch with no picked outlet keeps its name, faded as its articles are.
      const groupPicked = (g: number) => !pick || list.some(x => x.order === g && pick.has(x.outlet))
      for (const end of web.ends) if (inBox(end.node)) asks.push({ x: X[end.node]! + rz + 8, y: Y[end.node]! + 4, text: endText(end.group), dot: list[end.node]!.slot, alpha: groupPicked(end.group) ? 1 : 0.3 })
      if (o3 > 0) { for (let i = 1; i < web.n; i++) if (!asked.has(i) && inBox(i) && named(i)) asks.push({ x: X[i]! + rz + 4, y: Y[i]! + 4, text: `${list[i]!.outlet} · ${dayText(i)}`, size: 10.5, alpha: o3 }) }
      else {
        const shown = new Set([...asked].map(i => list[i]!.outlet))
        for (let i = 1; i < web.n; i++) {
          if (asked.has(i) || !inBox(i) || shown.has(list[i]!.outlet) || !named(i)) continue
          shown.add(list[i]!.outlet)
          asks.push({ x: X[i]! + rz + 4, y: Y[i]! + 4, text: list[i]!.outlet, size: 11, dot: dotOf(i) })
        }
      }
      return { asks, ticks }
    }
    const whole = asksAt(web.x, web.y, 1, { x: 0, y: 0 })
    // A new layout begins at its whole web.
    resetWebZoom(st.zoom)
    zoomNames.key = ''
    // The articles over time, under the branches (the line of «Ιστορία στον χρόνο», drawn in the Plegma): the articles of each step of time (the step the chart had), at the place of
    // that time on the branches (between the articles around it), so a peak is under the articles that make it.
    // The steps are those of the chart: on the Athens clock (a day step is an Athens day), each with its start and end as times of the articles.
    const xm = new Float32Array(web.n)
    for (let i = 0; i < web.n; i++) xm[i] = i ? Math.max(xm[i - 1]!, web.x[i]!) : web.x[0]!
    const xAt = (m: number) => {
      let lo = 0
      let hi = times.length - 1
      if (m <= times[0]!) return xm[0]!
      if (m >= times[hi]!) return xm[hi]!
      while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (times[mid]! <= m) lo = mid; else hi = mid }
      const f = times[hi]! === times[lo]! ? 0 : (m - times[lo]!) / (times[hi]! - times[lo]!)
      return xm[lo]! + (xm[hi]! - xm[lo]!) * f
    }
    // The band of the articles from `lo` to `hi` (places in the list): the whole story, or the articles in view while the web is zoomed, in finer steps as they span less time.
    const bandOf = (lo: number, hi: number) => {
      const { step, steps } = storySteps(list.slice(lo, hi + 1))
      const spans = steps.map((u) => {
        const wall = Date.parse(`${u.date}T${u.clock}:00Z`) / 60000
        const from = wall - (athensWall(wall) - wall)
        return { from, to: from + step - 1 }
      })
      const bins = Math.max(1, steps.length)
      const counts = Float32Array.from(steps, u => u.n)
      const bx = new Float32Array(bins + 2)
      const bn = new Float32Array(bins + 2)
      bx[0] = xm[lo]!
      for (let b = 0; b < steps.length; b++) { bx[b + 1] = xAt(spans[b]!.from + step / 2); bn[b + 1] = counts[b]! }
      bx[bins + 1] = xm[hi]!
      return hi - lo > 1 ? { x: bx, n: bn, top: Math.max(1, ...counts), spans, step } : null
    }
    // The articles whose places are between two x of the web (the window of the zoom).
    const within = (a: number, b: number) => {
      let lo = 0
      while (lo < web.n - 1 && xm[lo]! < a) lo++
      let hi = web.n - 1
      while (hi > lo && xm[hi]! > b) hi--
      return { lo, hi }
    }
    Object.assign(branch, {
      band: web.n > 2 ? bandOf(0, web.n - 1) : null, bandOf, within, zoomBand: null, zoomKey: '',
      key, list, web, names: placeBranchNames(web, whole.asks, box, measure), ticks: whole.ticks, asks: asksAt, fz: frameStory(s, st.width, st.height, plegma.region).z, w: box.w, h: box.h,
      aw: { n: web.n, x: web.x, y: web.y, phase: web.phase, speed: web.speed, reach: web.reach, edges: web.edges, bow: web.bow, gap: 0, arcs: new Float32Array(0) }
    })
    return branch
  }
  // The names as the zoom has them: those of the whole web, or placed again for the zoom and the camera (once for each).
  const zoomNames = { key: '', names: [] as BranchName[], ticks: [] as number[] }
  const zoomedNames = () => {
    const web = branch.web!
    const zs = st.zoom
    const picked = [...plegma.outletPick].join('|')
    if ((!isZoomed(zs) && !picked) || !branch.asks) return { names: branch.names, ticks: branch.ticks }
    const key = `${branch.key}|${zs.z.toFixed(3)}|${zs.cam.x.toFixed(1)}|${zs.cam.y.toFixed(1)}|${picked}`
    if (key === zoomNames.key) return zoomNames
    const X = new Float32Array(web.n)
    const Y = new Float32Array(web.n)
    for (let i = 0; i < web.n; i++) { X[i] = (web.x[i]! - zs.cam.x) * zs.z; Y[i] = (web.y[i]! - zs.cam.y) * zs.z }
    const { asks, ticks } = branch.asks(X, Y, zs.z, zs.cam)
    Object.assign(zoomNames, { key, names: placeBranchNames({ n: web.n, x: X, y: Y, r: web.r * Math.pow(zs.z, 0.45) }, asks, { w: branch.w, h: branch.h }, measure), ticks })
    return zoomNames
  }
  const namesNow = zoomedNames
  // The articles in view while the web is zoomed (the x of the region at the camera of the zoom), as places in the list; null at the whole web.
  const inView = () => {
    if (!branch.web || !branch.within || !isZoomed(st.zoom)) return null
    const { z, cam } = st.zoom
    const r = branch.within(cam.x - branch.w / 2 / z, cam.x + branch.w / 2 / z)
    return r.hi > r.lo ? r : null
  }
  // The band as it is drawn: the whole story's, or that of the articles in view (once for each window).
  const bandNow = () => {
    const v = inView()
    if (!v || !branch.bandOf) return branch.band
    const key = `${branch.key}|${v.lo}|${v.hi}`
    if (key !== branch.zoomKey) { branch.zoomKey = key; branch.zoomBand = branch.bandOf(v.lo, v.hi) }
    return branch.zoomBand ?? branch.band
  }
  // The time window of the articles in view, for the cards (stores/plegma.ts viewSpan): set when the zoom comes to rest.
  const publishWindow = () => {
    const v = inView()
    const list = branch.list as NonNullable<typeof plegma.articles> | null
    const next = v && list && list === plegma.articles ? { from: list[v.lo]!.time!, to: list[v.hi]!.time! } : null
    const now = plegma.viewSpan
    if ((next?.from ?? -1) !== (now?.from ?? -1) || (next?.to ?? -1) !== (now?.to ?? -1)) plegma.setViewSpan(next)
  }
  // One step of the zoom for a frame (PlegmaStage.vue); whether it still moves.
  const stepWebZoom = (now: number) => {
    const dt = Math.min(64, Math.max(0, now - st.zoomAt))
    st.zoomAt = now
    if (!branch.web || !isZoomed(st.zoom)) return false
    stepZoom(st.zoom, now, dt, { w: branch.w, h: branch.h }, reduced.value)
    return true
  }
  const layoutBranches = (s: PlegmaStory, b: typeof branch, sec: number) => {
    const web = b.web!
    const p = toScreen(st.cam, st.width, st.height, placed(s))
    const k = st.cam.z / b.fz
    const amp = clamp(web.r * 0.5, 0.8, 2.2)
    // The zoom: a node is drawn at (its place - the camera of the zoom) * the zoom (utils/plegma/plegma-zoom.ts).
    const { z, cam } = st.zoom
    if (ax.length < web.n) { ax = new Float32Array(web.n); ay = new Float32Array(web.n) }
    for (let i = 0; i < web.n; i++) {
      const a = sec * web.speed[i]! + web.phase[i]!
      const reach = i === 0 ? 0 : web.reach[i]!
      const bx = (web.x[i]! - cam.x) * z
      const by = (web.y[i]! - cam.y) * z
      ax[i] = p.x + bx * k + Math.cos(a) * amp * reach
      ay[i] = p.y + by * k + Math.sin(a) * amp * reach
      // The branches grow out of the start node: the early articles first.
      if (st.introP < 1) { const at = gatherTo(i, web.n, ax[i]!, ay[i]!, web.n > 1 ? i / (web.n - 1) : 0); ax[i] = at.x; ay[i] = at.y }
    }
    morphFrom = null
    const dr = (web.r / NODE_SCALE) * Math.pow(k * z, 0.45)
    Object.assign(arts, { aw: b.aw, tab: plegma.ring, fromTab: plegma.ring, by: curBy(), from: null, fromBy: curBy(), blend: 1, id: s.id, cx: p.x, cy: p.y, R: (b.h / 2) * k, ring: 0, kx: 1, rWorld: b.h / 2 / b.fz, spacing: web.r * 2 + (web.n > 400 ? 2.2 : 4), dr, branch: true, k })
    return arts
  }
  const layoutArticles = (s: PlegmaStory, sec: number) => {
    const b = branchOf(s)
    if (b) return layoutBranches(s, b, sec)
    const sectors = sectorsOf(s)
    const aw = articleWebOf(s.id, nodeCount(s.n), sectors ?? undefined, byOutlet() ? 'outlet' : 'group')
    if (aw !== arts.aw) {
      morphFrom = arts.aw && !arts.branch && arts.id === s.id && arts.aw.n === aw.n && !reduced.value ? arts.aw : null
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
    Object.assign(arts, { aw, tab: plegma.ring, fromTab: morphTab, by: curBy(), from, fromBy: morphBy, blend, id: s.id, cx: p.x, cy: p.y, R, ring: ringOf(R), kx, rWorld, spacing, dr: clamp(spacing * 0.27, 1.2, 4.6), branch: false, k: 1 })
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
  // The articles' nodes are drawn a little larger than their spacing gives (the center keeps its size).
  const DOT_GROW = 1.25
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
  // Zoomed, the web goes past the map cell: it is drawn on a layer of its own and, outside the cell, shows faintly behind the cards, with a soft edge (the mock of #222).
  let layer: HTMLCanvasElement | null = null
  let mask: HTMLCanvasElement | null = null
  let maskKey = ''
  const OUTSIDE = 0.3
  const maskOf = (w: number, h: number) => {
    const r = plegma.region!
    const key = `${w}|${h}|${r.x0}|${r.y0}|${r.x1}|${r.y1}`
    if (mask && key === maskKey) return mask
    mask ??= document.createElement('canvas')
    mask.width = w
    mask.height = h
    const m = mask.getContext('2d')!
    m.fillStyle = `rgba(0,0,0,${OUTSIDE})`
    m.fillRect(0, 0, w, h)
    m.filter = `blur(${14 * st.dpr}px)`
    m.fillStyle = '#000'
    const pad = 8 * st.dpr
    m.fillRect(r.x0 * w - pad, r.y0 * h - pad, (r.x1 - r.x0) * w + 2 * pad, (r.y1 - r.y0) * h + 2 * pad)
    m.filter = 'none'
    maskKey = key
    return mask
  }
  const drawArticles = (g: CanvasRenderingContext2D, s: PlegmaStory, level: 1 | 2, sec: number) => {
    if (!isZoomed(st.zoom) || !branchOf(s)) return paintArticles(g, s, level, sec)
    const w = g.canvas.width
    const h = g.canvas.height
    layer ??= document.createElement('canvas')
    if (layer.width !== w || layer.height !== h) { layer.width = w; layer.height = h }
    const lg = layer.getContext('2d')!
    lg.setTransform(1, 0, 0, 1, 0, 0)
    lg.clearRect(0, 0, w, h)
    lg.setTransform(st.dpr, 0, 0, st.dpr, 0, 0)
    paintArticles(lg, s, level, sec)
    lg.setTransform(1, 0, 0, 1, 0, 0)
    lg.globalAlpha = 1
    lg.globalCompositeOperation = 'destination-in'
    lg.drawImage(maskOf(w, h), 0, 0)
    lg.globalCompositeOperation = 'source-over'
    g.save()
    g.setTransform(1, 0, 0, 1, 0, 0)
    g.globalAlpha = 1
    g.drawImage(layer, 0, 0)
    g.restore()
  }
  // The articles of each picked outlet in each step of the band (the same steps, with a 0 at each end as the band has), once for each pick.
  let pickBandKey = ''
  let pickBandOf: { by: Map<string, Float32Array>, top: number } = { by: new Map(), top: 1 }
  const pickBand = (list: NonNullable<typeof plegma.articles>, pick: Set<string>, band: Band) => {
    const key = `${branch.key}|${band === branch.band ? '' : branch.zoomKey}|${[...pick].join('|')}`
    if (key === pickBandKey) return pickBandOf
    const by = new Map<string, Float32Array>()
    for (const name of pick) by.set(name, new Float32Array(band.spans.length + 2))
    let b = 0
    for (const x of list) {
      const counts = by.get(x.outlet)
      if (!counts || x.time === undefined || x.time < band.spans[0]!.from || x.time > band.spans[band.spans.length - 1]!.to) continue
      while (b < band.spans.length - 1 && x.time > band.spans[b]!.to) b++
      counts[b + 1] = counts[b + 1]! + 1
    }
    let top = 1
    for (const counts of by.values()) for (const n of counts) top = Math.max(top, n)
    pickBandKey = key
    pickBandOf = { by, top }
    return pickBandOf
  }
  const paintArticles = (g: CanvasRenderingContext2D, s: PlegmaStory, level: 1 | 2, sec: number) => {
    const a = layoutArticles(s, sec)
    const aw = a.aw!
    const col = colourOf(s)
    const articles = plegma.articles && plegma.articles.length === s.n ? plegma.articles : null
    const slots = plegma.pickSlots
    const articleOf = (i: number) => articles![nodeArticle(i, articles!.length)]!
    const slotOf = (i: number) => (articles ? slots.get(articleOf(i).outlet) ?? articleOf(i).slot : -1)
    const inkOf = (slot: number) => (slot < 0 ? col : st.softInk[slot] ?? st.mute)
    const mix = st.hlMix
    // The outlets picked to compare: the articles of the others (and their lines) fade back.
    const pick = articles && st.pickLast && st.pickMix > 0.01 ? st.pickLast : null
    const out = (i: number) => !!pick && !pick.has(articleOf(i).outlet)
    const faded = 1 - 0.85 * st.pickMix
    const lit = articles && st.hlLast && mix > 0.01 ? matchNodes(s, st.hlLast, articles, aw.n) : null
    const rOf = (i: number) => gatherR(i, i === 0 ? a.dr * 1.7 : a.dr * DOT_GROW)
    const band = level === 2 && a.branch ? bandNow() : null
    if (band && branch.web) {
      // The articles over time, soft and a little blurred, in the lower part of the web, over the axis: a backdrop, not a chart to read.
      const { z, cam } = st.zoom
      const X = (v: number) => a.cx + (v - cam.x) * z * a.k
      // The band keeps to the bottom of the region, over the axis, as the zoom opens the web: only its x follows the zoom.
      const Y = (v: number) => a.cy + v * a.k
      const base = branch.web.axisY - 14
      const tall = bandRoom(branch.h) + 6
      const pts = Array.from(band.x, (v, i) => ({ x: X(v), y: Y(base - (band.n[i]! / band.top) * tall) }))
      const curve = (path: Path2D) => {
        path.moveTo(pts[0]!.x, pts[0]!.y)
        for (let i = 1; i < pts.length - 1; i++) path.quadraticCurveTo(pts[i]!.x, pts[i]!.y, (pts[i]!.x + pts[i + 1]!.x) / 2, (pts[i]!.y + pts[i + 1]!.y) / 2)
        path.lineTo(pts[pts.length - 1]!.x, pts[pts.length - 1]!.y)
      }
      const colour = st.groupInk[1] ?? st.ink
      const area = new Path2D()
      curve(area)
      area.lineTo(pts[pts.length - 1]!.x, Y(base))
      area.lineTo(pts[0]!.x, Y(base))
      area.closePath()
      const fade = g.createLinearGradient(0, Y(base - tall), 0, Y(base))
      fade.addColorStop(0, withAlpha(colour, 0.2))
      fade.addColorStop(1, withAlpha(colour, 0))
      // With outlets picked to compare, the whole story steps back and each picked outlet has a line of its own, in its color, on a scale of their largest step.
      const back = 1 - 0.6 * st.pickMix
      g.save()
      g.globalAlpha = st.lineIn * (1 - 0.4 * mix) * back
      g.filter = 'blur(4px)'
      g.fillStyle = fade
      g.fill(area)
      const line = new Path2D()
      curve(line)
      g.filter = 'blur(1.4px)'
      g.strokeStyle = colour
      g.globalAlpha = 0.45 * st.lineIn * (1 - 0.4 * mix) * back
      g.lineWidth = 2
      g.stroke(line)
      if (pick && articles) {
        const lines = pickBand(articles, pick, band)
        g.filter = 'none'
        g.lineWidth = 1.6
        g.lineJoin = 'round'
        g.globalAlpha = st.lineIn * st.pickMix
        for (const [outlet, counts] of lines.by) {
          const own = Array.from(band.x, (v, i) => ({ x: X(v), y: Y(base - (counts[i]! / lines.top) * tall) }))
          const path = new Path2D()
          path.moveTo(own[0]!.x, own[0]!.y)
          for (let i = 1; i < own.length - 1; i++) path.quadraticCurveTo(own[i]!.x, own[i]!.y, (own[i]!.x + own[i + 1]!.x) / 2, (own[i]!.y + own[i + 1]!.y) / 2)
          path.lineTo(own[own.length - 1]!.x, own[own.length - 1]!.y)
          const slot = slots.get(outlet) ?? articles.find(x => x.outlet === outlet)?.slot ?? 0
          g.strokeStyle = st.groupInk[slot] ?? st.mute
          g.stroke(path)
        }
      }
      // The step under the pointer: a thin rule from the axis up to the line, and a dot on the line.
      const on = pts[st.hoverBand + 1]
      if (st.hoverBand >= 0 && on && st.hoverBand + 1 < pts.length - 1) {
        g.filter = 'none'
        g.globalAlpha = st.lineIn
        g.strokeStyle = colour
        g.lineWidth = 1
        g.beginPath()
        g.moveTo(on.x, Y(base) + 6)
        g.lineTo(on.x, on.y)
        g.stroke()
        g.fillStyle = colour
        g.strokeStyle = st.paper
        g.lineWidth = 2
        g.beginPath()
        g.arc(on.x, on.y, 4, 0, TAU)
        g.fill()
        g.stroke()
      }
      g.restore()
    }
    if (level === 2) {
      const lines = new Map<number, Path2D>()
      for (let e = 0; e < aw.bow.length; e++) {
        const i = aw.edges[e * 2]!
        const j = aw.edges[e * 2 + 1]!
        const key = slotOf(i) * 2 + (out(i) || out(j) ? 1 : 0)
        let path = lines.get(key)
        if (!path) { path = new Path2D(); lines.set(key, path) }
        const dx = ax[j]! - ax[i]!
        const dy = ay[j]! - ay[i]!
        path.moveTo(ax[i]!, ay[i]!)
        path.quadraticCurveTo((ax[i]! + ax[j]!) / 2 - dy * aw.bow[e]!, (ay[i]! + ay[j]!) / 2 + dx * aw.bow[e]!, ax[j]!, ay[j]!)
      }
      g.lineCap = 'round'
      for (const [key, path] of lines) {
        g.strokeStyle = inkOf(Math.floor(key / 2))
        g.lineWidth = a.spacing < 7 ? 0.7 : 1
        g.globalAlpha = (a.spacing < 7 ? 0.4 : 0.55) * (1 - 0.35 * mix) * st.lineIn * (key & 1 ? faded : 1)
        g.stroke(path)
      }
      // The copies on Κλαδιά: a dashed line from each copy back to the article it copies, straight across the branches; those of an outlet under the pointer strong.
      const links = a.branch ? plegma.articleLinks : null
      if (links) {
        g.setLineDash([3, 4])
        g.lineWidth = 1.2
        g.strokeStyle = st.ink
        links.pairs.forEach(([i, j], k) => {
          if (i >= aw.n || j >= aw.n) return
          const strong = !links.hot || links.hot.has(k)
          g.globalAlpha = (strong ? (links.hot ? 0.85 : 0.5) : 0.1) * st.lineIn
          // A little bow, so the line reads as a link between two articles, not a branch.
          const dx = ax[i]! - ax[j]!
          const dy = ay[i]! - ay[j]!
          g.beginPath()
          g.moveTo(ax[j]!, ay[j]!)
          g.quadraticCurveTo((ax[i]! + ax[j]!) / 2 - dy * 0.18, (ay[i]! + ay[j]!) / 2 + dx * 0.18, ax[i]!, ay[i]!)
          g.stroke()
        })
        g.setLineDash([])
      }
    }
    const rim = clamp(a.dr * 0.4, 0.8, 1.6)
    // A node is a small ring in the color of its group, with nothing inside it (the page shows through); the ones a card points at (below) are solid, so they stand out.
    const rims = new Path2D()
    const rimsOut = new Path2D()
    const fills = new Map<number, Path2D>()
    for (let i = 1; i < aw.n; i++) {
      if (lit && lit[i]) continue
      const r = rOf(i) * NODE_SCALE
      const under = out(i) ? rimsOut : rims
      under.moveTo(ax[i]! + r + rim, ay[i]!)
      under.arc(ax[i]!, ay[i]!, r + rim, 0, TAU)
      const key = slotOf(i) * 2 + (out(i) ? 1 : 0)
      let path = fills.get(key)
      if (!path) { path = new Path2D(); fills.set(key, path) }
      path.moveTo(ax[i]! + r, ay[i]!)
      path.arc(ax[i]!, ay[i]!, r, 0, TAU)
    }
    g.globalAlpha = st.nodeIn
    g.fillStyle = st.paper
    g.fill(rims)
    g.globalAlpha = st.nodeIn * faded
    g.fill(rimsOut)
    g.lineWidth = clamp(a.dr * 0.34, 1, 1.6)
    for (const [key, path] of fills) {
      const slot = Math.floor(key / 2)
      g.strokeStyle = slot < 0 ? col : st.groupInk[slot] ?? st.mute
      g.globalAlpha = (1 - 0.35 * mix) * st.nodeIn * (key & 1 ? faded : 1)
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
    // On Κλαδιά it is the first article: the color of its group, as the other nodes.
    {
      const er = gatherR(0, centerRadius())
      const col = a.branch && articles ? (slotOf(0) < 0 ? colourOf(s) : st.groupInk[slotOf(0)] ?? st.mute) : colourOf(s)
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
    if (a.branch) drawBranchNames(g, a)
    // The ring: a thin line with nothing inside it. With the groups known it is an arc for each group, over the sector of its articles.
    else {
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
    }
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
  // While an outlet of Αντίγραφα is pointed at (plegma.articleLinks with its copies hot): a card by each of its copies, drawn as the app's tooltip, with the whole title,
  // the outlet and its time, and the outlet and time of the article it copies. The cards keep clear of each other inside the region, with a thin line to their copy.
  const CARD_W = 280
  const CARD_PAD = 12
  const CARD_LINE = 17
  const CARD_ROW = 19
  const CARD_TITLE_LINES = 3
  const wrapTitle = (text: string) => {
    const room = CARD_W - CARD_PAD * 2
    const lines: string[] = []
    let line = ''
    for (const word of text.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word
      if (measure(next, 12, 600) <= room || !line) line = next
      else { lines.push(line); line = word }
    }
    if (line) lines.push(line)
    if (lines.length > CARD_TITLE_LINES) {
      let last = lines.slice(CARD_TITLE_LINES - 1).join(' ')
      while (last.length > 4 && measure(`${last}…`, 12, 600) > room) last = last.slice(0, -1).trimEnd()
      return [...lines.slice(0, CARD_TITLE_LINES - 1), `${last}…`]
    }
    return lines
  }
  const drawCopyCards = (g: CanvasRenderingContext2D, a: typeof arts, alpha: number) => {
    const links = plegma.articleLinks
    const list = plegma.articles
    if (!links?.hot?.size || !list || !branch.web) return
    const left = a.cx - (branch.w / 2) * a.k
    const right = a.cx + (branch.w / 2) * a.k
    const top = a.cy - (branch.h / 2) * a.k
    const bottom = a.cy + (branch.h / 2) * a.k
    const pairs = [...links.hot].map(k => links.pairs[k]!).filter(([c, src]) => c < ax.length && src < ax.length && list[c]?.time !== undefined).sort((u, v) => ay[u[0]]! - ay[v[0]]!)
    const taken: { x0: number, y0: number, x1: number, y1: number }[] = []
    g.save()
    g.globalAlpha = alpha
    g.textBaseline = 'middle'
    for (const [c, src] of pairs) {
      const copy = list[c]!
      const source = list[src]!
      const title = wrapTitle(copy.title || copy.outlet)
      const h = CARD_PAD + title.length * CARD_LINE + 11 + CARD_ROW * 2 + 6
      // The nearest free place: beside the copy (on its right, else its left), then up and down from it, then on the other side.
      const onRight = ax[c]! + 18 + CARD_W <= right
      const sides = [onRight ? ax[c]! + 18 : ax[c]! - 18 - CARD_W, onRight ? ax[c]! - 18 - CARD_W : ax[c]! + 18].map(v => Math.max(left, Math.min(right - CARD_W, v)))
      const want = Math.max(top, Math.min(bottom - h, ay[c]! - 22))
      const meets = (x: number, y: number) => taken.some(o => x < o.x1 + 8 && x + CARD_W > o.x0 - 8 && y < o.y1 + 8 && y + h > o.y0 - 8)
      let spot: { x: number, y: number } | null = null
      for (const x of sides) {
        for (let k = 0; !spot && k <= 2 * Math.ceil((bottom - top) / 10); k++) {
          const y = want + Math.ceil(k / 2) * 10 * (k % 2 ? 1 : -1)
          if (y >= top && y + h <= bottom && !meets(x, y)) spot = { x, y }
        }
        if (spot) break
      }
      if (!spot) continue
      const { x, y } = spot
      taken.push({ x0: x, y0: y, x1: x + CARD_W, y1: y + h })
      // The line from the copy to its card.
      g.strokeStyle = st.mute
      g.globalAlpha = alpha * 0.6
      g.lineWidth = 1
      g.beginPath()
      g.moveTo(ax[c]!, ay[c]!)
      g.lineTo(x < ax[c]! ? x + CARD_W : x, Math.max(y + 10, Math.min(y + h - 10, ay[c]!)))
      g.stroke()
      g.globalAlpha = alpha
      g.shadowColor = `color-mix(in srgb, ${st.shade} 24%, transparent)`
      g.shadowBlur = 22
      g.shadowOffsetY = 8
      g.fillStyle = st.raised
      g.beginPath()
      g.roundRect(x, y, CARD_W, h, 10)
      g.fill()
      g.shadowColor = 'transparent'
      g.strokeStyle = st.border
      g.lineWidth = 1
      g.stroke()
      let ty = y + CARD_PAD + CARD_LINE / 2 - 2
      g.font = `600 12px ${st.fontText}`
      g.fillStyle = st.strong
      g.textAlign = 'left'
      for (const line of title) { g.fillText(line, x + CARD_PAD, ty); ty += CARD_LINE }
      const rule = ty - CARD_LINE / 2 + 5
      g.strokeStyle = st.border
      g.beginPath()
      g.moveTo(x + CARD_PAD, rule)
      g.lineTo(x + CARD_W - CARD_PAD, rule)
      g.stroke()
      const row = (k: number, slot: number, solid: boolean, label: string, value: string, strong: boolean) => {
        const ry = rule + 6 + CARD_ROW * k + CARD_ROW / 2
        g.beginPath()
        g.arc(x + CARD_PAD + 4, ry, 4, 0, TAU)
        if (solid) { g.fillStyle = st.groupInk[slot] ?? st.mute; g.fill() }
        else { g.strokeStyle = st.groupInk[slot] ?? st.mute; g.lineWidth = 1.5; g.stroke() }
        g.font = `${strong ? '600 ' : ''}12px ${st.fontText}`
        g.textAlign = 'right'
        g.fillStyle = strong ? st.strong : st.mute
        g.fillText(value, x + CARD_W - CARD_PAD, ry)
        const room = CARD_W - CARD_PAD * 2 - 16 - measure(value, 12, strong ? 600 : 400) - 10
        let text = label
        while (text.length > 4 && measure(text, 12, 400) > room) text = `${text.slice(0, -2).trimEnd()}…`
        g.font = `12px ${st.fontText}`
        g.textAlign = 'left'
        g.fillStyle = strong ? st.ink : st.mute
        g.fillText(text, x + CARD_PAD + 16, ry)
      }
      row(0, plegma.inkSlot(copy), true, copy.outlet, whenText(copy.time!), true)
      row(1, plegma.inkSlot(source), false, deps.t('story.copies.of', { outlet: source.outlet }), source.time === undefined ? '' : whenText(source.time), false)
    }
    g.restore()
  }
  // The names of Κλαδιά: the start node's, the marks of the axis, the first articles of the first groups and the ends of the branches. They come in last and go first when the view is left.
  const drawBranchNames = (g: CanvasRenderingContext2D, a: typeof arts) => {
    const alpha = st.ringIn * (1 - clamp(st.ringOut * 2, 0, 1))
    if (alpha <= 0.01) return
    const web = branch.web!
    const X = (x: number) => a.cx + x * a.k
    const Y = (y: number) => a.cy + y * a.k
    const { names, ticks } = namesNow()
    g.strokeStyle = st.mute
    g.lineWidth = 1
    g.globalAlpha = 0.5 * alpha
    g.beginPath()
    for (const x of ticks) { g.moveTo(X(x), Y(web.axisY) - 18); g.lineTo(X(x), Y(web.axisY) - 12) }
    g.stroke()
    g.textBaseline = 'alphabetic'
    g.lineJoin = 'round'
    for (const name of names) {
      const x = X(name.x)
      const y = Y(name.y)
      g.globalAlpha = alpha * name.alpha
      if (name.dot >= 0) {
        g.fillStyle = name.dot > 0 ? st.groupInk[name.dot] ?? st.mute : st.mute
        g.beginPath()
        g.arc(name.anchor === 'end' ? x : x + 3, y - 4, 3.2, 0, TAU)
        g.fill()
      }
      const tx = name.dot >= 0 ? (name.anchor === 'end' ? x - 9 : x + 10) : x
      g.font = `${name.weight === 400 ? '' : `${name.weight} `}${name.size}px ${st.fontText}`
      g.textAlign = name.anchor === 'middle' ? 'center' : name.anchor === 'end' ? 'right' : 'left'
      g.lineWidth = 3.5
      g.strokeStyle = st.paper
      g.strokeText(name.text, tx, y)
      g.fillStyle = name.mute ? st.mute : st.ink
      g.fillText(name.text, tx, y)
    }
    g.textAlign = 'left'
    drawCopyCards(g, a, alpha)
  }
  // The article that node i of the web stands for, of `len` articles: itself when the web has one node for each article (Κλαδιά, or a small story).
  const nodeArticle = (i: number, len: number) => (arts.aw?.n === len ? i : articleOfNode(i, len))
  // The radius of the disc at the center of the web of the story, as drawn in the last frame (the dot of a theme comes to it, stage-draw.ts).
  const centerRadius = () => (arts.branch ? startRadius(arts.dr) : Math.max(5, arts.dr * 2.3))
  // Where the center of the story's web was drawn in the last frame (the start node of Κλαδιά, at the left of its region); null before the story's web is laid out.
  const centerPoint = (s: PlegmaStory) => (arts.id === s.id && ax.length ? { x: ax[0]!, y: ay[0]! } : null)
  // How far around the story (in the world) the other stories are pushed out: the ring of the circle web, or the corners of Κλαδιά's region.
  const clearRadius = (s: PlegmaStory) => {
    const b = branchOf(s)
    return b ? Math.hypot(b.w, b.h) / 2 / b.fz : articleWorldRadius(s) * 1.25 * articleAspect()
  }
  // Where the lines to other stories leave the web: the ring of the circle web, or around the start node of Κλαδιά (the dot that is the story).
  const linkFrom = (s: PlegmaStory) => {
    if (branchOf(s) && arts.id === s.id) return { x: ax[0]!, y: ay[0]!, edge: centerRadius() * 1.7 + 8, kx: 1 }
    const here = toScreen(st.cam, st.width, st.height, placed(s))
    return { x: here.x, y: here.y, edge: ringOf(articleWorldRadius(s) * st.cam.z) + 9, kx: articleAspect() }
  }
  const isBranch = (s: PlegmaStory) => !!branchOf(s)
  // The step of the band of the days (Κλαδιά) under a point of the screen, as the last frame drew it: its place, its time and its articles.
  const bandAt = (s: PlegmaStory, x: number, y: number) => {
    const band = bandNow()
    const web = branch.web
    if (!arts.branch || arts.id !== s.id || !band || !web || band.x.length < 3) return null
    const { z, cam } = st.zoom
    const X = (v: number) => arts.cx + (v - cam.x) * z * arts.k
    const Y = (v: number) => arts.cy + v * arts.k
    const base = web.axisY - 14
    if (y < Y(base - bandRoom(branch.h) - 6) - 6 || y > Y(web.axisY) + 6) return null
    if (x < X(band.x[0]!) - 4 || x > X(band.x[band.x.length - 1]!) + 4) return null
    let best = 1
    for (let b = 2; b < band.x.length - 1; b++) if (Math.abs(X(band.x[b]!) - x) < Math.abs(X(band.x[best]!) - x)) best = b
    const span = band.spans[best - 1]
    if (!span) return null
    const day = fmtDay(athensDate(span.from))
    return { bin: best - 1, from: span.from, to: span.to, n: band.n[best]!, label: band.step >= 1440 ? day : `${day}, ${athensClock(span.from)}–${athensClock(span.to + 1)}` }
  }
  // Where the story web of Κλαδιά was last drawn: its middle on the screen and its scale against the framing (the zoom's points are in px of the framing, from that middle).
  const zoomFrame = (s: PlegmaStory) => (arts.branch && arts.id === s.id ? { cx: arts.cx, cy: arts.cy, k: arts.k } : null)
  return { lagText, bandAt, publishWindow, stepWebZoom, zoomFrame, drawArticles, articleAt, ringAt, articleWorldRadius, articleAspect, ringOf, sectorOf, byOutlet, centerRadius, centerPoint, clearRadius, linkFrom, nodeArticle, isBranch }
}

export type StageArticles = ReturnType<typeof createStageArticles>
