import { useEventListener } from '@vueuse/core'

// The map region of a Plegma page: a square in the middle of the free cell of the left column, under the title (the web of a story or of a theme sits there, and the
// camera frames it). The web keeps some room from the title above it and from the cards on its right. Both pages use it, so their webs have the same size.
const REGION_SIDE = 380
const REGION_GAP_TOP = 44
const REGION_GAP_RIGHT = 44

export const usePlegmaRegion = (orbit: Ref<HTMLElement | undefined>, map: Ref<HTMLElement | undefined>) => {
  const plegma = usePlegmaStore()
  const measure = () => {
    const o = orbit.value
    const cell = map.value
    if (!o || !cell || !window.matchMedia('(min-width: 1024px)').matches) { plegma.setRegion(null); return }
    const stage = o.getBoundingClientRect()
    const box = cell.getBoundingClientRect()
    if (!stage.width || !stage.height || box.height < 40) return
    const w = box.width - REGION_GAP_RIGHT
    const h = box.height - REGION_GAP_TOP
    const side = Math.min(w, h, REGION_SIDE)
    const x = box.left + (w - side) / 2
    const y = box.top - stage.top + REGION_GAP_TOP + (h - side) / 2
    plegma.setRegion({ x0: x / stage.width, y0: y / stage.height, x1: (x + side) / stage.width, y1: (y + side) / stage.height })
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
  onBeforeUnmount(() => watcher?.disconnect())
}
