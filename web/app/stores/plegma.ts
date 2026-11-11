import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { PlegmaRegion } from '../utils/plegma-camera.ts'
import type { PlegmaArticle } from '../utils/plegma-articles.ts'
import { plegmaFocusOf, samePlegmaFocus } from '../utils/plegma-route.ts'
import type { PlegmaFocus } from '../utils/plegma-route.ts'

// `hero`: the page has the large search of Αρχική, so the search of the top bar waits.
declare module '#app' { interface PageMeta { plegma?: boolean, hero?: boolean } }

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
  // The camera has arrived at the focus (no flight under way): the cards of a view arrive after it lands. A new focus clears it until the stage says it landed.
  const landed = ref(true)
  // The free area of the screen the view of a story leaves for the map (fractions of the stage), measured by the view; null until it is: the camera uses its default.
  const region = ref<PlegmaRegion | null>(null)
  // The articles of the focused story (day, outlet, group), first day first, which the story view reads from its detail; null until it has them. The stage draws one node for each.
  const articles = ref<PlegmaArticle[] | null>(null)

  const syncRoute = (route: { path: string, query: Record<string, unknown>, meta: { plegma?: boolean } }) => {
    active.value = route.meta.plegma === true
    if (!active.value) return
    const next = plegmaFocusOf(route.path, route.query)
    if (!samePlegmaFocus(next, focus.value)) {
      focus.value = next
      landed.value = false
      day.value = null
      compare.value = null
      articles.value = null
    }
  }
  const stepTo = (index: number | null) => { day.value = index }
  const compareWith = (id: number | null) => { compare.value = id }
  const setRegion = (value: PlegmaRegion | null) => { region.value = value }
  const setLanded = (value: boolean) => { landed.value = value }
  const setArticles = (value: PlegmaArticle[] | null) => { articles.value = value }

  return { active, focus, day, compare, landed, region, articles, syncRoute, stepTo, compareWith, setLanded, setRegion, setArticles }
})
