<script setup lang="ts">
import type { StoriesData } from '~/types/stories'
import type { StoryDetailData } from '~/types/story-detail'
import { homeIndex, homeOutletsOf } from '~/utils/home'
import { dayTotals, lastCounted } from '~/utils/home-days'
import { groupColors, NO_GROUP, slotOfColor } from '~/utils/groups'
import type { GroupsData } from '~/utils/groups'
import { dayDots, PLEGMA_DAY_STORIES, PLEGMA_DAY_THEMES } from '~/utils/plegma/plegma-day'
import type { PlegmaDayTheme } from '~/utils/plegma/plegma-day'
import type { DayOutlet, DayRing } from '~/components/plegma/PlegmaDayWeb.vue'
import { themeSlots } from '~/utils/plegma/plegma-world'
import { diveFromDay } from '~/utils/plegma/plegma-dive'
import { useMediaQuery } from '@vueuse/core'

// «Η επικαιρότητα» under the hero (the section #home-today of index.html): the calendar of the days floating over the Plegma, under it the web of the picked day (the date, its themes, the stories
// of each and a dot for each article: components/PlegmaDayWeb.vue), and beside it the list of the stories (or the themes) of the day. A story pointed at in the list is lit on the web with its title; a click on one dives into its page.
// The web has one form: the themes of the day as nodes, each joined to its stories; the ring is the outlets. The list has the theme under each story.
// The section is drawn in the browser (the data of the stories is 2.8 MB that the prerendered page should not carry).
type HomeData = { dates: string[], outlets: { name: string, daily: (number | null)[] }[], issues: StoriesData['issues'], issueDaily: (number | null)[][] }
const { t } = useI18n()
const plegma = usePlegmaStore()
const home = useFixtureLazy<HomeData>('home', { required: ['dates', 'outlets', 'issues', 'issueDaily'], isEmpty: b => b.dates.length === 0 })
const list = useFixtureLazy<StoriesData>('stories', { required: ['dates', 'issues', 'stories'], isEmpty: b => b.stories.length === 0 })
// The detail (1.4 MB) comes after the list of stories, which the web needs first; the day shows without the outlets' groups until it is in.
const detail = useFixtureLazy<StoryDetailData>('storyDetail', { required: ['outlets', 'stories', 'base'], isEmpty: b => b.stories.length === 0 }, { immediate: false })
watch(() => list.data.value, (d) => { if (d) detail.refresh() }, { immediate: true })
const groups = useFixtureLazy<GroupsData>('groups', { required: ['groups'], isEmpty: b => b.groups.length === 0 })

const totals = computed(() => (home.data.value ? dayTotals(home.data.value.outlets, home.data.value.dates.length) : []))
// The calendar starts on now: the last day that has articles, which is the last tile of the row.
const day = ref<number | null>(null)
watch(() => home.data.value, (d) => { if (d && day.value === null) day.value = lastCounted(totals.value) }, { immediate: true })

const ix = computed(() => (list.data.value ? homeIndex({ stories: list.data.value, detail: detail.data.value }) : null))
const colorOf = computed(() => groupColors(groups.data.value?.groups ?? []))
const slotOf = computed(() => (home.data.value ? themeSlots(home.data.value) : new Map<number, number>()))
const groupSlot = (g: string | null) => slotOfColor((g && colorOf.value.get(g)) || NO_GROUP)

// Every theme of the day with its articles, the largest first: the list beside the web, and the arcs of its ring. Only the largest themes have a web.
const dayThemes = computed(() => {
  const x = ix.value
  const d = day.value
  if (!x || d === null) return []
  const total = new Map<number, number>()
  for (const r of x.byDay[d] ?? []) total.set(r.s.issue, (total.get(r.s.issue) ?? 0) + r.n)
  const sum = [...total.values()].reduce((a, b) => a + b, 0)
  return [...total].map(([issue, n]) => ({ issue, n, share: sum ? n / sum : 0, name: topicName(x.issues[issue]!), slot: slotOf.value.get(issue) ?? 0 })).sort((a, b) => b.n - a.n)
})
const litIssue = ref<number | null>(null)
// The stories of the day, the largest first, in parts of 100 that come as the list scrolls (a day has up to some hundreds).
const storyRows = computed(() => (ix.value && day.value !== null ? ix.value.byDay[day.value] ?? [] : []))
const shown = ref(100)
watch(day, () => { shown.value = 100 })
const more = (e: Event) => {
  const el = e.target as HTMLElement
  if (el.scrollTop + el.clientHeight > el.scrollHeight - 300 && shown.value < storyRows.value.length) shown.value += 100
}
watch(day, () => { litIssue.value = null })
// The outlets of the day, the largest first: the arcs of the ring of the stories, each in the color of its group.
const dayOutlets = computed<DayOutlet[]>(() => {
  const h = home.data.value
  const d = day.value
  if (!h || d === null) return []
  const groupOf = new Map((detail.data.value?.outlets ?? []).map(o => [o.name, o.group]))
  return h.outlets.map(o => ({ name: o.name, n: o.daily[d] ?? 0, slot: groupSlot(groupOf.get(o.name) ?? null) })).filter(o => o.n > 0).sort((a, b) => b.n - a.n)
})
const ring = computed<DayRing[]>(() => dayThemes.value.map(r => ({ issue: r.issue, name: r.name, slot: r.slot, n: r.n })))

// The themes of the day for the web: the largest stories of the day (the most articles) grouped by theme; the other stories of the day are only counted, for the faint dots.
const themes = computed<PlegmaDayTheme[]>(() => {
  const x = ix.value
  const d = day.value
  if (!x || d === null) return []
  const rows = x.byDay[d] ?? []
  const shown = rows.slice(0, PLEGMA_DAY_STORIES)
  const total = new Map<number, number>()
  const rest = new Map<number, number>()
  rows.forEach((r, k) => {
    total.set(r.s.issue, (total.get(r.s.issue) ?? 0) + r.n)
    if (k >= PLEGMA_DAY_STORIES) rest.set(r.s.issue, (rest.get(r.s.issue) ?? 0) + 1)
  })
  const byIssue = new Map<number, PlegmaDayTheme>()
  for (const r of shown) {
    let theme = byIssue.get(r.s.issue)
    if (!theme) {
      theme = { issue: r.s.issue, name: topicName(x.issues[r.s.issue]!), slot: slotOf.value.get(r.s.issue) ?? 0, n: total.get(r.s.issue) ?? 0, stories: [], rest: rest.get(r.s.issue) ?? 0 }
      byIssue.set(r.s.issue, theme)
    }
    const outlets = homeOutletsOf(x, r.s, d, d)
    const bySlot = new Map<number, number>()
    for (const o of outlets) bySlot.set(groupSlot(o.group), (bySlot.get(groupSlot(o.group)) ?? 0) + o.n)
    const counts = [...bySlot].map(([slot, n]) => ({ slot, n })).sort((a, b) => b.n - a.n)
    theme.stories.push({ id: r.s.id, name: storyName(r.s), n: r.n, media: outlets.length || r.s.outlets, dots: dayDots(r.n, counts) })
  }
  return [...byIssue.values()].sort((a, b) => b.n - a.n).slice(0, PLEGMA_DAY_THEMES)
})

// Picking a story or a theme (on the web or in the list) dives into its page: the section fades out, the web swells and dives into the node (utils/plegma/plegma-dive.ts), the page changes.
const web = ref<{ spotOf: (t: { story?: number, theme?: number }) => { x: number, y: number }, canvas: HTMLCanvasElement | undefined }>()
const reduced = useMediaQuery('(prefers-reduced-motion: reduce)')
const leaving = ref(false)
const hoverStory = ref<number | null>(null)
const open = async (target: { story?: number, theme?: number }) => {
  const w = web.value
  if (leaving.value || !w?.canvas) return
  leaving.value = true
  hoverStory.value = null
  litIssue.value = null
  const to = target.story !== undefined ? storyHref(target.story) : topicHref(String(target.theme))
  await diveFromDay(w.canvas, w.spotOf(target), { go: () => navigateTo(to), region: () => plegma.region, reduced: reduced.value })
}

// The Plegma behind steps back to a dim map while the section is in view, and goes back to the best of the week with the hero in view.
const root = ref<HTMLElement>()
const inView = ref(false)
let watcher: IntersectionObserver | null = null
onMounted(() => {
  watcher = new IntersectionObserver(([entry]) => { inView.value = !!entry?.isIntersecting }, { threshold: 0.45 })
  if (root.value) watcher.observe(root.value)
})
watch([inView, day], () => {
  plegma.setHomeDay(inView.value ? day.value : null)
  plegma.pickHome(null)
})
onBeforeUnmount(() => { watcher?.disconnect(); plegma.setHomeDay(null); plegma.pickHome(null) })
</script>

<template>
  <section id="home-today" ref="root" class="home-today" :class="{ 'is-leaving': leaving }" :aria-label="t('home.today.title')">
    <template v-if="home.data.value && day !== null">
      <div class="home-today-days"><HomeCalendar v-model="day" :dates="home.data.value.dates" :totals="totals" /></div>
      <div class="home-today-map"><PlegmaDayWeb ref="web" v-model:lit="litIssue" names :hover-story="hoverStory" :themes="themes" :ring="ring" :outlets="dayOutlets"  mode="stories" grouped :date="fmtDate(home.data.value.dates[day]!)" :picked="null" :active="inView" @pick="open({ story: $event })" @pick-theme="open({ theme: $event })" /></div>
      <div class="home-today-side">
        <DashCard :title="t('home.daylist.title')" :info="t('home.daylist.info')" card="home-stories" class="home-day-list">
          <ul v-if="storyRows.length" class="home-stories" @scroll="more">
            <li v-for="r in storyRows.slice(0, shown)" :key="r.s.id">
              <button type="button" class="home-story-pick" @pointerenter="hoverStory = r.s.id" @pointerleave="hoverStory = null" @focus="hoverStory = r.s.id" @blur="hoverStory = null" @click="open({ story: r.s.id })">
                <span class="home-story-name">{{ storyName(r.s) }}</span><span class="muted-text">{{ fmtInt(r.n) }}</span>
              </button>
              <button type="button" class="home-row-theme" @pointerenter="litIssue = r.s.issue" @pointerleave="litIssue = null" @focus="litIssue = r.s.issue" @blur="litIssue = null" @click="open({ theme: r.s.issue })">
                <span class="home-row-dot" :style="{ background: `var(--cat-${slotOf.get(r.s.issue) ?? 0})` }" aria-hidden="true" /><span class="home-row-theme-name">{{ topicName(ix!.issues[r.s.issue]!) }}</span>
              </button>
            </li>
          </ul>
          <p v-else-if="ix" class="dcard-empty">{{ t('home.day.empty') }}</p>
        </DashCard>
      </div>
    </template>
  </section>
</template>
