import { defineStore } from 'pinia'

export interface TipRow { label: string, value: string, color?: string }
export interface Tip { title: string, rows?: TipRow[], note?: string | null }

export const useTooltipStore = defineStore('tooltip', () => {
  const tip = ref<Tip | null>(null)
  const x = ref(0)
  const y = ref(0)
  const show = (t: Tip, e: PointerEvent) => { tip.value = t; x.value = e.clientX; y.value = e.clientY }
  const hide = () => { tip.value = null }
  return { tip, x, y, show, hide }
})
