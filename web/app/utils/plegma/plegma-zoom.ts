// The zoom of the story web (#222, option M): three levels (the whole web, 2.4, 5). A mouse notch glides one level, and notches during a glide add up; a trackpad
// or a pinch zooms smoothly and, when the fingers stop, settles on the next level the way it went. The point under the pointer stays where it is; a drag pans,
// with a little inertia; a double-click goes back to the whole web. The zoom never goes farther out than the whole web.
// Points are in px of the region at the framing zoom, from the middle of the region (as the layout of Κλαδιά): `view` is where a point is drawn,
// `web` is the point of the layout; view = (web - cam) * z.

export const ZOOM_LEVELS = [1, 2.4, 5] as const
const DEEPEST = ZOOM_LEVELS[ZOOM_LEVELS.length - 1]!
// How long a trackpad must rest before the zoom settles on a level, and the reach of a smooth zoom past the levels while the fingers move.
const SETTLE_MS = 240
const Z_MIN = 0.9
const Z_MAX = DEEPEST * 1.15
// A wheel step this large is a mouse notch; a trackpad or a pinch sends many small ones.
const NOTCH = 50
// The time constants (ms) of the ease toward the zoom asked: a smooth zoom follows the fingers closely, a level is reached more slowly.
const TAU_SMOOTH = 65
const TAU_LEVEL = 110

export interface ZoomPoint { x: number, y: number }
export interface WebZoom {
  z: number
  // The zoom it eases toward.
  zt: number
  tau: number
  // The point of the web at the middle of the region.
  cam: ZoomPoint
  // The point of the view that stays under the pointer, and the point of the web under it.
  anchor: ZoomPoint
  anchorW: ZoomPoint
  glide: { z0: number, z1: number, t0: number, ms: number, a0: ZoomPoint, home: boolean } | null
  // While a trackpad moves: when it settles, and the zoom it started from.
  snapAt: number
  startZ: number
  // The speed of a pan (view px per ms), kept for a little after the drag ends.
  vel: ZoomPoint
  drag: { x: number, y: number, t: number, moved: number } | null
}

export const createWebZoom = (): WebZoom => ({ z: 1, zt: 1, tau: TAU_SMOOTH, cam: { x: 0, y: 0 }, anchor: { x: 0, y: 0 }, anchorW: { x: 0, y: 0 }, glide: null, snapAt: 0, startZ: 1, vel: { x: 0, y: 0 }, drag: null })
export const resetWebZoom = (zs: WebZoom) => Object.assign(zs, createWebZoom())
// Whether the web is (or is going) away from its whole view.
export const isZoomed = (zs: WebZoom) => zs.z > 1.001 || zs.zt > 1.001 || !!zs.glide || Math.abs(zs.cam.x) > 0.01 || Math.abs(zs.cam.y) > 0.01
// Whether a frame would still change the zoom.
export const zoomMoving = (zs: WebZoom) => !!zs.glide || !!zs.drag || !!zs.snapAt || Math.abs(zs.zt - zs.z) > 0 || Math.abs(zs.vel.x) + Math.abs(zs.vel.y) > 0.01

const webAt = (zs: WebZoom, v: ZoomPoint) => ({ x: v.x / zs.z + zs.cam.x, y: v.y / zs.z + zs.cam.y })
const setAnchor = (zs: WebZoom, v: ZoomPoint) => { zs.anchorW = webAt(zs, v); zs.anchor = { ...v } }

// The next level deeper (dir 1) or farther (dir -1) than a zoom; undefined past the last.
export const nextLevel = (from: number, dir: 1 | -1) => (dir > 0 ? ZOOM_LEVELS.find(l => l > from * 1.05) : [...ZOOM_LEVELS].reverse().find(l => l < from / 1.05))
// The level a smooth zoom settles on: the nearest to where it started when it hardly moved, else the next level the way it went.
export const settleLevel = (startZ: number, zt: number) => {
  const moved = Math.log(zt / startZ)
  if (Math.abs(moved) < 0.1) return ZOOM_LEVELS.reduce((a, l) => (Math.abs(Math.log(l / startZ)) < Math.abs(Math.log(a / startZ)) ? l : a), ZOOM_LEVELS[0])
  return moved > 0 ? (ZOOM_LEVELS.find(l => l >= zt * 0.92 && l > startZ * 1.05) ?? DEEPEST) : ([...ZOOM_LEVELS].reverse().find(l => l <= zt / 0.92 && l < startZ / 1.05) ?? ZOOM_LEVELS[0])
}

// A wheel event at a point of the view: `dy` in px (lines already turned to px), `ctrl` for a pinch (the browser sends a pinch as a wheel with Ctrl).
export const zoomWheel = (zs: WebZoom, e: { dy: number, ctrl: boolean, at: ZoomPoint }, now: number) => {
  setAnchor(zs, e.at)
  zs.glide = null
  if (!e.ctrl && Math.abs(e.dy) >= NOTCH) {
    const next = nextLevel(zs.snapAt ? zs.z : zs.zt, e.dy < 0 ? 1 : -1)
    zs.snapAt = 0
    if (next) { zs.zt = next; zs.tau = TAU_LEVEL }
    return
  }
  if (!zs.snapAt) zs.startZ = zs.zt
  zs.zt = Math.min(Z_MAX, Math.max(Z_MIN, zs.zt * Math.exp(-e.dy * (e.ctrl ? 1 / 60 : 1 / 110))))
  zs.snapAt = now + SETTLE_MS
  zs.tau = TAU_SMOOTH
}

const glideTo = (zs: WebZoom, z1: number, at: ZoomPoint, now: number, ms: number) => {
  setAnchor(zs, at)
  zs.vel = { x: 0, y: 0 }
  zs.snapAt = 0
  zs.glide = { z0: zs.z, z1, t0: now, ms, a0: { ...zs.anchorW }, home: z1 === 1 }
  zs.zt = z1
}
// A double-click: back to the whole web.
export const zoomHome = (zs: WebZoom, at: ZoomPoint, now: number) => glideTo(zs, 1, at, now, 700)

export const zoomDown = (zs: WebZoom, at: ZoomPoint, now: number) => {
  setAnchor(zs, at)
  zs.drag = { x: at.x, y: at.y, t: now, moved: 0 }
  zs.vel = { x: 0, y: 0 }
  zs.glide = null
  zs.zt = zs.z
}
export const zoomMove = (zs: WebZoom, at: ZoomPoint, now: number) => {
  const d = zs.drag
  if (!d) return
  const dt = Math.max(1, now - d.t)
  zs.vel = { x: 0.7 * zs.vel.x + (0.3 * (at.x - d.x)) / dt, y: 0.7 * zs.vel.y + (0.3 * (at.y - d.y)) / dt }
  zs.anchor = { ...at }
  zs.drag = { x: at.x, y: at.y, t: now, moved: d.moved + Math.hypot(at.x - d.x, at.y - d.y) }
}
// The end of a drag: how far it moved (a click is a drag that did not move). A drag that rested before it ended keeps no speed.
export const zoomUp = (zs: WebZoom, now: number) => {
  const d = zs.drag
  if (!d) return 0
  if (now - d.t > 80) zs.vel = { x: 0, y: 0 }
  zs.drag = null
  return d.moved
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
// One frame: `dt` ms since the last, `box` the size of the region. With `still` (reduced motion) the zoom goes where it is asked at once.
export const stepZoom = (zs: WebZoom, now: number, dt: number, box: { w: number, h: number }, still = false) => {
  if (zs.snapAt && (still || now > zs.snapAt) && !zs.drag) {
    zs.snapAt = 0
    zs.zt = settleLevel(zs.startZ, zs.zt)
    zs.tau = TAU_LEVEL
  }
  const g = zs.glide
  if (g) {
    const t = g.ms && !still ? Math.min(1, (now - g.t0) / g.ms) : 1
    const e = ease(t)
    zs.z = Math.exp(Math.log(g.z0) + (Math.log(g.z1) - Math.log(g.z0)) * e)
    // Going home the point under the pointer slides to where the whole web has it, so the web comes back to its place.
    if (g.home) zs.anchorW = { x: g.a0.x + (zs.anchor.x - g.a0.x) * e, y: g.a0.y + (zs.anchor.y - g.a0.y) * e }
    if (t >= 1) zs.glide = null
  } else {
    zs.z = still ? zs.zt : zs.z + (zs.zt - zs.z) * (1 - Math.exp(-dt / zs.tau))
    if (Math.abs(zs.zt - zs.z) < 0.0005) zs.z = zs.zt
  }
  if (!zs.drag && Math.abs(zs.vel.x) + Math.abs(zs.vel.y) > 0.01) {
    if (still) zs.vel = { x: 0, y: 0 }
    else {
      zs.anchor = { x: zs.anchor.x + zs.vel.x * dt, y: zs.anchor.y + zs.vel.y * dt }
      const f = Math.exp(-dt / 220)
      zs.vel = { x: zs.vel.x * f, y: zs.vel.y * f }
    }
  }
  const cam = { x: zs.anchorW.x - zs.anchor.x / zs.z, y: zs.anchorW.y - zs.anchor.y / zs.z }
  // The view never leaves the whole web's framing: at the whole web the camera is at the middle; deeper it may go as far as the edge of the region, and a little more.
  const reach = (side: number) => Math.max(0, (side / 2) * (1 - 1 / zs.z) + (40 * (zs.z - 1)) / zs.z)
  const mx = reach(box.w)
  const my = reach(box.h)
  const cx = Math.min(mx, Math.max(-mx, cam.x))
  const cy = Math.min(my, Math.max(-my, cam.y))
  zs.anchorW = { x: zs.anchorW.x + cx - cam.x, y: zs.anchorW.y + cy - cam.y }
  zs.cam = { x: cx, y: cy }
}
