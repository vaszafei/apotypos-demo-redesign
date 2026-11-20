// The camera of the Plegma: where it looks to show a story, a theme, the best of the week or a compared pair, and how it flies between two views.
// The flight is "pull back and dive" (chosen from the U1 prototype): the camera moves straight from one place to the other while its zoom dips in the middle,
// and the dip grows with the distance. All of it is pure, so the stage only calls it.

export interface PlegmaCamera { x: number, y: number, z: number }
export interface PlegmaPoint { x: number, y: number }
export interface PlegmaBox { cx: number, cy: number, w: number, h: number }
// `path`: the way the camera goes over the world (points the framed story passes), instead of a straight line from a to b; the zoom is the same.
// `level`: the zoom does not dip, it only goes from a's to b's, and the path is walked with a softer ease (a travel along a line, not a jump).
export interface PlegmaFlight { a: PlegmaCamera, b: PlegmaCamera, t0: number, dur: number, path?: PlegmaPoint[], level?: boolean }

// The part of the screen the cards leave free, as fractions of its width and height: the top-left area. It is the default: a story view measures the free
// area it really has (PlegmaStoryView.vue, stores/plegma.ts `region`) and the camera frames that.
export interface PlegmaRegion { x0: number, y0: number, x1: number, y1: number }
export const PLEGMA_REGION: PlegmaRegion = { x0: 0.02, y0: 0.22, x1: 0.40, y1: 0.64 }
// The nearest zoom, the zoom of a story's web, and the farthest zoom of a framing.
export const PLEGMA_Z_FOCUS = 3.6
export const PLEGMA_Z_THEME = 1.6
export const PLEGMA_Z_MIN = 0.1
// Two compared stories are framed together only while the zoom stays above this; farther apart the focused story keeps its framing and the other is a marker.
export const PLEGMA_PAIR_Z = 0.35
// The flight lasts at least this long and at most that.
export const PLEGMA_FLIGHT_MIN = 800
export const PLEGMA_FLIGHT_MAX = 2200

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))
const easeInOut = (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
const easeSoft = (t: number) => (1 - Math.cos(Math.PI * t)) / 2

export const regionBox = (w: number, h: number, region: PlegmaRegion = PLEGMA_REGION): PlegmaBox => ({
  cx: (region.x0 + region.x1) / 2 * w,
  cy: (region.y0 + region.y1) / 2 * h,
  w: (region.x1 - region.x0) * w,
  h: (region.y1 - region.y0) * h
})
export const screenBox = (w: number, h: number): PlegmaBox => ({ cx: w / 2, cy: h / 2, w, h })

// The camera that shows the points inside the box of a w x h screen, as large as `maxZ` allows.
export const fitCamera = (points: PlegmaPoint[], box: PlegmaBox, w: number, h: number, maxZ = PLEGMA_Z_FOCUS, pad = 0.82): PlegmaCamera => {
  let x0 = Infinity
  let x1 = -Infinity
  let y0 = Infinity
  let y1 = -Infinity
  for (const p of points) {
    x0 = Math.min(x0, p.x)
    x1 = Math.max(x1, p.x)
    y0 = Math.min(y0, p.y)
    y1 = Math.max(y1, p.y)
  }
  const bw = Math.max(x1 - x0, 80)
  const bh = Math.max(y1 - y0, 80)
  const z = clamp(Math.min(box.w / bw, box.h / bh) * pad, PLEGMA_Z_MIN, maxZ)
  return { x: (x0 + x1) / 2 - (box.cx - w / 2) / z, y: (y0 + y1) / 2 - (box.cy - h / 2) / z, z }
}

// One story at the center of the map region, at the zoom of a web.
export const frameStory = (s: PlegmaPoint, w: number, h: number, region?: PlegmaRegion) => fitCamera([s], regionBox(w, h, region), w, h, PLEGMA_Z_FOCUS, 0.72)
// The stories of a theme (its largest ones) inside the map region.
export const frameTheme = (stories: PlegmaPoint[], w: number, h: number, region?: PlegmaRegion) => fitCamera(stories, regionBox(w, h, region), w, h, PLEGMA_Z_THEME)
// The best stories of the week across the whole screen.
export const frameHome = (stories: PlegmaPoint[], w: number, h: number) => fitCamera(stories, screenBox(w, h), w, h, 1, 0.8)
// A pair in the map region. Far apart, the zoom to hold both is too small to read, so the camera keeps the first story and `together` is false.
export const framePair = (a: PlegmaPoint, b: PlegmaPoint, w: number, h: number, region?: PlegmaRegion): { camera: PlegmaCamera, together: boolean } => {
  const both = fitCamera([a, b], regionBox(w, h, region), w, h, PLEGMA_Z_FOCUS, 0.7)
  return both.z >= PLEGMA_PAIR_Z ? { camera: both, together: true } : { camera: frameStory(a, w, h, region), together: false }
}

// A world point on the screen, and a screen point in the world.
export const toScreen = (cam: PlegmaCamera, w: number, h: number, p: PlegmaPoint): PlegmaPoint => ({ x: (p.x - cam.x) * cam.z + w / 2, y: (p.y - cam.y) * cam.z + h / 2 })
export const toWorld = (cam: PlegmaCamera, w: number, h: number, p: PlegmaPoint): PlegmaPoint => ({ x: (p.x - w / 2) / cam.z + cam.x, y: (p.y - h / 2) / cam.z + cam.y })

// The camera at time t (0 to 1) of a flight from a to b. The position moves straight; the zoom goes from one to the other on a log scale and dips in the middle.
export const poseAt = (a: PlegmaCamera, b: PlegmaCamera, t: number, w: number): PlegmaCamera => {
  const p = easeInOut(clamp(t, 0, 1))
  const dist = Math.hypot(b.x - a.x, b.y - a.y)
  const dip = clamp(0.75 * Math.log(1 + dist * Math.min(a.z, b.z) / (w * 0.5)), 0, 1.9)
  const logZ = Math.log(a.z) + (Math.log(b.z) - Math.log(a.z)) * p
  return { x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p, z: Math.exp(logZ - dip * Math.sin(Math.PI * p)) }
}

// How long a flight takes: it grows with the distance on the screen and with the change of zoom.
export const flightDuration = (a: PlegmaCamera, b: PlegmaCamera, w: number) => {
  const screen = Math.hypot(b.x - a.x, b.y - a.y) * Math.min(a.z, b.z)
  return Math.round(clamp(700 + 380 * Math.log2(1 + screen / (w * 0.5)) + 200 * Math.abs(Math.log(b.z / a.z)), PLEGMA_FLIGHT_MIN, PLEGMA_FLIGHT_MAX))
}

// A flight from `from` to `to`. With reduced motion the flight has no length: the camera cuts to the target.
export const startFlight = (from: PlegmaCamera, to: PlegmaCamera, now: number, w: number, reduced = false): PlegmaFlight =>
  ({ a: { ...from }, b: { ...to }, t0: now, dur: reduced ? 0 : flightDuration(from, to, w) })

export const flightDone = (f: PlegmaFlight, now: number) => now - f.t0 >= f.dur
export const cameraAt = (f: PlegmaFlight, now: number, w: number): PlegmaCamera =>
  f.dur <= 0 || flightDone(f, now) ? { ...f.b } : f.path ? poseOnPath(f, (now - f.t0) / f.dur, w) : poseAt(f.a, f.b, (now - f.t0) / f.dur, w)

// A flight that follows a path: the camera frames the point of the path at each moment (the point is the same place of the screen all the way, so the offset from the camera is the one at the start, over
// the zoom); the path is walked by its length, eased as a flight is, and the zoom is the zoom of the straight flight.
const poseOnPath = (f: PlegmaFlight, t: number, w: number): PlegmaCamera => {
  const path = f.path!
  const cum = [0]
  for (let i = 1; i < path.length; i++) cum.push(cum[i - 1]! + Math.hypot(path[i]!.x - path[i - 1]!.x, path[i]!.y - path[i - 1]!.y))
  const p = (f.level ? easeSoft : easeInOut)(clamp(t, 0, 1))
  const target = p * cum[cum.length - 1]!
  let k = 1
  while (k < path.length - 1 && cum[k]! < target) k++
  const seg = cum[k]! - cum[k - 1]! || 1
  const u = clamp((target - cum[k - 1]!) / seg, 0, 1)
  const at = { x: path[k - 1]!.x + (path[k]!.x - path[k - 1]!.x) * u, y: path[k - 1]!.y + (path[k]!.y - path[k - 1]!.y) * u }
  const z = f.level ? Math.exp(Math.log(f.a.z) + (Math.log(f.b.z) - Math.log(f.a.z)) * p) : poseAt(f.a, f.b, t, w).z
  const offX = (path[0]!.x - f.a.x) * f.a.z
  const offY = (path[0]!.y - f.a.y) * f.a.z
  // The end of the path and the target may differ a little (the free area was measured again): the difference is taken up over the flight.
  const endX = path[path.length - 1]!.x - offX / f.b.z
  const endY = path[path.length - 1]!.y - offY / f.b.z
  return { x: at.x - offX / z + (f.b.x - endX) * p, y: at.y - offY / z + (f.b.y - endY) * p, z }
}

// The same flight along a path; a longer way takes longer (as much as the path is longer than the straight line, at most twice and a half more).
export const flightAlong = (f: PlegmaFlight, path: PlegmaPoint[]): PlegmaFlight => {
  let length = 0
  for (let i = 1; i < path.length; i++) length += Math.hypot(path[i]!.x - path[i - 1]!.x, path[i]!.y - path[i - 1]!.y)
  const straight = Math.hypot(path[path.length - 1]!.x - path[0]!.x, path[path.length - 1]!.y - path[0]!.y) || 1
  return { ...f, path, dur: f.dur <= 0 ? 0 : Math.round(Math.min(3200, f.dur * clamp(length / straight, 1, 2.5))) }
}

// A travel along a line: the camera follows the path at the zoom it has (no pull back), however far it goes; a longer way takes longer, gently.
export const travelAlong = (f: PlegmaFlight, path: PlegmaPoint[], w: number): PlegmaFlight => {
  let length = 0
  for (let i = 1; i < path.length; i++) length += Math.hypot(path[i]!.x - path[i - 1]!.x, path[i]!.y - path[i - 1]!.y)
  const screen = length * Math.min(f.a.z, f.b.z)
  return { ...f, path, level: true, dur: f.dur <= 0 ? 0 : Math.round(clamp(900 + 480 * Math.log2(1 + screen / w), 1000, 2600)) }
}

// A new flight asked while one runs starts from where the camera is, not from where the old one began. A travel along a line keeps its way and only its end moves.
export const redirectFlight = (current: PlegmaFlight | null, camera: PlegmaCamera, to: PlegmaCamera, now: number, w: number, reduced = false): PlegmaFlight =>
  current?.level && !flightDone(current, now) && !reduced
    ? { ...current, b: { ...to } }
    : startFlight(current && !flightDone(current, now) ? cameraAt(current, now, w) : camera, to, now, w, reduced)
