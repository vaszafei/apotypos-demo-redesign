import { TAU, shareArcs } from './stage-draw-util'
import type { StageState } from './stage-state'
import type { StageDeps } from './stage-core'

// The names of the arcs of a ring (the web of a story, the web of a theme): drawn outside the ring, each with a dot in its color.
export type NameItem = { mid: number, span: number, text: string, dot: string }
export type RingAt = { cx: number, cy: number, ring: number, kx: number }
export const NAME_MAX = 22

// The names of a ring with many arcs (the outlets of a theme, the outlets of a day): two columns beside the ring, on its left and its right, where the room has space. Each name has the height of its arc as far
// as the names around it allow (they keep a line apart), and a thin line joins it to its arc. A name is cut to the room the column has, and left out only when the room has no line for it.
export type ColumnLook = { fontText: string, paper: string, ink: string, mute: string }
export type Room = { x0: number, y0: number, x1: number, y1: number }
const GAP = 15
export const drawColumns = (g: CanvasRenderingContext2D, look: ColumnLook, room: Room, a: RingAt, items: NameItem[], alpha: number) => {
  g.font = `11.5px ${look.fontText}`
  g.textBaseline = 'middle'
  g.lineJoin = 'round'
  const yMin = Math.max(room.y0, a.cy - a.ring - 4) + 8
  const yMax = room.y1 - 6
  for (const side of [1, -1] as const) {
    const colx = a.cx + side * (a.ring + 24)
    const room_w = side === 1 ? room.x1 - (colx + 9) - 4 : colx - 9 - room.x0 - 4
    const mine = items.map((it) => {
      const ang = it.mid - Math.PI / 2
      return { it, ex: a.cx + Math.cos(ang) * a.ring, ey: a.cy + Math.sin(ang) * a.ring, c: Math.cos(ang), s: Math.sin(ang) }
    }).filter(m => (side === 1 ? m.c >= -0.0001 : m.c < -0.0001)).sort((u, v) => u.ey - v.ey)
    if (!mine.length || room_w < 30) continue
    const ys = mine.map(m => m.ey)
    for (let round = 0; round < 60; round++) {
      let moved = false
      for (let k = 1; k < ys.length; k++) {
        const miss = GAP - (ys[k]! - ys[k - 1]!)
        if (miss > 0.1) { ys[k - 1]! -= miss / 2; ys[k]! += miss / 2; moved = true }
      }
      if (!moved) break
    }
    for (let k = ys.length - 1; k >= 0; k--) ys[k] = Math.min(ys[k]!, k === ys.length - 1 ? yMax : ys[k + 1]! - GAP)
    for (let k = 0; k < ys.length; k++) ys[k] = Math.max(ys[k]!, k === 0 ? yMin : ys[k - 1]! + GAP)
    mine.forEach((m, k) => {
      const y = ys[k]!
      if (y > yMax + 0.5) return
      let text = m.it.text
      while (text.length > 4 && g.measureText(text).width > room_w) text = `${text.slice(0, -2).trimEnd()}…`
      // The line from the arc: out of the ring a little, then to the dot of the name.
      g.strokeStyle = look.mute
      g.globalAlpha = alpha * 0.3
      g.lineWidth = 1
      g.beginPath()
      g.moveTo(m.ex, m.ey)
      g.lineTo(colx - side * 14, y)
      g.lineTo(colx, y)
      g.stroke()
      g.globalAlpha = alpha
      g.textAlign = side === 1 ? 'left' : 'right'
      g.lineWidth = 3.5
      g.strokeStyle = look.paper
      g.strokeText(text, colx + side * 9, y)
      g.fillStyle = look.ink
      g.fillText(text, colx + side * 9, y)
      g.fillStyle = m.it.dot
      g.beginPath()
      g.arc(colx, y, 3.2, 0, TAU)
      g.fill()
    })
  }
  g.lineJoin = 'miter'
  g.textAlign = 'left'
  g.textBaseline = 'alphabetic'
}

export const createStageNames = (st: StageState, deps: StageDeps) => {
  const { plegma } = deps
  // The names of the ring: every arc with a name, widest first, each outside the ring at the middle of its arc with a dot in its color; the outlet on the ring of the outlets, the group on the
  // ring of the groups. A name that meets another one is moved along the ring a step at a time (with a thin line back to its arc), and left out only when no step fits. A name that would
  // leave the room the view gave it (plegma.labelRoom) or touch a box it keeps out of does not fit.
  const NUDGES = [0, 15, -15, 30, -30, 45, -45, 60, -60]
  const ALONG = [0, -0.2, 0.2, -0.35, 0.35]
  const drawNames = (g: CanvasRenderingContext2D, a: RingAt, items: NameItem[], alpha: number, inside = false) => {
    g.font = `11.5px ${st.fontText}`
    g.textBaseline = 'middle'
    g.lineJoin = 'round'
    const lr = plegma.labelRoom
    type Box = { x0: number, y0: number, x1: number, y1: number }
    const px = (r: Box) => ({ x0: r.x0 * st.width, y0: r.y0 * st.height, x1: r.x1 * st.width, y1: r.y1 * st.height })
    const meets = (b: Box, o: Box) => b.x0 < o.x1 && b.x1 > o.x0 && b.y0 < o.y1 && b.y1 > o.y0
    const fits = (b: Box) => {
      if (!lr) return false
      const room = px(lr.room)
      if (b.x0 < room.x0 || b.x1 > room.x1 || b.y0 < room.y0 || b.y1 > room.y1) return false
      return !lr.avoid.some(r => meets(b, px(r)))
    }
    const taken: Box[] = []
    for (const { mid, span, text, dot } of [...items].sort((u, v) => v.span - u.span)) {
      const w = g.measureText(text).width + 9
      let at: { y: number, box: Box, moved: boolean, ex: number, ey: number, x: number, right: boolean } | null = null
      // At the middle of its arc, then at other places along it (a wide arc can have its name where there is room); when `inside`, then inside the ring if there is no room outside it.
      for (const side of inside ? [1, -1] : [1]) {
        for (const along of ALONG) {
          const ang = mid + span * along - Math.PI / 2
          const c = Math.cos(ang)
          const sn = Math.sin(ang)
          const ex = a.cx + c * a.ring * a.kx
          const ey = a.cy + sn * a.ring
          const x = ex + c * 12 * side
          const right = (c >= -0.05) === (side === 1)
          for (const d of NUDGES) {
            const y = ey + sn * 12 * side + d
            const box = { x0: (right ? x : x - w) - 2, x1: (right ? x + w : x) + 2, y0: y - 8, y1: y + 8 }
            if (fits(box) && !taken.some(o => meets(box, o))) { at = { y, box, moved: side === 1 && (d !== 0 || along !== 0), ex, ey, x, right }; break }
          }
          if (at) break
        }
        if (at) break
      }
      if (!at) continue
      const { ex, ey, x, right } = at
      taken.push(at.box)
      g.globalAlpha = alpha
      if (at.moved) {
        g.strokeStyle = st.mute
        g.globalAlpha = alpha * 0.45
        g.lineWidth = 1
        g.beginPath()
        g.moveTo(ex, ey)
        g.lineTo(x, at.y)
        g.stroke()
        g.globalAlpha = alpha
      }
      g.lineWidth = 3.5
      g.textAlign = right ? 'left' : 'right'
      g.strokeStyle = st.paper
      g.strokeText(text, x + (right ? 9 : -9), at.y)
      g.fillStyle = st.ink
      g.fillText(text, x + (right ? 9 : -9), at.y)
      g.fillStyle = dot
      g.beginPath()
      g.arc(x, at.y, 3.2, 0, TAU)
      g.fill()
    }
    g.lineJoin = 'miter'
    g.textAlign = 'left'
    g.textBaseline = 'alphabetic'
  }
  // The names of the arcs of the ring of the stance: critical, neutral, supportive, each with its share of the articles that take a stance.
  const STANCES = ['critical', 'neutral', 'supportive']
  const stanceNames = (stanceAt: NonNullable<ReturnType<typeof shareArcs>>): NameItem[] => {
    const back = (1 - st.ringMix) * (Math.PI / 2)
    const counts = plegma.stance ?? []
    const total = counts.reduce((x, y) => x + y, 0)
    return STANCES.flatMap((key, k) => (stanceAt[k * 2 + 1]! > 0 && total
      ? [{ mid: stanceAt[k * 2]! + stanceAt[k * 2 + 1]! / 2 - back, span: stanceAt[k * 2 + 1]!, text: `${deps.t(`stance.${key}`)} · ${fmtPct(counts[k]! / total)}`, dot: st.stanceInk[k] ?? st.mute }]
      : []))
  }
  const drawNamesColumns = (g: CanvasRenderingContext2D, a: RingAt, items: NameItem[], alpha: number) => {
    const lr = plegma.labelRoom
    if (!lr) return
    const room = { x0: lr.room.x0 * st.width, y0: lr.room.y0 * st.height, x1: lr.room.x1 * st.width, y1: lr.room.y1 * st.height }
    drawColumns(g, { fontText: st.fontText, paper: st.paper, ink: st.ink, mute: st.mute }, room, a, items, alpha)
  }
  return { drawNames, drawNamesColumns, stanceNames }
}
