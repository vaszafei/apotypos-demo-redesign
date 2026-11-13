// Small pure helpers of the drawing of PlegmaStage: numbers, colors, the turn of the field and the arcs of a ring. They hold no state of the stage.
export const TAU = Math.PI * 2
export const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))

// The color (#rrggbb) mixed with another, `share` of the other: the group colors mixed with one gray are one calm family.
export const mixHex = (hex: string, other: string, share: number) => {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex)
  const o = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(other)
  if (!m || !o) return hex
  return `#${[1, 2, 3].map(i => Math.round(parseInt(m[i]!, 16) * (1 - share) + parseInt(o[i]!, 16) * share).toString(16).padStart(2, '0')).join('')}`
}
// A color of the tokens (#rrggbb) with an alpha, for a gradient.
export const withAlpha = (hex: string, alpha: number) => (/^#[0-9a-f]{6}$/i.test(hex) ? `${hex}${Math.round(alpha * 255).toString(16).padStart(2, '0')}` : hex)

// The map is alive like the nebyss hero: the whole field turns slowly about the middle of the page, each dot at its own steady pace (slower the farther out), no jitter.
// It is drawn only, a story keeps its place in the world; with reduced motion there is none. The result is one object that every call fills again: read it before the next call.
const ORBIT = 0.025
const ORBIT_REACH = 420
const driftSpot = { x: 0, y: 0 }
export const orbit = (dx: number, dy: number, sec: number) => {
  const a = sec * ORBIT / (1 + Math.hypot(dx, dy) / ORBIT_REACH)
  const cos = Math.cos(a)
  const sin = Math.sin(a)
  driftSpot.x = dx * cos - dy * sin - dx
  driftSpot.y = dx * sin + dy * cos - dy
  return driftSpot
}

// The arcs of a ring from counts: [start, span] in radians from the top, clockwise, for each count, as wide as its share of the total (the stance: critical, neutral and supportive;
// on a theme the groups too).
export const shareArcs = (counts: number[] | null) => {
  const total = counts ? counts.reduce((x, y) => x + y, 0) : 0
  if (!counts || !total) return null
  const used = counts.filter(c => c > 0).length
  const room = used > 1 ? Math.min(0.09, (Math.PI * 0.5) / used) : 0
  const out = new Float32Array(counts.length * 2)
  let at = 0
  for (let k = 0; k < counts.length; k++) {
    const span = counts[k]! > 0 ? (TAU - used * room) * (counts[k]! / total) : 0
    out[k * 2] = at + (counts[k]! > 0 ? room / 2 : 0)
    out[k * 2 + 1] = span
    at += span + (counts[k]! > 0 ? room : 0)
  }
  return out
}
