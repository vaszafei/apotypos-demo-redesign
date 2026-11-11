<script setup lang="ts">
import type { StoriesData } from '~/types/stories'
import type { StoryDetailData } from '~/types/story-detail'
import { homeIndex, homeOutletsOf } from '~/utils/home'
import { dayTotals, lastCounted } from '~/utils/home-days'
import { groupColors, NO_GROUP } from '~/utils/groups'
import type { GroupsData } from '~/utils/groups'

// «Η επικαιρότητα» under the hero (the section #home-today of index.html): the calendar of the days on the left and, on the right, the story of the day with the bar of the outlets that ran it.
// The middle is free: the Plegma behind shows the best stories of the picked day as webs (stores/plegma.ts homeDay), and a story picked on the map takes the card.
// The section is drawn in the browser (the data of the stories is 2.8 MB that the prerendered page should not carry).
type HomeData = { dates: string[], outlets: { name: string, daily: (number | null)[] }[], issueDaily: (number | null)[][] }
const { t } = useI18n()
const plegma = usePlegmaStore()
const home = useFixtureLazy<HomeData>('home', { required: ['dates', 'outlets', 'issueDaily'], isEmpty: b => b.dates.length === 0 })
const list = useFixtureLazy<StoriesData>('stories', { required: ['dates', 'issues', 'stories'], isEmpty: b => b.stories.length === 0 })
const detail = useFixtureLazy<StoryDetailData>('storyDetail', { required: ['outlets', 'stories', 'base'], isEmpty: b => b.stories.length === 0 })
const groups = useFixtureLazy<GroupsData>('groups', { required: ['groups'], isEmpty: b => b.groups.length === 0 })

const totals = computed(() => (home.data.value ? dayTotals(home.data.value.outlets, home.data.value.dates.length) : []))
// The calendar starts on the last day the hero's webs have topics for, as the hero does; the days after it are still in the calendar.
const lastCoded = computed(() => (home.data.value ? home.data.value.issueDaily.reduce((m, row) => Math.max(m, row.findLastIndex(v => v !== null)), 0) : 0))
const day = ref<number | null>(null)
watch(() => home.data.value, (d) => { if (d && day.value === null) day.value = Math.min(lastCoded.value || lastCounted(totals.value), d.dates.length - 1) }, { immediate: true })

const ix = computed(() => (list.data.value ? homeIndex({ stories: list.data.value, detail: detail.data.value }) : null))
const colorOf = computed(() => groupColors(groups.data.value?.groups ?? []))

// The story in the card: the one picked on the map, or the day's largest.
const story = computed(() => {
  const x = ix.value
  if (!x || day.value === null) return null
  const rows = x.byDay[day.value] ?? []
  const row = (plegma.homePick !== null ? rows.find(r => r.s.id === plegma.homePick) : null) ?? rows[0]
  if (!row) return null
  const outlets = homeOutletsOf(x, row.s, day.value, day.value)
  return { s: row.s, n: row.n, topic: x.issues[row.s.issue]!, outlets, parts: outlets.map(o => ({ name: o.name, group: o.group, n: o.n, slug: o.slug, color: (o.group && colorOf.value.get(o.group)) || NO_GROUP })) }
})

// The Plegma follows the day only while the section is in view; with the hero in view it frames the best of the week.
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
      <div class="home-today-left"><HomeCalendar v-model="day" :dates="home.data.value.dates" :totals="totals" /></div>
      <div class="home-today-right">
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
