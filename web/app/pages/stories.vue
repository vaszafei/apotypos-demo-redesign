<script setup lang="ts">
import { themeSlots } from '~/utils/plegma/plegma-world'
import type { DayStoryRow } from '~/components/home/DayStoryList.vue'

// Μέσα › Ιστορίες (stories-v2.html): a screen of the Plegma (components/MediaPlegma.vue) whose web is the largest stories of the period, each a small web of its articles in the colors
// of the groups, grouped by their themes, in an ellipse whose ring is the outlets (or their groups), each arc as long as its share of the articles, and the web fills the ellipse. Left of it, as tall as the two, the list of the stories of the period as Home has it (components/home/DayStoryList.vue): each with its articles, its change against the period before and its theme; above the web the date picker, and under it the lines of the first stories over the days of the period only. The web and the lines follow the date picker. A story or a theme picked on the web or in the list is dived into.
definePageMeta({ backdrop: true })
const { t } = useI18n()
useHead({ title: () => `${t('nav.media')} · ${t('site.name')}` })
const period = usePeriodStore()
const { status, refresh, dates, view, range, byDay, list } = await useStories()

const day = (iso: string) => fmtDate(iso)
const dateText = computed(() => (view.value.from === view.value.to ? day(view.value.from) : `${day(view.value.from)} – ${day(view.value.to)}`))

const lines = computed(() => {
  if (!list.value.length) return null
  const [i0, i1] = range.value
  const l = storyLines(list.value, i0, i1)
  const series = l.lines.map(({ s, values }, i) => ({ key: String(s.id), name: storyName(s), color: `var(--cat-${i + 1})`, values }))
  return { dates: dates.value.slice(l.d0, l.d1 + 1), series }
})

const changes = computed(() => storyChanges(byDay.value, range.value[0], range.value[1]))

// The web: the stories of the period grouped by their theme only for their color (the web of the stories has no theme nodes), with the color slots of the themes of the period.
const topicsData = useFixtureLazy<{ issues: unknown[], issueDaily: (number | null)[][] }>('home', { required: ['issues', 'issueDaily'], isEmpty: b => b.issueDaily.length === 0 })
const slotOfIssue = computed(() => (topicsData.data.value ? themeSlots(topicsData.data.value as never) : new Map<number, number>()))
const webFrom = computed(() => view.value.from)
const webTo = computed(() => view.value.to)
const periodWeb = import.meta.client ? usePeriodWeb(webFrom, webTo, slotOfIssue) : null
const webThemes = computed(() => (periodWeb?.ready.value ? periodWeb.themesOf(36, 10) : []))
// The ring of the web, as the story page has it: the outlets, or their groups.
const ringBy = ref<'outlets' | 'groups'>('outlets')

// The list: every story of the period, the largest first, with its change against the period before (none shown when it had none or too few to compare).
const changeOf = (id: number): DayStoryRow['change'] => {
  const c = changes.value?.get(id)
  if (!c) return undefined
  if (c.change === null) return undefined
  const size = fmtDec(Math.abs(c.change * 100))
  return { size: `${size}%`, dir: Number(size) === 0 ? null : c.change > 0 ? 'up' : 'down' }
}
const rows = computed<DayStoryRow[]>(() => (periodWeb?.ready.value ? periodWeb.rows.value.map(r => ({ id: r.s.id, name: storyName(r.s), n: r.n, issue: r.s.issue, theme: periodWeb.themeName(r.s.issue), change: changeOf(r.s.id) })) : []))
const litIssue = ref<number | null>(null)
const { web, leaving, hoverStory, open } = useWebDive(litIssue)
// The line of the story pointed at in the list comes forward on the chart (only the first stories have a line; for the others the chart stays as it is).
const litLine = computed(() => (hoverStory.value !== null && lines.value?.series.some(l => l.key === String(hoverStory.value)) ? String(hoverStory.value) : null))

// A new period draws the lines in again (assets/motion.js replay); the first view is played by plugins/motion.client.ts.
const { $motion } = useNuxtApp()
watch(view, async () => { await nextTick(); $motion.replay(document.querySelector('[data-card="lines"]')) })
</script>

<template>
  <template v-if="status === 'error'">
    <div class="error-state" role="alert" data-state="error">
      <AppIcon name="exclamation-triangle" />
      <p style="margin: 0">{{ t('state.failed') }}</p>
      <button type="button" class="button" @click="refresh()"><AppIcon name="arrow-path" class="icon icon-sm" />{{ t('state.retry') }}</button>
    </div>
  </template>
  <div v-else-if="status === 'empty'" class="dash-grid">
    <section class="dcard c-12"><div class="empty-state" data-state="empty"><AppIcon name="inbox" /><p style="margin: 0">{{ t('topics2.empty') }}</p></div></section>
  </div>
  <MediaPlegma v-else variant="stories">
    <template #side>
      <ClientOnly>
        <DayStoryList class="media-side-card dive-fade" :class="{ 'is-leaving': leaving }" :rows="rows" :title="t('stories.list.title')" :info="t('stories.list.info')" :empty="periodWeb?.ready.value ? t('stories.period.empty') : undefined" @hover="hoverStory = $event" @hover-theme="litIssue = $event" @open="open" />
      </ClientOnly>
    </template>
    <template #map="{ active }">
      <div class="stories-date dive-fade" :class="{ 'is-leaving': leaving }"><DateRange plain :dates="dates" :from="view.from" :to="view.to" @change="r => period.set(r.from, r.to)" /></div>
      <div class="media-map-web">
        <ClientOnly>
          <SegmentedControl v-if="webThemes.length" v-model="ringBy" class="media-map-tabs dive-fade" :class="{ 'is-leaving': leaving }" :label="t('stories.ring.label')" :options="[{ value: 'outlets', label: t('stories.ring.outlets') }, { value: 'groups', label: t('stories.ring.groups') }]" />
          <PlegmaDayWeb
            v-if="webThemes.length" ref="web" v-model:lit="litIssue" :hover-story="hoverStory" :themes="webThemes" :ring="[]" :outlets="ringBy === 'groups' ? periodWeb!.groupRing.value : periodWeb!.outlets.value" mode="stories" :date="dateText" :sub="t('stories.web.sub', { n: fmtInt(list.length) })"
            :picked="null" ellipse grouped spread fill titles :active="active" grow :label="t('topics2.stories.title')" @pick="id => open({ story: id })" @pick-theme="issue => open({ theme: issue })"
          />
          <p v-if="webThemes.length" class="media-map-note dive-fade" :class="{ 'is-leaving': leaving }">{{ t('stories.web.note') }}</p>
        </ClientOnly>
      </div>
    </template>
    <template #under>
      <DashCard card="lines" class="dive-fade" :class="{ 'is-leaving': leaving }" :title="t('stories.time.title')" :info="t('stories.time.info')">
        <LinesChart v-if="lines" :lit="litLine" :dates="lines.dates" :series="lines.series" sparse sqrt roomy :tall="220" :caption="t('stories.time.title')" :href-of="s => storyHref(s.key)" />
        <p v-else class="dcard-empty">{{ t('stories.period.empty') }}</p>
      </DashCard>
    </template>
  </MediaPlegma>
  <p class="proto-note">{{ t('proto.states') }}</p>
</template>
