import { defineStore } from 'pinia'

export interface TipRow { label: string, value: string, color?: string }
// `action`: a button at the end of the tooltip (an icon with its label for a screen reader), which can be reached only while the tooltip is pinned.
export interface TipAction { label: string, icon: string, run: () => void }
export interface Tip { title: string, rows?: TipRow[], note?: string | null, field?: boolean, action?: TipAction }

// A pinned tooltip (a click on what it tells about) stays where it is until it is let go: the pointer moving elsewhere does not show or hide another.
export const useTooltipStore = defineStore('tooltip', () => {
  const tip = ref<Tip | null>(null)
  const x = ref(0)
  const y = ref(0)
  const pinned = ref(false)
  const show = (t: Tip, e: PointerEvent) => { if (pinned.value) return; tip.value = t; x.value = e.clientX; y.value = e.clientY }
  const hide = () => { if (!pinned.value) tip.value = null }
  const pin = (t: Tip, e: MouseEvent) => { tip.value = t; x.value = e.clientX; y.value = e.clientY; pinned.value = true }
  const unpin = () => { if (!pinned.value) return; pinned.value = false; tip.value = null }
  return { tip, x, y, pinned, show, hide, pin, unpin }
})
