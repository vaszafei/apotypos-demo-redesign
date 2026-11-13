<script setup lang="ts">
// Θέματα (topics-v2.html): a screen of the Plegma (components/MediaPlegma.vue) whose web is the largest themes of the period with their largest stories, and beside it the lines over
// time and the list of the topics; the movers on its left.
definePageMeta({ backdrop: true })
const { t } = useI18n()
const lit = ref<number | null>(null)
useHead({ title: () => `${t('nav.topics')} · ${t('site.name')}` })
const period = usePeriodStore()
const { status, refresh, dates, view, range, rows, total, colorOf, series } = await useTopics()

// The web (components/TopicWeb.vue): the themes that have a color (the lines and the list have the same), each with its largest stories of the period.
const slotOfIssue = computed(() => new Map([...colorOf.value].map(([k, c]) => [k, Number(/--cat-(\d+)/.exec(c)?.[1] ?? 0)])))
const webFrom = computed(() => view.value.from)
const webTo = computed(() => view.value.to)
const periodWeb = import.meta.client ? usePeriodWeb(webFrom, webTo, slotOfIssue) : null
const webThemes = computed(() => (periodWeb?.ready.value ? periodWeb.themesFor([...colorOf.value.keys()]) : []))
// The topics of the Sankey: the largest ones, the first 8 with a color.
const FLOW_TOPICS = 18
const FLOW_OUTLETS = 22
const flow = computed(() => (periodWeb?.ready.value ? periodWeb.flows(rows.value.slice(0, FLOW_TOPICS).map(r => r.k), new Map(rows.value.map(r => [r.k, r.count])), total.value, FLOW_OUTLETS) : null))
const sliced = computed(() => dates.value.slice(range.value[0], range.value[1] + 1))
// A new period draws the lines in again (assets/motion.js replay); the first view is played by plugins/motion.client.ts.
const { $motion } = useNuxtApp()
watch(sliced, async () => { await nextTick(); $motion.replay(document.querySelector('[data-card="time"]')) })
const timeInfo = computed(() => `${t('topics2.time.title')}. ${t('topics2.time.sub')}`)
// The trends: the articles of each topic in the period against the period of the same length right before it (as the trends of the stories). A topic needs MIN_BEFORE articles in the period
// before; the catch-all topic is not a trend. null when there is no period before.
const MIN_BEFORE = 30
const TREND_ROWS = 4
const trends = computed(() => {
  const [i0, i1] = range.value
  const len = i1 - i0 + 1
  const p0 = i0 - len
  if (p0 < 0) return null
  const sum = (a: (number | null)[], x: number, y: number) => a.slice(x, y + 1).reduce<number>((n, v) => n + (v ?? 0), 0)
  const all = rows.value.filter(r => !r.issue.catchAll).map(r => ({ r, now: r.count, before: sum(r.daily, p0, i0 - 1) })).filter(x => x.before >= MIN_BEFORE).map(x => ({ ...x, change: (x.now - x.before) / x.before }))
  const up = all.filter(x => x.change > 0).sort((a, b) => b.change - a.change).slice(0, TREND_ROWS)
  const down = all.filter(x => x.change < 0).sort((a, b) => a.change - b.change).slice(0, TREND_ROWS)
  return { p0, len, up, down, widest: Math.max(...up.concat(down).map(x => Math.abs(x.change)), 0) }
})
const trendRow = (x: NonNullable<typeof trends.value>['up'][number]) => ({
  key: x.r.k, label: topicName(x.r.issue), to: topicHref(x.r.k), sub: t('topics2.trend.counts', { before: fmtInt(x.before), now: fmtInt(x.now) }), value: Math.abs(x.change), color: x.change > 0 ? 'var(--emph-more)' : 'var(--emph-less)',
  arrow: x.change > 0 ? 'up' as const : 'down' as const, text: `${fmtSigned(x.change * 100)}%`
})
const trendVs = computed(() => {
  const tr = trends.value
  if (!tr) return null
  return t('stories.trend.vs', { range: `${fmtDate(dates.value[tr.p0]!)}${tr.len > 1 ? ` – ${fmtDate(dates.value[range.value[0] - 1]!)}` : ''}` })
})
</script>

<template>
  <div v-if="status === 'error'" class="dash-grid">
    <div class="card-col c-12"><div class="empty-state" data-state="error"><p>{{ t('state.failed') }}</p><button type="button" class="button" @click="refresh()">{{ t('state.retry') }}</button></div></div>
  </div>
  <div v-else-if="status === 'empty' || (status === 'ready' && !rows.length)" class="dash-grid">
    <div class="card-col c-12"><section class="dcard"><div class="empty-state" data-state="empty"><p>{{ t('topics2.empty') }}</p></div></section></div>
  </div>
  <MediaPlegma v-else variant="topics">
    <template #map="{ active }">
      <div v-if="dates.length" class="topics-date"><DateRange :dates="dates" :from="view.from" :to="view.to" @change="r => period.set(r.from, r.to)" /></div>
      <div class="media-map-web">
        <ClientOnly><TopicWeb :lit="lit" :rows="rows" :total="total" :color-of="colorOf" :themes="webThemes" :zoom="0.9" :active="active && webThemes.length > 0" @update:lit="v => lit = v" /></ClientOnly>
      </div>
    </template>
    <template #side>
      <DashCard class="topic-trends" :title="t('topics2.move.title')" :info="t('topics2.trend.info2', { n: MIN_BEFORE })">
        <p v-if="!trends" class="dcard-empty">{{ t('stories.trend.empty') }}</p>
        <template v-else>
          <p class="trend-vs">{{ trendVs }}</p>
          <p class="dcard-sub">{{ t('stories.trend.up') }}</p>
          <BarList v-if="trends.up.length" :rows="trends.up.map(trendRow)" :max="trends.widest" />
          <p v-else class="dcard-empty">{{ t('stories.trend.none') }}</p>
          <p class="dcard-sub">{{ t('stories.trend.down') }}</p>
          <BarList v-if="trends.down.length" :rows="trends.down.map(trendRow)" :max="trends.widest" />
          <p v-else class="dcard-empty">{{ t('stories.trend.none') }}</p>
        </template>
      </DashCard>
    </template>
    <template #under>
      <DashCard :title="t('topics2.time.title')" :info="timeInfo" card="time">
        <LinesChart v-if="series.length" :dates="sliced" :series="series" :tall="196" :caption="t('topics2.time.title')" />
      </DashCard>
    </template>
    <template #aside>
      <DashCard :title="t('topics2.flow.title')" :info="t('topics2.flow.info')">
        <ClientOnly><TopicOutletFlow v-if="flow" :data="flow" :lit="lit" @update:lit="v => lit = v" /></ClientOnly>
      </DashCard>
    </template>
  </MediaPlegma>
  <p class="proto-note">{{ t('proto.states') }}</p>
</template>
