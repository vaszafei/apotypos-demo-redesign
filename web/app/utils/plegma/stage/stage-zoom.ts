import type { Ref } from 'vue'
import { isZoomed, zoomDown, zoomHome, zoomMove, zoomUp, zoomWheel } from '../plegma-zoom'
import type { StageState } from './stage-state'
import type { StageCore, StageDeps } from './stage-core'
import type { StageArticles } from './stage-articles'
import { CAPTURES } from './stage-pointer'

// The input of the zoom of the story web (#222, utils/plegma/plegma-zoom.ts): on a story page with Κλαδιά, from 1280 px wide and with a mouse or a trackpad,
// the wheel or a pinch over the map zooms; zoomed, a drag pans and a double-click goes back to the whole web. Over a card or a control the page keeps the pointer.
export const ZOOM_MIN_WIDTH = 1280
export interface ZoomDeps extends StageDeps {
  pointerFine: Ref<boolean>
  canvas: Ref<HTMLCanvasElement | undefined>
  kick: () => void
}

export const createStageZoom = (st: StageState, deps: ZoomDeps, core: StageCore, articles: StageArticles) => {
  const { plegma, pointerFine, canvas, kick } = deps
  // The point of the event in px of the framing from the middle of the web, or null when the zoom does not take it.
  const viewAt = (e: MouseEvent) => {
    if (!plegma.active || !plegma.landed || plegma.leaving || !pointerFine.value || window.innerWidth < ZOOM_MIN_WIDTH) return null
    if ((e.target as Element | null)?.closest?.(CAPTURES)) return null
    const story = core.focusStory()
    if (!story || !articles.isBranch(story)) return null
    const frame = articles.zoomFrame(story)
    const box = canvas.value?.getBoundingClientRect()
    if (!frame || !box) return null
    return { x: (e.clientX - box.left - frame.cx) / frame.k, y: (e.clientY - box.top - frame.cy) / frame.k }
  }
  const onWheel = (e: WheelEvent) => {
    const at = viewAt(e)
    if (!at) return
    e.preventDefault()
    zoomWheel(st.zoom, { dy: e.deltaY * (e.deltaMode === 1 ? 32 : 1), ctrl: e.ctrlKey, at }, performance.now())
    kick()
  }
  // A drag that moved is not a click: the click that ends it opens nothing (stage-pointer.ts reads defaultPrevented).
  let dragged = false
  const onDown = (e: PointerEvent) => {
    if (e.button !== 0 || !isZoomed(st.zoom)) return
    const at = viewAt(e)
    if (!at) return
    // The page under the map does not select its text while the web is dragged or double-clicked.
    e.preventDefault()
    dragged = false
    zoomDown(st.zoom, at, performance.now())
    kick()
  }
  const onMove = (e: PointerEvent) => {
    if (!st.zoom.drag) return
    const frame = core.focusStory() && articles.zoomFrame(core.focusStory()!)
    const box = canvas.value?.getBoundingClientRect()
    if (!frame || !box) return
    zoomMove(st.zoom, { x: (e.clientX - box.left - frame.cx) / frame.k, y: (e.clientY - box.top - frame.cy) / frame.k }, performance.now())
    document.documentElement.style.cursor = 'grabbing'
    kick()
  }
  const onUp = () => {
    if (!st.zoom.drag) return
    dragged = zoomUp(st.zoom, performance.now()) > 4
    document.documentElement.style.cursor = ''
    kick()
  }
  const onClickCapture = (e: MouseEvent) => {
    if (!dragged) return
    dragged = false
    e.preventDefault()
  }
  const onDouble = (e: MouseEvent) => {
    if (!isZoomed(st.zoom)) return
    const at = viewAt(e)
    if (!at) return
    zoomHome(st.zoom, at, performance.now())
    kick()
  }
  return { onWheel, onDown, onMove, onUp, onClickCapture, onDouble }
}
