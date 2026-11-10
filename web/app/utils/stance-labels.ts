import { round } from './net-layout.ts'

// The names of the dots of the stance map (StanceMap of media-v2.html): a name for every dot, as many as fit. The most crowded dots choose first,
// each tries 4 distances and 8 directions around its dot and gets a thin leader line when its name is not next to it.
export interface Box { x0: number, x1: number, y0: number, y1: number }
export interface Dot { name: string, n: number, x: number, y: number, r: number }
export interface Placed { name: string, x: number, y: number, leader: { x1: number, y1: number, x2: number, y2: number } | null }

const ANGLES = [0, Math.PI, -Math.PI / 6, Math.PI / 6, (-5 * Math.PI) / 6, (5 * Math.PI) / 6, -Math.PI / 2, Math.PI / 2]
const hit = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1

// `plot` is the box the names stay inside, `obstacles` the names of the zones and the averages. Math.sin and Math.cos can differ in the last digit between the
// server and the browser, so every position is rounded to 0.0001 px.
export const placeLabels = (dots: Dot[], obstacles: Box[], plot: Box): Placed[] => {
  const boxes = obstacles.slice()
  const crowd = (o: Dot) => dots.filter(q => q !== o && Math.hypot(q.x - o.x, q.y - o.y) < 46).length
  const out: Placed[] = []
  for (const o of dots.slice().sort((a, b) => crowd(b) - crowd(a) || b.n - a.n)) {
    const w = o.name.length * 6.4 + 2
    search: for (const d of [4, 14, 28, 44]) {
      for (const th of ANGLES) {
        const cs = Math.cos(th)
        const sn = Math.sin(th)
        const ax = o.x + cs * (o.r + d)
        const ay = o.y + sn * (o.r + d)
        const xa = cs > 0.4 ? ax : cs < -0.4 ? ax - w : ax - w / 2
        const ya = Math.abs(sn) < 0.4 ? ay - 7 : sn > 0 ? ay : ay - 14
        const b: Box = { x0: xa, x1: xa + w, y0: ya, y1: ya + 14 }
        if (b.x0 < plot.x0 || b.x1 > plot.x1 || b.y0 < plot.y0 || b.y1 > plot.y1) continue
        if (boxes.some(q => hit(b, q))) continue
        if (dots.some(q => b.x0 < q.x + q.r + 1 && q.x - q.r - 1 < b.x1 && b.y0 < q.y + q.r + 1 && q.y - q.r - 1 < b.y1)) continue
        boxes.push(b)
        let leader: Placed['leader'] = null
        if (d > 4) {
          const tx = Math.min(Math.max(o.x, b.x0), b.x1)
          const ty = Math.min(Math.max(o.y, b.y0), b.y1)
          const len = Math.hypot(tx - o.x, ty - o.y) || 1
          leader = { x1: round(o.x + ((tx - o.x) / len) * o.r), y1: round(o.y + ((ty - o.y) / len) * o.r), x2: round(tx), y2: round(ty) }
        }
        out.push({ name: o.name, x: round(b.x0), y: round(b.y0 + 11), leader })
        break search
      }
    }
  }
  return out
}
