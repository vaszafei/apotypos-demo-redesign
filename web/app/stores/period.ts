import { defineStore } from 'pinia'

// The chosen period of the pages. The date picker of the top bar sets it; the charts read it.
export const usePeriodStore = defineStore('period', () => {
  const from = ref<string | null>(null)
  const to = ref<string | null>(null)
  const set = (a: string, b: string) => { if (a <= b) { from.value = a; to.value = b } }
  const reset = () => { from.value = null; to.value = null }
  return { from, to, set, reset }
})
