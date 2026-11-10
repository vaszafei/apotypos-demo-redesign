import { defineStore } from 'pinia'
import { ref } from 'vue'
import { plegmaFocusOf, samePlegmaFocus } from '../utils/plegma-route.ts'
import type { PlegmaFocus } from '../utils/plegma-route.ts'

declare module '#app' { interface PageMeta { plegma?: boolean } }

// The Plegma behind the pages: whether the current route shows it, and what it is focused on. The route is the source of truth (KTD2): `syncRoute` is
// the only way focus changes. The day being stepped and the story being compared live here too and end when the focused story changes.
export const usePlegmaStore = defineStore('plegma', () => {
  // The route has the plegma page meta: the stage is shown. Any other route hides it and halts its loop; the camera and the focus are kept.
  const active = ref(false)
  const focus = ref<PlegmaFocus>(null)
  // The day of the focused story that is stepped to (an index of the dates), or null for the whole range.
  const day = ref<number | null>(null)
  // A second story picked for comparison.
  const compare = ref<number | null>(null)

  const syncRoute = (route: { path: string, query: Record<string, unknown>, meta: { plegma?: boolean } }) => {
    active.value = route.meta.plegma === true
    if (!active.value) return
    const next = plegmaFocusOf(route.path, route.query)
    if (!samePlegmaFocus(next, focus.value)) {
      focus.value = next
      day.value = null
      compare.value = null
    }
  }
  const stepTo = (index: number | null) => { day.value = index }
  const compareWith = (id: number | null) => { compare.value = id }

  return { active, focus, day, compare, syncRoute, stepTo, compareWith }
})
