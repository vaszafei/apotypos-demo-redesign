// The dive from the web of a day (Home, Ιστορίες) into the page of a story or a theme (composables/useWebDive.ts): the page's own dive, the same as the one from a theme. The canvas of the web is copied into
// a layer over the page (under the top bar) with a hole where the picked dot is; the copy fades where it is, with no zoom, and a plain dot stays in the hole. The dot's place goes to the store
// (`plegma.diveFrom`), the page changes, and the stage takes the dot over once the page has its free area (stage-draw.ts): it glides to the middle of that area, melts, and the web of the page grows from it.
// The layer is removed when the stage has taken the dot (or after a wait, if it never does).
const SWELL_MS = 320
const FADE_MS = 700
const TAKEN_WAIT_MS = 4000
const BAR = 64

export interface DiveSpot { x: number, y: number, r: number, fill: string | null }
export interface DiveDeps { go: () => Promise<unknown> | unknown, reduced: boolean, key: string, give: (from: { key: string, x: number, y: number, r: number, fill: string | null } | null) => void, taken: () => boolean }

// `at` is the node in px of the canvas. Resolves when the dive is over (the page has changed meanwhile).
export const diveFromDay = async (source: HTMLCanvasElement, at: DiveSpot, deps: DiveDeps) => {
  if (deps.reduced) { await deps.go(); return }
  const rect = source.getBoundingClientRect()
  const layer = document.createElement('div')
  Object.assign(layer.style, { position: 'fixed', inset: `${BAR}px 0 0 0`, overflow: 'hidden', pointerEvents: 'none', zIndex: '2' })
  const copy = document.createElement('canvas')
  copy.width = source.width
  copy.height = source.height
  const g = copy.getContext('2d')
  g?.drawImage(source, 0, 0)
  if (g) {
    const dpr = source.width / Math.max(1, rect.width)
    g.globalCompositeOperation = 'destination-out'
    g.beginPath()
    g.arc(at.x * dpr, at.y * dpr, (at.r + 4) * dpr, 0, Math.PI * 2)
    g.fill()
  }
  const x = rect.left
  const y = rect.top - BAR
  Object.assign(copy.style, { position: 'absolute', left: `${x}px`, top: `${y}px`, width: `${rect.width}px`, height: `${rect.height}px`, willChange: 'opacity' })
  const dot = document.createElement('div')
  const paper = getComputedStyle(document.documentElement).getPropertyValue('--surface-page').trim() || '#f6f4ef'
  const mute = getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim() || '#6b6f78'
  Object.assign(dot.style, {
    position: 'absolute', left: `${x + at.x - at.r}px`, top: `${y + at.y - at.r}px`, width: `${at.r * 2}px`, height: `${at.r * 2}px`, borderRadius: '50%', boxSizing: 'border-box',
    background: at.fill ?? paper, border: at.fill ? 'none' : `2px solid ${mute}`, boxShadow: `0 0 0 1.6px ${paper}`
  })
  layer.append(copy, dot)
  document.body.append(layer)
  source.style.visibility = 'hidden'
  deps.give({ key: deps.key, x: x + at.x, y: y + at.y, r: at.r, fill: at.fill })
  copy.animate([{ opacity: 1 }, { opacity: 0 }], { duration: FADE_MS, easing: 'cubic-bezier(0.4, 0, 0.6, 1)', fill: 'forwards' })
  await new Promise(done => setTimeout(done, SWELL_MS))
  await deps.go()
  const waited = performance.now()
  while (!deps.taken() && performance.now() - waited < TAKEN_WAIT_MS) await new Promise(done => requestAnimationFrame(done))
  if (!deps.taken()) deps.give(null)
  // The stage draws the dot from its next frame on; the one of the layer stays two frames, so there is no frame without a dot.
  await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)))
  layer.remove()
}
