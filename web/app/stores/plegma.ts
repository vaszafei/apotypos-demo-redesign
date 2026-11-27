import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { PlegmaRegion } from '../utils/plegma/plegma-camera.ts'
import type { PlegmaArticle, PlegmaHighlight } from '../utils/plegma/plegma-articles.ts'
import type { PlegmaThemeStory } from '../utils/plegma/plegma-theme.ts'
import { plegmaFocusOf, samePlegmaFocus } from '../utils/plegma/plegma-route.ts'
import type { PlegmaFocus } from '../utils/plegma/plegma-route.ts'

// `hero`: the page has the large search of Αρχική, so the search of the top bar waits.
// `backdrop`: a page of tabs (Μέσα) that draws its own web over the map: the stage is only the dim world behind it, and the tabs and the top bar stay.
declare module '#app' { interface PageMeta { plegma?: boolean, hero?: boolean, backdrop?: boolean } }

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
  // The area the names of the ring may use (the free cell of the view) and the boxes in it that they keep out of (the switch of the ring, the title); fractions of the stage. null: no names.
  const labelRoom = ref<{ room: PlegmaRegion, avoid: PlegmaRegion[] } | null>(null)
  // What the pointer is on in the cards, so the map answers it: a group or an outlet (its articles come forward), and a story of the card of the other stories (its line lights up).
  // `related` are the stories that card lists.
  const highlight = ref<PlegmaHighlight | null>(null)
  const hoverStory = ref<number | null>(null)
  const related = ref<number[]>([])
  // Lines between articles of the story web (Κλαδιά): the copies and the earlier articles they copy, as places in `articles` ([copy, source]); `hot` the pairs drawn strong (an outlet under the pointer).
  const articleLinks = ref<{ pairs: [number, number][], hot: Set<number> | null } | null>(null)
  // The outlets picked on a story (PlegmaStoryPick.vue): the rings show only them; empty, all the outlets.
  const outletPick = ref<Set<string>>(new Set())
  // What the ring of the story web shows: the outlets or the groups (an arc for each) or the stance towards the government (an arc each for critical, neutral and supportive, wide as their share).
  // The stance is a count for the whole story, not for each article, so it is a ring and the nodes keep their sectors. `stance` holds [critical, neutral, supportive].
  const ring = ref<'outlets' | 'groups' | 'stance'>('outlets')
  const stance = ref<number[] | null>(null)
  // The largest stories of the focused theme with the outlets that wrote each, which the theme view reads from the fixtures; null until it has them. The stage draws its web from them.
  const themeStories = ref<PlegmaThemeStory[] | null>(null)
  // The groups that wrote the theme, with their articles, for the arcs of the ring of its web; null until the theme view has them.
  const themeGroups = ref<{ name: string, slot: number, n: number }[] | null>(null)
  // The dot picked on the web of a day (Home, Ιστορίες) that dives into a page: the page (`s<story>` or `t<theme>`), the dot's place on the stage (px), its radius and fill (null: a ring of gray).
  // The stage takes it (and sets null) once that page is in view and has its free area (utils/plegma/plegma-dive.ts).
  const diveFrom = ref<{ key: string, x: number, y: number, r: number, fill: string | null } | null>(null)
  // The color slot of the focused outlet's group, for the center of its web (themeStories then holds the stories of the outlet); 0 for an outlet with no group.
  const outletSlot = ref(0)
  // Home under the hero («Η επικαιρότητα»): the day (an index of the dates) whose best stories are the webs, and the story picked among them. null while the hero is in view:
  // the webs are then the best of the latest week. The section sets and clears them, so no route change has to.
  const homeDay = ref<number | null>(null)
  const homePick = ref<number | null>(null)
  // Home's «Μεθοδολογία» (components/home/HomeMethod.vue): the same dim world behind it, with no day.
  const homeDim = ref(false)

  // The view is being left for another page (utils/plegma/plegma-leave.ts): its cards fade and the ring of its web empties before the route changes. Any route change ends it.
  const leaving = ref(false)
  const setLeaving = (value: boolean) => { leaving.value = value; if (value) hoverStory.value = null }

  const backdrop = ref(false)
  const syncRoute = (route: { path: string, query: Record<string, unknown>, meta: { plegma?: boolean, backdrop?: boolean } }) => {
    leaving.value = false
    active.value = route.meta.plegma === true || route.meta.backdrop === true
    backdrop.value = route.meta.backdrop === true
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
      // A story or a theme opens on its outlets (the tab Μέσα); an outlet on the groups.
      ring.value = next?.kind === 'story' || next?.kind === 'theme' ? 'outlets' : 'groups'
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
  const setLabelRoom = (value: { room: PlegmaRegion, avoid: PlegmaRegion[] } | null) => { labelRoom.value = value }
  const setArticles = (value: PlegmaArticle[] | null) => { articles.value = value }
  const setHighlight = (value: PlegmaHighlight | null) => { highlight.value = value }
  const setHoverStory = (id: number | null) => { hoverStory.value = id }
  const setRing = (value: 'outlets' | 'groups' | 'stance') => { ring.value = value }
  const setStance = (value: number[] | null) => { stance.value = value }
  const setRelated = (ids: number[]) => { related.value = ids }
  const setArticleLinks = (value: { pairs: [number, number][], hot: Set<number> | null } | null) => { articleLinks.value = value }
  const setOutletPick = (value: Set<string>) => { outletPick.value = value }
  const setDiveFrom = (value: { key: string, x: number, y: number, r: number, fill: string | null } | null) => { diveFrom.value = value }
  const setThemeGroups = (value: { name: string, slot: number, n: number }[] | null) => { themeGroups.value = value }
  const setOutletSlot = (value: number) => { outletSlot.value = value }
  const setThemeStories = (value: PlegmaThemeStory[] | null) => { themeStories.value = value }
  const setHomeDay = (value: number | null) => { homeDay.value = value }
  const pickHome = (id: number | null) => { homePick.value = id }
  const setHomeDim = (value: boolean) => { homeDim.value = value }

  return { active, backdrop, leaving, setLeaving, focus, day, compare, landed, region, articles, labelRoom, highlight, hoverStory, related, articleLinks, outletPick, ring, stance, themeStories, themeGroups, diveFrom, outletSlot, homeDay, homePick, homeDim, syncRoute, stepTo, compareWith, setLanded, setRegion, setLabelRoom, setArticles, setHighlight, setHoverStory, setRelated, setArticleLinks, setOutletPick, setRing, setStance, setThemeStories, setThemeGroups, setDiveFrom, setOutletSlot, setHomeDay, pickHome, setHomeDim }
})
