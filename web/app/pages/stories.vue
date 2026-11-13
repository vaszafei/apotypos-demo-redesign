<script setup lang="ts">
import type { BarRow } from '~/components/BarList.vue'
import type { StoryTrend } from '~/types/stories'
import { themeSlots } from '~/utils/plegma-world'

// Μέσα › Ιστορίες (stories-v2.html): a screen of the Plegma (components/MediaPlegma.vue) whose web is the largest stories of the period, each a small web of its articles in the colors
// of the groups, with a ring of the outlets. Left of it the stories that rise and fall against the period before and, under them, the lines of the first of them. A story clicked on the web opens.
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
  return { dates: dates.value.slice(l.d0, l.d1 + 1), series, band: l.band }
})

const trends = computed(() => storyTrends(byDay.value, range.value[0], range.value[1]))
const rowOf = (r: StoryTrend): BarRow => ({
  key: r.s.id, label: storyName(r.s), to: storyHref(r.s.id), value: Math.abs(r.change), color: r.change > 0 ? 'var(--emph-more)' : 'var(--emph-less)',
  arrow: r.change > 0 ? 'up' : 'down', text: `${fmtSigned(r.change * 100)}%`, tip: t('stories.trend.tip', { before: fmtInt(r.before), now: fmtInt(r.now) })
})
const trendRange = computed(() => {
  const tr = trends.value
  if (!tr) return null
  const [i0] = range.value
  return t('stories.trend.vs', { range: `${day(dates.value[tr.p0]!)}${tr.len > 1 ? ` – ${day(dates.value[i0 - 1]!)}` : ''}` })
})

// The web: the stories of the period grouped by their theme only for their color (the web of the stories has no theme nodes), with the color slots of the themes of the period.
const topicsData = useFixtureLazy<{ issues: unknown[], issueDaily: (number | null)[][] }>('home', { required: ['issues', 'issueDaily'], isEmpty: b => b.issueDaily.length === 0 })
const slotOfIssue = computed(() => (topicsData.data.value ? themeSlots(topicsData.data.value as never) : new Map<number, number>()))
const webFrom = computed(() => view.value.from)
const webTo = computed(() => view.value.to)
const periodWeb = import.meta.client ? usePeriodWeb(webFrom, webTo, slotOfIssue) : null
const webThemes = computed(() => (periodWeb?.ready.value ? periodWeb.themesOf() : []))
// The ring of the web, as the story page has it: the outlets, or their groups.
const ringBy = ref<'outlets' | 'groups'>('outlets')

// A new period draws the lines in again (assets/motion.js replay); the first view is played by plugins/motion.client.ts.
const { $motion } = useNuxtApp()
watch(view, async () => { await nextTick(); $motion.replay(document.querySelector('[data-card="lines"]')) })
</script>

<template>
  <Teleport v-if="status === 'ready'" defer to="#page-actions">
    <DateRange :dates="dates" :from="view.from" :to="view.to" @change="r => period.set(r.from, r.to)" />
  </Teleport>

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
    <template #map="{ active }">
      <div class="media-map-web">
        <ClientOnly>
          <SegmentedControl v-if="webThemes.length" v-model="ringBy" class="media-map-tabs" :label="t('stories.ring.label')" :options="[{ value: 'outlets', label: t('stories.ring.outlets') }, { value: 'groups', label: t('stories.ring.groups') }]" />
          <PlegmaDayWeb
            v-if="webThemes.length" :themes="webThemes" :ring="[]" :outlets="ringBy === 'groups' ? periodWeb!.groupRing.value : periodWeb!.outlets.value" mode="stories" :lit="null" :date="dateText" :sub="t('stories.web.sub', { n: fmtInt(list.length) })"
            :picked="null" :active="active" grow :label="t('topics2.stories.title')" @pick="id => navigateTo(storyHref(id))"
          />
          <p v-if="webThemes.length" class="media-map-note">{{ t('stories.web.note') }}</p>
        </ClientOnly>
      </div>
    </template>
    <template #side>
      <DashCard class="media-side-trends" :title="t('stories.trend.title')" :info="t('stories.trend.info', { n: TREND_MIN })">
        <template v-if="trends" #tools><span class="home-date">{{ trendRange }}</span></template>
        <p v-if="!trends" class="dcard-empty">{{ t('stories.trend.empty') }}</p>
        <div v-else class="story-trend">
          <div class="story-trend-col">
            <p class="dcard-sub">{{ t('stories.trend.up') }}</p>
            <BarList v-if="trends.up.length" :rows="trends.up.map(rowOf)" :max="trends.widest" />
            <p v-else class="dcard-empty">{{ t('stories.trend.none') }}</p>
          </div>
          <div class="story-trend-col">
            <p class="dcard-sub">{{ t('stories.trend.down') }}</p>
            <BarList v-if="trends.down.length" :rows="trends.down.map(rowOf)" :max="trends.widest" />
            <p v-else class="dcard-empty">{{ t('stories.trend.none') }}</p>
          </div>
        </div>
      </DashCard>
      <DashCard card="lines" :title="t('stories.time.title')" :info="t('stories.time.info')">
        <template #tools><span class="home-date">{{ dateText }}</span></template>
        <LinesChart v-if="lines" :dates="lines.dates" :series="lines.series" :band="lines.band" sparse sqrt :tall="300" :caption="t('stories.time.title')" :href-of="s => storyHref(s.key)" />
        <p v-else class="dcard-empty">{{ t('stories.period.empty') }}</p>
      </DashCard>
    </template>
  </MediaPlegma>
  <p class="proto-note">{{ t('proto.states') }}</p>
</template>
