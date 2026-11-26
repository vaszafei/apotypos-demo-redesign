import { useEventListener } from '@vueuse/core'

// The map region of a Plegma page: a square in the middle of the free cell of the left column, under the title (the web of a story or of a theme sits there, and the
// camera frames it). The web keeps some room from the title above it and from the cards on its right. Both pages use it, so their webs have the same size.
const REGION_SIDE = 380
const REGION_GAP_TOP = 44
const REGION_GAP_RIGHT = 44

// The ring of a story's web has a vertical radius of about this share of the side of its region, plus a few pixels for the nodes that drift and the dots on it; it is `aspect` times wider.
const RING_PER_SIDE = 0.492
const RING_EXTRA = 14
const SIDE_MIN = 180
// The room a filled region keeps from the edges of its cell and from the note under it.
const FILL_GAP = 6
const BLOCKS = '.plegma-card, .plegma-title .ecard, .orbit-ring-tabs, .plegma-nodes-note'
// The Plegma has no card over it: the biggest region (up to `maxSide` high, `aspect` times as wide) in the cell and the free space above it whose ring (an ellipse) touches no card, no switch of the
// ring, no title and no note, as near as it can be to `want`. Returns its center and its height, or null when nothing of at least SIDE_MIN fits.
const clearEllipse = (orbit: HTMLElement, stage: DOMRect, cell: DOMRect, maxSide: number, aspect: number, perSide: number, want: { x: number, y: number }) => {
  const blocks = [...orbit.querySelectorAll(BLOCKS)].map((el) => {
    const r = el.getBoundingClientRect()
    return { x0: r.left, y0: r.top - stage.top, x1: r.right, y1: r.bottom - stage.top }
  }).filter(b => b.x1 > b.x0 && b.y1 > b.y0)
  const left = cell.left
  const right = cell.right
  const top = 44
  const bottom = cell.bottom - stage.top
  // The ellipse touches a box when the point of the box nearest to its center, in units of its two radii, is inside it.
  const touches = (cx: number, cy: number, rx: number, ry: number) => blocks.some((b) => {
    const dx = (cx - Math.min(Math.max(cx, b.x0), b.x1)) / rx
    const dy = (cy - Math.min(Math.max(cy, b.y0), b.y1)) / ry
    return dx * dx + dy * dy < 1
  })
  for (let side = maxSide; side >= SIDE_MIN; side -= 8) {
    const ry = side * perSide + RING_EXTRA
    const rx = side * aspect * perSide + RING_EXTRA
    let best: { x: number, y: number } | null = null
    let bestD = Infinity
    for (let cx = left + rx; cx <= right; cx += 8) {
      for (let cy = top + ry; cy <= bottom; cy += 8) {
        const d = (cx - want.x) ** 2 + (cy - want.y) ** 2
        if (d < bestD && !touches(cx, cy, rx, ry)) { bestD = d; best = { x: cx, y: cy } }
      }
    }
    if (best) return { cx: best.x, cy: best.y, side }
  }
  return null
}

// `fill`: while it is true the region is the whole cell, above the note under it (Κλαδιά of a story, utils/plegma/plegma-branches.ts), not a square.
export const usePlegmaRegion = (orbit: Ref<HTMLElement | undefined>, map: Ref<HTMLElement | undefined>, room: { side?: number, top?: number, bottom?: number, lean?: number, names?: boolean, clear?: boolean, aspect?: number, ringPerSide?: number, fill?: () => boolean } = {}) => {
  const aspect = room.aspect ?? 1
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
    if (room.fill?.()) {
      const note = cell.querySelector('.plegma-nodes-note')?.getBoundingClientRect()
      const y0 = box.top - stage.top + FILL_GAP
      const y1 = (note && note.height ? note.top : box.bottom) - stage.top - FILL_GAP
      const x0 = box.left + FILL_GAP
      const x1 = box.right - FILL_GAP
      plegma.setRegion({ x0: x0 / stage.width, y0: y0 / stage.height, x1: x1 / stage.width, y1: y1 / stage.height })
      setNames(o, stage, box)
      return
    }
    const w = box.width - REGION_GAP_RIGHT
    const h = box.height - gapTop - gapBottom
    let side = Math.min(w, h, maxSide)
    let cx = box.left + (w - side) * lean + side / 2
    let cy = box.top - stage.top + gapTop + (h - side) / 2 + side / 2
    if (room.clear) {
      // A card that grows or shrinks (its data arrives) moves the free space: watch each one (observing an element already watched does nothing).
      o.querySelectorAll(BLOCKS).forEach(el => watcher?.observe(el))
      const fit = clearEllipse(o, stage, box, maxSide, aspect, room.ringPerSide ?? RING_PER_SIDE, { x: cx, y: cy })
      if (fit) { cx = fit.cx; cy = fit.cy; side = fit.side }
    }
    const half = (side * aspect) / 2
    plegma.setRegion({ x0: (cx - half) / stage.width, y0: (cy - side / 2) / stage.height, x1: (cx + half) / stage.width, y1: (cy + side / 2) / stage.height })
    setNames(o, stage, box)
  }
  const setNames = (o: HTMLElement, stage: DOMRect, box: DOMRect) => {
    if (room.names) {
      // The room for the names of the ring: the cell, a little above it (beside the title), but not over the cards or the switch of the ring that lie in it.
      const frac = (r: { left: number, top: number, right: number, bottom: number }) => ({ x0: (r.left - 4) / stage.width, y0: (r.top - stage.top - 4) / stage.height, x1: (r.right + 4) / stage.width, y1: (r.bottom - stage.top + 4) / stage.height })
      const avoid = [...o.querySelectorAll('.orbit-ring-tabs, .plegma-title .ecard, .plegma-nodes-note')].map(el => frac(el.getBoundingClientRect()))
      plegma.setLabelRoom({ room: { x0: box.left / stage.width, y0: (box.top - stage.top - 48) / stage.height, x1: box.right / stage.width, y1: (box.bottom - stage.top - 24) / stage.height }, avoid })
    }
  }
  let watcher: ResizeObserver | null = null
  if (room.fill) watch(room.fill, () => nextTick(measure))
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
