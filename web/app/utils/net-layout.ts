import type { NetGroup, NetOutlet } from './groups'

export const round = (v: number) => Math.round(v * 10000) / 10000

export interface HubNode { kind: 'hub', g: NetGroup, x: number, y: number, r: number }
export interface OutletNode { kind: 'outlet', g: NetGroup, o: NetOutlet, x: number, y: number, r: number, vx: number, vy: number }
export type NetNode = HubNode | OutletNode
export interface Cluster { g: NetGroup, hub: HubNode, outs: OutletNode[], R: number, x: number, y: number, solo?: boolean, t?: number }

// The layout of the network (netLayout in groups-v2.html, same arithmetic): each group is a node with its outlets joined to it. The area of an outlet is its collected articles.
// Two steps, both run to the end, so the first draw is the final one: the outlets settle round their group (links like springs, circles that push apart),
// then the groups settle in the chart as circles of the size of their outlets.
const AXIS_MARGIN = 40
// The axis has three equal zones: critical (below -ZONE), neutral (within ZONE of 0) and supportive (above ZONE); inside a zone the place is linear in the value, so each zone is easy to read.
export const ZONE = 0.05
const unit = (v: number, lo: number, hi: number) => (hi > lo ? Math.max(0, Math.min(1, (v - lo) / (hi - lo))) : 0.5)
export const zoneUnit = (v: number, lo: number, hi: number) => (v < -ZONE ? unit(v, Math.min(lo, -ZONE - 0.01), -ZONE) / 3 : v <= ZONE ? 1 / 3 + unit(v, -ZONE, ZONE) / 3 : 2 / 3 + unit(v, ZONE, Math.max(hi, ZONE + 0.01)) / 3)
// `wide` (a screen of the Plegma, a box much wider than tall): the circles take a smaller part of the area, the groups spread over the whole width, and the outlets without a group stand alone.
// `axis` (with `wide`): a value for a group or for an outlet without a group (null when there is none); the groups stand from left to right by it, and only up and down are free.
export const netLayout = (groups: NetGroup[], width: number, height: number, wide = false, axis?: (outlets: NetOutlet[]) => number | null) => {
  const cx = width / 2
  const cy = height / 2
  const sumV = groups.reduce((a, g) => a + g.value, 0)
  const maxG = Math.max(...groups.map(g => g.value))
  let k = Math.sqrt(((wide ? 0.11 : 0.2) * width * height) / (Math.PI * sumV))
  let clusters: Cluster[] = []
  let scale = { lo: 0, hi: 0 }
  for (let attempt = 0; attempt < 12; attempt++) {
    // The outlets without a group are not a group: each one stands alone, with no node and no line.
    const units = groups.flatMap((g, gi) => (wide && g.key === null ? g.outlets.map(o => ({ g, gi, list: [o], solo: true })) : [{ g, gi, list: g.outlets, solo: false }]))
    const raw = units.map(u => (wide && axis ? axis(u.list) : null))
    const known = raw.filter((v): v is number => v !== null)
    // The ends of the axis are the 10th and the 90th percentile, so one outlet with a few analysed articles does not squeeze the groups; the ones beyond stand at the edge.
    const sorted = known.slice().sort((a, b) => a - b)
    const [lo, hi] = [sorted[Math.floor((sorted.length - 1) * 0.1)] ?? 0, sorted[Math.ceil((sorted.length - 1) * 0.9)] ?? 0]
    scale = { lo, hi }
    // Inside its zone a place is half by the value and half by the rank among the ones of the zone, so the zone is used from one side to the other and not only where the values crowd.
    const place = raw.map<number | null>(() => null)
    for (let z = 0; z < 3; z++) {
      const inZone = raw.map((v, i) => ({ v, i })).filter((e): e is { v: number, i: number } => e.v !== null && (e.v < -ZONE ? 0 : e.v <= ZONE ? 1 : 2) === z).sort((a, b) => a.v - b.v)
      inZone.forEach((e, rank) => {
        const within = zoneUnit(e.v, lo, hi) * 3 - z
        place[e.i] = (z + 0.08 + 0.84 * (0.5 * within + 0.5 * ((rank + 0.5) / inZone.length))) / 3
      })
    }
    clusters = units.map(({ g, gi, list, solo }, ui) => {
      const t = place[ui] ?? 0.5
      const hub: HubNode = { kind: 'hub', g, x: 0, y: 0, r: solo ? 0 : 8 + 6 * Math.sqrt(g.value / maxG) }
      if (solo) {
        const o = list[0]!
        const r = Math.max(4.5, k * Math.sqrt(o.value))
        return { g, hub, outs: [{ kind: 'outlet', g, o, r, x: 0, y: 0, vx: 0, vy: 0 } as OutletNode], R: r, x: 0, y: 0, solo, t }
      }
      const outs: OutletNode[] = list.map((o, oi) => {
        const r = Math.max(4.5, k * Math.sqrt(o.value))
        const ang = oi * 2.399963 + gi
        const dist = hub.r + r + 8 + oi * 4
        return { kind: 'outlet', g, o, r, x: Math.cos(ang) * dist, y: Math.sin(ang) * dist, vx: 0, vy: 0 }
      })
      for (let it = 0; it < 300; it++) {
        for (const n of outs) {
          const d = Math.hypot(n.x, n.y) || 0.01
          const f = (d - (hub.r + n.r + 10)) * 0.12
          n.vx -= (n.x / d) * f
          n.vy -= (n.y / d) * f
        }
        for (let i = 0; i < outs.length; i++) {
          for (let j = i + 1; j < outs.length; j++) {
            const p = outs[i]!
            const q = outs[j]!
            const dx = q.x - p.x
            const dy = q.y - p.y
            const d = Math.hypot(dx, dy) || 0.01
            const min = p.r + q.r + 4
            if (d < min) { const f = (min - d) * 0.5; p.vx -= (dx / d) * f; p.vy -= (dy / d) * f; q.vx += (dx / d) * f; q.vy += (dy / d) * f }
          }
        }
        for (const n of outs) { n.x += n.vx; n.y += n.vy; n.vx *= 0.6; n.vy *= 0.6 }
      }
      const R = Math.max(hub.r, ...outs.map(n => Math.hypot(n.x, n.y) + n.r))
      return { g, hub, outs, R, x: 0, y: 0, solo, t }
    })
    const byAxis = wide && !!axis
    const aim = (c: Cluster) => Math.max(c.R + 8, Math.min(width - c.R - 8, AXIS_MARGIN + (width - 2 * AXIS_MARGIN) * (c.t ?? 0.5)))
    clusters.forEach((c, i) => {
      const a = (i / clusters.length) * 2 * Math.PI - Math.PI / 2 + 0.35
      c.x = cx + Math.cos(a) * width * (wide ? 0.42 : 0.3)
      c.y = cy + Math.sin(a) * height * (wide ? 0.4 : 0.3)
      if (byAxis) c.x = aim(c)
    })
    // The groups are circles that cannot overlap each other, drawn a little to the center and kept in the chart.
    for (let it = 0; it < 700; it++) {
      for (const c of clusters) { c.x += byAxis ? (aim(c) - c.x) * 0.3 : (cx - c.x) * (wide ? 0 : 0.012); c.y += (cy - c.y) * (wide ? 0.002 : 0.03) }
      for (let pass = 0; pass < 3; pass++) {
        for (let i = 0; i < clusters.length; i++) {
          for (let j = i + 1; j < clusters.length; j++) {
            const p = clusters[i]!
            const q = clusters[j]!
            const dx = q.x - p.x
            const dy = q.y - p.y
            const d = Math.hypot(dx, dy) || 0.01
            const min = p.R + q.R + 22
            if (d < min) { const m = (min - d) / 2; p.x -= (dx / d) * m; p.y -= (dy / d) * m; q.x += (dx / d) * m; q.y += (dy / d) * m }
          }
        }
        for (const c of clusters) {
          c.x = Math.max(c.R + 8, Math.min(width - c.R - 8, c.x))
          c.y = Math.max(c.R + 22, Math.min(height - c.R - 22, c.y))
        }
      }
    }
    if (byAxis) {
      // Each group stands exactly at its place on the axis; two that are too close are moved apart up and down.
      for (const c of clusters) c.x = aim(c)
      for (let it = 0; it < 400; it++) {
        for (let i = 0; i < clusters.length; i++) {
          for (let j = i + 1; j < clusters.length; j++) {
            const p = clusters[i]!
            const q = clusters[j]!
            const min = p.R + q.R + 14
            const dx = q.x - p.x
            if (Math.abs(dx) >= min) continue
            const need = Math.sqrt(min * min - dx * dx) - Math.abs(q.y - p.y)
            if (need <= 0) continue
            const dir = q.y === p.y ? (i % 2 ? 1 : -1) : Math.sign(q.y - p.y)
            p.y -= (dir * need) / 2
            q.y += (dir * need) / 2
          }
        }
        for (const c of clusters) c.y = Math.max(c.R + 22, Math.min(height - c.R - 22, c.y))
      }
    } else if (wide) {
      // The groups only move apart: the centers are stretched sideways as far as the outermost circles reach the left and the right edge of the box.
      const reach = (c: Cluster) => ({ l: Math.max(c.hub.r, ...c.outs.map(n => n.r - n.x)), r: Math.max(c.hub.r, ...c.outs.map(n => n.x + n.r)) })
      const edge = Math.min(...clusters.map(c => c.x - reach(c).l))
      const stretch = Math.max(1, Math.min(...clusters.map(c => (width - 16 - reach(c).r) / Math.max(1, c.x - edge))))
      for (const c of clusters) c.x = 8 + (c.x - edge) * stretch
    }
    const overlap = clusters.some((p, i) => clusters.some((q, j) => j > i && Math.hypot(q.x - p.x, q.y - p.y) < p.R + q.R + 10))
    if (!overlap) break
    k *= 0.92
  }
  // Math.sin and Math.cos can differ in the last digit between the server and the browser, so the positions are rounded to 0.0001 px
  // and the prerendered page and the hydrated one print the same numbers.
  for (const c of clusters) { c.x = round(c.x); c.y = round(c.y); c.R = round(c.R) }
  const nodes: NetNode[] = []
  const links: { a: HubNode, b: OutletNode }[] = []
  for (const c of clusters) {
    const hub: HubNode = { ...c.hub, x: c.x, y: c.y }
    if (!c.solo) nodes.push(hub)
    for (const n of c.outs) { const o: OutletNode = { ...n, x: round(c.x + n.x), y: round(c.y + n.y) }; nodes.push(o); if (!c.solo) links.push({ a: hub, b: o }) }
  }
  // Where a value of the axis stands in the box, for the zones drawn behind the groups.
  const axisX = (v: number) => AXIS_MARGIN + (width - 2 * AXIS_MARGIN) * zoneUnit(v, scale.lo, scale.hi)
  return { nodes, links, clusters, axisX }
}
