import { useEventListener } from '@vueuse/core'

// The map region of a Plegma page: a square in the middle of the free cell of the left column, under the title (the web of a story or of a theme sits there, and the
// camera frames it). The web keeps some room from the title above it and from the cards on its right. Both pages use it, so their webs have the same size.
const REGION_SIDE = 380
const REGION_GAP_TOP = 44
const REGION_GAP_RIGHT = 44

// The ring of a story's web has a radius of about this share of the side of its square, plus a few pixels for the nodes that drift and the dots on it.
const RING_PER_SIDE = 0.492
const RING_EXTRA = 14
const SIDE_MIN = 180
const BLOCKS = '.plegma-card, .plegma-title .ecard, .orbit-ring-tabs, .plegma-nodes-note'
// The Plegma has no card over it: the biggest square (up to `maxSide`) in the cell and the free space above it whose ring touches no card, no switch of the ring, no title and no note, as near as it can be
// to `want`, the place it would have by its own. Returns the top left corner and the side, or null when nothing of at least SIDE_MIN fits.
const clearSquare = (orbit: HTMLElement, stage: DOMRect, cell: DOMRect, maxSide: number, want: { x: number, y: number }) => {
  const blocks = [...orbit.querySelectorAll(BLOCKS)].map((el) => {
    const r = el.getBoundingClientRect()
    return { x0: r.left, y0: r.top - stage.top, x1: r.right, y1: r.bottom - stage.top }
  }).filter(b => b.x1 > b.x0 && b.y1 > b.y0)
  const left = cell.left
  const right = cell.right
  const top = 44
  const bottom = cell.bottom - stage.top
  const touches = (cx: number, cy: number, rad: number) => blocks.some((b) => {
    const dx = cx - Math.min(Math.max(cx, b.x0), b.x1)
    const dy = cy - Math.min(Math.max(cy, b.y0), b.y1)
    return dx * dx + dy * dy < rad * rad
  })
  for (let side = maxSide; side >= SIDE_MIN; side -= 8) {
    const rad = side * RING_PER_SIDE + RING_EXTRA
    let best: { x: number, y: number } | null = null
    let bestD = Infinity
    for (let cx = left + rad; cx <= right; cx += 8) {
      for (let cy = top + rad; cy <= bottom; cy += 8) {
        const d = (cx - want.x) ** 2 + (cy - want.y) ** 2
        if (d < bestD && !touches(cx, cy, rad)) { bestD = d; best = { x: cx, y: cy } }
      }
    }
    if (best) return { x: best.x - side / 2, y: best.y - side / 2, side }
  }
  return null
}

export const usePlegmaRegion = (orbit: Ref<HTMLElement | undefined>, map: Ref<HTMLElement | undefined>, room: { side?: number, top?: number, bottom?: number, lean?: number, names?: boolean, clear?: boolean } = {}) => {
  const maxSide = room.side ?? REGION_SIDE
  const gapTop = room.top ?? REGION_GAP_TOP
  const gapBottom = room.bottom ?? 0
  const lean = room.lean ?? 0.5
  const plegma = usePlegmaStore()
  const measure = () => {
    const o = orbit.value
    const cell = map.value
    if (!o || !cell || !window.matchMedia('(min-width: 1024px)').matches) { plegma.setRegion(null); return }
    const stage = o.getBoundingClientRect()
    const box = cell.getBoundingClientRect()
    if (!stage.width || !stage.height || box.height < 40) return
    const w = box.width - REGION_GAP_RIGHT
    const h = box.height - gapTop - gapBottom
    let side = Math.min(w, h, maxSide)
    let x = box.left + (w - side) * lean
    let y = box.top - stage.top + gapTop + (h - side) / 2
    if (room.clear) {
      // A card that grows or shrinks (its data arrives) moves the free space: watch each one (observing an element already watched does nothing).
      o.querySelectorAll(BLOCKS).forEach(el => watcher?.observe(el))
      const fit = clearSquare(o, stage, box, maxSide, { x: x + side / 2, y: y + side / 2 })
      if (fit) { x = fit.x; y = fit.y; side = fit.side }
    }
    plegma.setRegion({ x0: x / stage.width, y0: y / stage.height, x1: (x + side) / stage.width, y1: (y + side) / stage.height })
    if (room.names) {
      // The room for the names of the ring: the cell, a little above it (beside the title), but not over the cards or the switch of the ring that lie in it.
      const frac = (r: { left: number, top: number, right: number, bottom: number }) => ({ x0: (r.left - 4) / stage.width, y0: (r.top - stage.top - 4) / stage.height, x1: (r.right + 4) / stage.width, y1: (r.bottom - stage.top + 4) / stage.height })
      const avoid = [...o.querySelectorAll('.orbit-ring-tabs, .plegma-title .ecard')].map(el => frac(el.getBoundingClientRect()))
      plegma.setLabelRoom({ room: { x0: box.left / stage.width, y0: (box.top - stage.top - 48) / stage.height, x1: box.right / stage.width, y1: (box.bottom - stage.top - 24) / stage.height }, avoid })
    }
  }
  let watcher: ResizeObserver | null = null
  watch(map, (el) => {
    watcher?.disconnect()
    if (!el) return
    watcher = new ResizeObserver(measure)
    watcher.observe(el)
    measure()
  }, { flush: 'post' })
  useEventListener(window, 'resize', measure)
  onBeforeUnmount(() => { watcher?.disconnect(); if (room.names) plegma.setLabelRoom(null) })
}
