<script setup lang="ts">
import { useMediaQuery, useMounted } from '@vueuse/core'
import type { TileGroup } from '~/types/mme'
import type { TopicRow } from '~/types/topics'

// Μέσα › Επισκόπηση (media-v2.html): the articles of each day, the articles of each topic of the news, and the outlets by group.
const { t } = useI18n()
useHead({ title: () => `${t('nav.media')} · ${t('site.name')}` })
const period = usePeriodStore()
const { status, refresh, data, set, dates, view, range, summary: S, colorOf: groupColor, slugOf } = await useMme()

// The prerendered page has the narrow height; the client takes the real width only after it has hydrated, so the two renders agree.
const mounted = useMounted()
const wideNow = useMediaQuery('(min-width: 1280px)')
const wide = computed(() => mounted.value && wideNow.value)
const days = computed(() => {
  if (!set.value || !S.value) return null
  const d = mmeDaily(set.value)
  const [i0, i1] = range.value
  const cut = (a: number[]) => a.slice(i0, i1 + 1)
  const total = cut(d.total)
  const peak = total.reduce((best, v, i) => (v > total[best]! ? i : best), 0)
  return { dates: dates.value.slice(i0, i1 + 1), news: cut(d.news), other: cut(d.other), total, peak }
})
const series = computed(() => (days.value
  ? [{ name: t('media2.chart.news'), color: 'var(--series-news)', values: days.value.news }, { name: t('media2.chart.other'), color: 'var(--series-other)', values: days.value.other }]
  : []))
const dayTip = (i: number) => t('media2.chart.day', { date: fmtDate(days.value!.dates[i]!), n: fmtInt(days.value!.total[i]!), news: fmtInt(days.value!.news[i]!) })
const volumeInfo = computed(() => (days.value ? `${t('media2.chart.peak', { date: fmtDate(days.value.dates[days.value.peak]!), n: fmtInt(days.value.total[days.value.peak]!) })} · ${t('media2.chart.hint')}` : undefined))
const legend = computed(() => [[t('media2.chart.news'), 'var(--series-news)'], [t('media2.chart.other'), 'var(--series-other)']] as const)

// The topics of the news of the period; the 8 largest have a color, the others share the neutral.
const topics = computed<TopicRow[]>(() => (S.value
  ? S.value.set.issues.map((issue, k) => ({ k, issue, daily: [], count: S.value!.issueN[k]!, change: null }))
    .filter(r => S.value!.hard[r.k] && r.count > 0).sort((a, b) => b.count - a.count)
  : []))
const topicTotal = computed(() => topics.value.reduce((s, r) => s + r.count, 0))
const topicColors = computed(() => new Map(topics.value.slice(0, 8).map((r, i) => [r.k, `var(--cat-${i + 1})`])))

const tiles = computed<TileGroup[]>(() => {
  const byGroup = new Map<string | null, NonNullable<typeof S.value>['active']>()
  for (const o of S.value?.active ?? []) byGroup.set(o.group, [...byGroup.get(o.group) ?? [], o])
  return [...byGroup].map(([name, outlets]) => ({
    name, label: name ?? t('media2.groups.none'), slug: name ? slugOf.value.get(name) ?? null : null,
    color: name ? groupColor.value.get(name) ?? NO_GROUP : NO_GROUP,
    outlets: outlets.slice().sort((a, b) => b.n - a.n).map(o => ({ name: o.name, slug: o.slug, n: o.n })), n: outlets.reduce((s, o) => s + o.n, 0)
  })).sort((a, b) => Number(a.name === null) - Number(b.name === null) || b.n - a.n)
})
</script>

<template>
  <Teleport v-if="dates.length" defer to="#page-actions">
    <DateRange :dates="dates" :from="view.from" :to="view.to" @change="r => period.set(r.from, r.to)" />
  </Teleport>

  <template v-if="status === 'error'">
    <div class="error-state" role="alert" data-state="error">
      <AppIcon name="exclamation-triangle" />
      <p style="margin: 0">{{ t('state.failed') }}</p>
      <button type="button" class="button" @click="refresh()"><AppIcon name="arrow-path" class="icon icon-sm" />{{ t('state.retry') }}</button>
    </div>
  </template>
  <div v-else-if="!S || !days" class="dash-grid">
    <div class="card-col c-12"><section class="dcard"><div class="empty-state" data-state="empty"><p>{{ t('media2.empty.list') }}</p></div></section></div>
  </div>
  <template v-else>
    <div class="dash-grid">
      <DashCard class="c-7" :title="t('media2.chart.title')" :info="S.total > 0 ? volumeInfo : undefined">
        <template #tools>
          <ul class="legend"><li v-for="[label, color] in legend" :key="label"><span class="swatch" :style="{ background: color }" />{{ label }}</li></ul>
        </template>
        <DayBars v-if="S.total > 0" :dates="days.dates" :series="series" :caption="t('media2.chart.title')" :tip-of="dayTip" :height="wide ? 230 : 170" @select="r => period.set(r.from, r.to)" />
        <p v-else class="dcard-empty">{{ t('media2.chart.empty') }}</p>
      </DashCard>
      <DashCard class="c-5" :title="t('media2.topics.title')">
        <TopicDonut v-if="S.newsN > 0" :rows="topics" :total="topicTotal" :color-of="topicColors" :center="t('media2.topics.center')" :caption="t('media2.topics.title')" />
        <p v-else class="dcard-empty">{{ t('media2.chart.empty') }}</p>
      </DashCard>
      <DashCard class="c-12" :title="t('media2.bygroup.title')">
        <GroupTiles v-if="S.total > 0" :groups="tiles" :total="S.total" />
        <p v-else class="dcard-empty">{{ t('media2.chart.empty') }}</p>
      </DashCard>
    </div>
    <p class="proto-note">{{ t('mme.method', { from: fmtDate(view.from), to: fmtDate(view.to), n: fmtInt(S.total), date: fmtDate(data!.updatedAt) }) }}</p>
  </template>
  <p class="proto-note">{{ t('proto.states') }}</p>
</template>
