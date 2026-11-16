import { TAU, shareArcs } from './stage-draw-util'
import type { StageState } from './stage-state'
import type { StageDeps } from './stage-core'

// The names of the arcs of a ring (the web of a story, the web of a theme): drawn outside the ring, each with a dot in its color.
export type NameItem = { mid: number, span: number, text: string, dot: string }
export type RingAt = { cx: number, cy: number, ring: number, kx: number }
export const NAME_MAX = 22

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
  return { drawNames, stanceNames }
}
