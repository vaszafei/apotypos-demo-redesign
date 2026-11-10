<script setup lang="ts">
import type { StoryIssue } from '~/types/stories'

// Entity.DailyCard of assets/entity-cards.js: the daily columns with a switch for the color of the columns: news (the analysed articles) or topics (the articles in stories).
// daily[i] is [analysed, news] for day i. topicDays maps the index of a topic to its articles per day. The 8 largest topics have a color, the others are one gray part.
const props = defineProps<{ dates: string[], daily: [number | null, number | null][], topicDays: Map<number, number[]>, issues: StoryIssue[], info?: string, height?: number }>()
const { t } = useI18n()
const TOP_TOPICS = 8
const mode = ref('news')

const topicSeries = computed(() => {
  const ranked = [...props.topicDays].map(([issue, values]) => ({ issue, values, total: totalOf(values) })).sort((a, b) => b.total - a.total)
  const lead = ranked.filter(r => !props.issues[r.issue]!.catchAll).slice(0, TOP_TOPICS)
  const rest = ranked.filter(r => !lead.includes(r))
  const series = lead.map((r, k) => ({ name: topicName(props.issues[r.issue]!), color: `var(--cat-${k + 1})`, values: r.values as (number | null)[] }))
  if (rest.length) series.push({ name: t('outlet2.daily.topic.rest'), color: NO_GROUP, values: props.dates.map((_, i) => rest.reduce((a, r) => a + r.values[i]!, 0)) })
  return series
})
// A day with no news count (null) has articles that nobody sorted into news and not news. They are a part of their own, never "not news".
const newsSeries = computed(() => {
  const unsorted = props.daily.map(([total, news]) => (news === null ? total : null))
  return [
    { name: t('outlet2.daily.news'), color: 'var(--series-news)', values: props.daily.map(([, news]) => news) },
    { name: t('outlet2.daily.other'), color: 'var(--series-other)', values: props.daily.map(([total, news]) => (news === null ? null : (total ?? 0) - news)) },
    ...(unsorted.some(v => (v ?? 0) > 0) ? [{ name: t('outlet2.daily.unsorted'), color: NO_GROUP, values: unsorted }] : [])
  ]
})
const series = computed(() => (mode.value === 'topic' ? topicSeries.value : newsSeries.value))

// A day where every value is null has no data: its total is a dash.
const tip = (i: number) => {
  const s = series.value
  const total = s.every(x => x.values[i] == null) ? '–' : fmtInt(s.reduce((a, x) => a + (x.values[i] || 0), 0))
  const list = s.filter(x => (x.values[i] ?? 0) > 0).reverse().map(x => `${x.name} ${fmtInt(x.values[i]!)}`).join(' · ')
  return `${t('story.daily.tip', { date: fmtDate(props.dates[i]!), n: total })}${list ? `: ${list}` : ''}`
}
</script>

<template>
  <DashCard :title="t('outlet2.daily.title')" :info="info">
    <template #tools>
      <SegmentedControl v-model="mode" :label="t('outlet2.daily.mode')" :options="[{ value: 'news', label: t('outlet2.daily.mode.news') }, { value: 'topic', label: t('outlet2.daily.mode.topic') }]" />
    </template>
    <div>
      <DayBars :dates="dates" :series="series" :height="height ?? 220" :caption="t('outlet2.daily.aria')" :tip-of="tip" :selectable="false" />
      <ChartLegend :items="series.map(x => ({ label: x.name, color: x.color }))" />
    </div>
  </DashCard>
</template>
