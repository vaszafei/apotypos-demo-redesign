import { defineStore } from 'pinia'

export interface TipRow { label: string, value: string, color?: string }
// `action`: a button at the end of the tooltip (an icon with its label for a screen reader), which can be reached while the tooltip is pinned or held.
export interface TipAction { label: string, icon: string, run: () => void }
export interface Tip { title: string, rows?: TipRow[], note?: string | null, field?: boolean, action?: TipAction }
// `TipAnchor`: a point of the window (a node of the map, of radius r) the tooltip stands beside, on its right (its left when the window has no room), instead of above the pointer.
// An anchored tooltip is held: the pointer can go from the node into it, and it stays while the pointer is on it.
export interface TipAnchor { x: number, y: number, r: number }

// A pinned tooltip (a click on what it tells about) stays where it is until it is let go: the pointer moving elsewhere does not show or hide another.
export const useTooltipStore = defineStore('tooltip', () => {
  const tip = ref<Tip | null>(null)
  const x = ref(0)
  const y = ref(0)
  const at = ref<TipAnchor | null>(null)
  const pinned = ref(false)
  // The pointer is on a held tooltip: nothing under it hides it.
  const over = ref(false)
  let timer: ReturnType<typeof setTimeout> | undefined
  const set = (t: Tip, e: PointerEvent | MouseEvent, anchor?: TipAnchor) => { clearTimeout(timer); tip.value = t; x.value = e.clientX; y.value = e.clientY; at.value = anchor ?? null }
  const show = (t: Tip, e: PointerEvent, anchor?: TipAnchor) => { if (pinned.value || over.value) return; set(t, e, anchor) }
  // A held tooltip waits a moment before it goes, so the pointer can cross the gap from its node to it.
  const hide = () => {
    if (pinned.value || over.value || !tip.value) return
    if (!at.value) { tip.value = null; return }
    clearTimeout(timer)
    timer = setTimeout(() => { if (!pinned.value && !over.value) tip.value = null }, 220)
  }
  const pin = (t: Tip, e: MouseEvent, anchor?: TipAnchor) => { set(t, e, anchor); pinned.value = true }
  const unpin = () => { if (!pinned.value) return; pinned.value = false; tip.value = null }
  const enter = () => { if (at.value) { over.value = true; clearTimeout(timer) } }
  const leave = () => { if (!over.value) return; over.value = false; if (!pinned.value) tip.value = null }
  const close = () => { clearTimeout(timer); pinned.value = false; over.value = false; tip.value = null }
  return { tip, x, y, at, pinned, over, show, hide, pin, unpin, enter, leave, close }
})
