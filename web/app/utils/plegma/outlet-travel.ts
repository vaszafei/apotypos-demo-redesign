// The move from an outlet to another outlet of its group, along the line that joins its web to the row of the other (components/outlet/OutletPeerLinks.vue): as if a camera went along that line.
// The web left (a picture of its last frame) and the lit line slide back along it and fade; the web of the other outlet comes in from the row end of the line and settles at the center, on the same clock.
// The outlet page in view offers the line (`offerOutletTravel`); the leave (plugins/plegma-leave.client.ts) starts the move before the route changes; the next outlet page takes its part (`arriveOutletTravel`).
export interface TravelPoint { x: number, y: number }
// The line in the coordinates of the window: from the center of the web (c), bent toward q, to the row (e); the web's canvas; the color of the group.
export interface PeerTravel { c: TravelPoint, q: TravelPoint, e: TravelPoint, canvas: HTMLCanvasElement, color: string }

export const OUTLET_TRAVEL_MS = 1000
const EASE = 'cubic-bezier(0.65, 0, 0.35, 1)'
const STEPS = 24

let offer: ((slug: string) => PeerTravel | null) | null = null
let pending: { slug: string, line: PeerTravel, start: number } | null = null

const along = (l: PeerTravel, t: number) => {
  const u = 1 - t
  return { x: u * u * l.c.x + 2 * u * t * l.q.x + t * t * l.e.x, y: u * u * l.c.y + 2 * u * t * l.q.y + t * t * l.e.y }
}
// The camera at t of the move is at the point of the line at t: what is in the world moves the other way.
const shifts = (l: PeerTravel, from: TravelPoint) => Array.from({ length: STEPS + 1 }, (_, i) => {
  const p = along(l, i / STEPS)
  return { transform: `translate(${(from.x - p.x).toFixed(1)}px, ${(from.y - p.y).toFixed(1)}px)`, offset: i / STEPS }
})

export const offerOutletTravel = (fn: (slug: string) => PeerTravel | null) => { offer = fn }
// A page that goes takes back its offer, unless the next page has made its own.
export const withdrawOutletTravel = (fn: (slug: string) => PeerTravel | null) => { if (offer === fn) offer = null }

// Starts the move to the outlet `slug`, when the page in view has a line to it; false when it has none (the page then leaves as it does for any other page).
export const startOutletTravel = (slug: string): boolean => {
  const line = offer?.(slug)
  if (!line) return false
  const start = document.timeline.currentTime as number
  pending = { slug, line, start }
  const box = line.canvas.getBoundingClientRect()
  const picture = document.createElement('canvas')
  picture.width = line.canvas.width
  picture.height = line.canvas.height
  picture.getContext('2d')?.drawImage(line.canvas, 0, 0)
  Object.assign(picture.style, { position: 'fixed', left: `${box.left}px`, top: `${box.top}px`, width: `${box.width}px`, height: `${box.height}px`, zIndex: '1', pointerEvents: 'none' })
  const ns = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(ns, 'svg')
  Object.assign(svg.style, { position: 'fixed', inset: '0', width: '100vw', height: '100vh', zIndex: '1', pointerEvents: 'none', overflow: 'visible' })
  const path = document.createElementNS(ns, 'path')
  path.setAttribute('d', `M ${line.c.x} ${line.c.y} Q ${line.q.x} ${line.q.y} ${line.e.x} ${line.e.y}`)
  path.setAttribute('fill', 'none')
  path.setAttribute('stroke', line.color)
  path.setAttribute('stroke-width', '2')
  const end = document.createElementNS(ns, 'circle')
  end.setAttribute('cx', String(line.e.x))
  end.setAttribute('cy', String(line.e.y))
  end.setAttribute('r', '4')
  end.setAttribute('fill', line.color)
  svg.append(path, end)
  document.body.append(picture, svg)
  line.canvas.style.visibility = 'hidden'
  const move = shifts(line, line.c)
  // Both parts of the move keep the clock of the click: the new page may take a while to mount, and a frame that comes late must not hold one part back.
  const go = (el: Element, fade: Keyframe[]) => {
    const m = el.animate(move, { duration: OUTLET_TRAVEL_MS, easing: EASE, fill: 'forwards' })
    const a = el.animate(fade, { duration: OUTLET_TRAVEL_MS, fill: 'forwards' })
    m.startTime = start
    a.startTime = start
    a.finished.then(() => el.remove(), () => el.remove())
  }
  go(picture, [{ opacity: 1 }, { opacity: 0, offset: 0.7 }, { opacity: 0 }])
  go(svg, [{ opacity: 1 }, { opacity: 1, offset: 0.75 }, { opacity: 0 }])
  return true
}

// The web of the outlet the move goes to: it comes in from the row end of the line and settles at the center, at the time of the move (it may mount a little after the move began).
export const arriveOutletTravel = (slug: string, el: HTMLElement | undefined) => {
  const p = pending
  pending = null
  if (!p || p.slug !== slug || !el) return
  const a = el.animate(shifts(p.line, p.line.e), { duration: OUTLET_TRAVEL_MS, easing: EASE, fill: 'backwards' })
  a.startTime = p.start
}
