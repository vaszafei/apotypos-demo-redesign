<script setup lang="ts">
import type { StoriesData } from '~/types/stories'
import type { StoryDetailData } from '~/types/story-detail'
import { homeIndex, homeOutletsOf } from '~/utils/home'
import { dayTotals, lastCounted } from '~/utils/home-days'
import { groupColors, NO_GROUP, slotOfColor } from '~/utils/groups'
import type { GroupsData } from '~/utils/groups'
import { dayDots, PLEGMA_DAY_STORIES, PLEGMA_DAY_THEMES } from '~/utils/plegma-day'
import type { PlegmaDayTheme } from '~/utils/plegma-day'
import { themeSlots } from '~/utils/plegma-world'

// «Η επικαιρότητα» under the hero (the section #home-today of index.html): the calendar of the days floating over the Plegma, under it the web of the picked day (the date, its themes, the stories
// of each and a dot for each article: components/PlegmaDayWeb.vue), and beside it the card of the story of the day with the bar of the outlets that ran it. A story picked on the web takes the card.
// The section is drawn in the browser (the data of the stories is 2.8 MB that the prerendered page should not carry).
type HomeData = { dates: string[], outlets: { name: string, daily: (number | null)[] }[], issues: StoriesData['issues'], issueDaily: (number | null)[][] }
const { t } = useI18n()
const plegma = usePlegmaStore()
const home = useFixtureLazy<HomeData>('home', { required: ['dates', 'outlets', 'issues', 'issueDaily'], isEmpty: b => b.dates.length === 0 })
const list = useFixtureLazy<StoriesData>('stories', { required: ['dates', 'issues', 'stories'], isEmpty: b => b.stories.length === 0 })
const detail = useFixtureLazy<StoryDetailData>('storyDetail', { required: ['outlets', 'stories', 'base'], isEmpty: b => b.stories.length === 0 })
const groups = useFixtureLazy<GroupsData>('groups', { required: ['groups'], isEmpty: b => b.groups.length === 0 })

const totals = computed(() => (home.data.value ? dayTotals(home.data.value.outlets, home.data.value.dates.length) : []))
// The calendar starts on now: the last day that has articles, which is the last tile of the row.
const day = ref<number | null>(null)
watch(() => home.data.value, (d) => { if (d && day.value === null) day.value = lastCounted(totals.value) }, { immediate: true })

const ix = computed(() => (list.data.value ? homeIndex({ stories: list.data.value, detail: detail.data.value }) : null))
const colorOf = computed(() => groupColors(groups.data.value?.groups ?? []))
const slotOf = computed(() => (home.data.value ? themeSlots(home.data.value) : new Map<number, number>()))
const groupSlot = (g: string | null) => slotOfColor((g && colorOf.value.get(g)) || NO_GROUP)

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

// The story in the card: the one picked on the web, or the day's largest.
const story = computed(() => {
  const x = ix.value
  if (!x || day.value === null) return null
  const rows = x.byDay[day.value] ?? []
  const row = (plegma.homePick !== null ? rows.find(r => r.s.id === plegma.homePick) : null) ?? rows[0]
  if (!row) return null
  const outlets = homeOutletsOf(x, row.s, day.value, day.value)
  return { s: row.s, n: row.n, topic: x.issues[row.s.issue]!, outlets, parts: outlets.map(o => ({ name: o.name, group: o.group, n: o.n, slug: o.slug, color: (o.group && colorOf.value.get(o.group)) || NO_GROUP })) }
})

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
  <section id="home-today" ref="root" class="home-today" :aria-label="t('home.today.title')">
    <template v-if="home.data.value && day !== null">
      <div class="home-today-days"><HomeCalendar v-model="day" :dates="home.data.value.dates" :totals="totals" /></div>
      <div class="home-today-map"><PlegmaDayWeb :themes="themes" :date="fmtDate(home.data.value.dates[day]!)" :picked="plegma.homePick" :active="inView" @pick="plegma.pickHome" /></div>
      <div class="home-today-card">
        <DashCard :title="t('home.pick.title')" :info="t('home.pick.info')" card="home-day" class="home-day">
          <template #tools><span class="home-date">{{ fmtDate(home.data.value.dates[day]!) }}</span></template>
          <template v-if="story">
            <h3 class="home-day-story">{{ storyName(story.s) }}</h3>
            <p class="home-day-meta"><span class="home-topic-label">{{ t('home.day.topic') }}</span> <EntityLink type="topic" :to="topicHref(String(story.s.issue))">{{ topicName(story.topic) }}</EntityLink></p>
            <div v-if="story.parts.length" class="home-block"><OutletStack :parts="story.parts" /></div>
            <NuxtLink class="button button-sm home-story-go" :to="storyHref(story.s.id)">{{ t('home.day.open') }}<AppIcon name="chevron-right" class="icon icon-sm" /></NuxtLink>
          </template>
          <p v-else-if="ix" class="dcard-empty">{{ t('home.day.empty') }}</p>
        </DashCard>
      </div>
    </template>
  </section>
</template>
