import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { PlegmaRegion } from '../utils/plegma-camera.ts'
import type { PlegmaArticle, PlegmaHighlight } from '../utils/plegma-articles.ts'
import type { PlegmaThemeStory } from '../utils/plegma-theme.ts'
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
  // What the pointer is on in the cards, so the map answers it: a group or an outlet (its articles come forward), and a story of the card of the other stories (its line lights up).
  // `related` are the stories that card lists.
  const highlight = ref<PlegmaHighlight | null>(null)
  const hoverStory = ref<number | null>(null)
  const related = ref<number[]>([])
  // What the ring of the story web shows: the groups (an arc for each) or the stance towards the government (an arc each for critical, neutral and supportive, wide as their share).
  // The stance is a count for the whole story, not for each article, so it is a ring and the nodes keep their sectors. `stance` holds [critical, neutral, supportive].
  const ring = ref<'groups' | 'stance'>('groups')
  const stance = ref<number[] | null>(null)
  // The largest stories of the focused theme with the outlets that wrote each, which the theme view reads from the fixtures; null until it has them. The stage draws its web from them.
  const themeStories = ref<PlegmaThemeStory[] | null>(null)
  // The groups that wrote the theme, with their articles, for the arcs of the ring of its web; null until the theme view has them.
  const themeGroups = ref<{ name: string, slot: number, n: number }[] | null>(null)
  // The color slot of the focused outlet's group, for the center of its web (themeStories then holds the stories of the outlet); 0 for an outlet with no group.
  const outletSlot = ref(0)

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
      highlight.value = null
      hoverStory.value = null
      related.value = []
      ring.value = 'groups'
      stance.value = null
      themeStories.value = null
      themeGroups.value = null
      outletSlot.value = 0
    }
  }
  const stepTo = (index: number | null) => { day.value = index }
  const compareWith = (id: number | null) => { compare.value = id }
  const setRegion = (value: PlegmaRegion | null) => { region.value = value }
  const setLanded = (value: boolean) => { landed.value = value }
  const setArticles = (value: PlegmaArticle[] | null) => { articles.value = value }
  const setHighlight = (value: PlegmaHighlight | null) => { highlight.value = value }
  const setHoverStory = (id: number | null) => { hoverStory.value = id }
  const setRing = (value: 'groups' | 'stance') => { ring.value = value }
  const setStance = (value: number[] | null) => { stance.value = value }
  const setRelated = (ids: number[]) => { related.value = ids }
  const setThemeGroups = (value: { name: string, slot: number, n: number }[] | null) => { themeGroups.value = value }
  const setOutletSlot = (value: number) => { outletSlot.value = value }
  const setThemeStories = (value: PlegmaThemeStory[] | null) => { themeStories.value = value }

  return { active, focus, day, compare, landed, region, articles, highlight, hoverStory, related, ring, stance, themeStories, themeGroups, outletSlot, syncRoute, stepTo, compareWith, setLanded, setRegion, setArticles, setHighlight, setHoverStory, setRelated, setRing, setStance, setThemeStories, setThemeGroups, setOutletSlot }
})
