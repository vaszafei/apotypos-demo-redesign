import { regionBox } from './plegma-camera'
import type { PlegmaRegion } from './plegma-camera'

// The dive from the web of a day on Home into the page of a story or a theme (components/home/HomeToday.vue): the canvas of the web is copied into a layer over the page (under the top bar),
// which swells a little while the rest of the section fades (the caller's job); then the page changes, and when the page of the story or the theme has measured its free area (plegma.region) the copy dives into the node
// that was picked, which comes to the middle of that area and grows, and fades out as the web of the page grows under it. The Plegma behind flies to the same place meanwhile.
const SWELL_MS = 320
const DIVE_MS = 1400
const DIVE_SCALE = 3.4
const REGION_WAIT_MS = 1500
const BAR = 64

export interface DiveDeps { go: () => Promise<unknown> | unknown, region: () => PlegmaRegion | null, reduced: boolean }

// `at` is the node in px of the canvas. Resolves when the dive is over (the page has changed meanwhile).
export const diveFromDay = async (source: HTMLCanvasElement, at: { x: number, y: number }, deps: DiveDeps) => {
  if (deps.reduced) { await deps.go(); return }
  const rect = source.getBoundingClientRect()
  const layer = document.createElement('div')
  Object.assign(layer.style, { position: 'fixed', inset: `${BAR}px 0 0 0`, overflow: 'hidden', pointerEvents: 'none', zIndex: '2' })
  const copy = document.createElement('canvas')
  copy.width = source.width
  copy.height = source.height
  copy.getContext('2d')?.drawImage(source, 0, 0)
  const x = rect.left
  const y = rect.top - BAR
  Object.assign(copy.style, { position: 'absolute', left: `${x}px`, top: `${y}px`, width: `${rect.width}px`, height: `${rect.height}px`, transformOrigin: `${at.x}px ${at.y}px`, willChange: 'transform, opacity' })
  layer.append(copy)
  document.body.append(layer)
  source.style.visibility = 'hidden'
  const swell = copy.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.12)' }], { duration: SWELL_MS, easing: 'cubic-bezier(0.4, 0, 0.6, 1)', fill: 'forwards' })
  await swell.finished.catch(() => undefined)
  await deps.go()
  // The page measures its free area a little after it is up.
  const waited = performance.now()
  while (!deps.region() && performance.now() - waited < REGION_WAIT_MS) await new Promise(done => requestAnimationFrame(done))
  const stage = { w: window.innerWidth, h: window.innerHeight - BAR }
  const region = deps.region()
  const rb = region ? regionBox(stage.w, stage.h, region) : { cx: stage.w / 2, cy: stage.h / 2 }
  const dx = rb.cx - (x + at.x)
  const dy = rb.cy - (y + at.y)
  const dive = copy.animate([
    { transform: 'translate(0, 0) scale(1.12)', opacity: 1 },
    { transform: `translate(${dx * 0.7}px, ${dy * 0.7}px) scale(${1.12 + (DIVE_SCALE - 1.12) * 0.6})`, opacity: 0.7, offset: 0.6 },
    { transform: `translate(${dx}px, ${dy}px) scale(${DIVE_SCALE})`, opacity: 0, offset: 1 }
  ], { duration: DIVE_MS, easing: 'cubic-bezier(0.55, 0, 0.25, 1)', fill: 'forwards' })
  await dive.finished.catch(() => undefined)
  layer.remove()
}
