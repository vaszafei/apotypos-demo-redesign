<script setup lang="ts">
// Θέματα (topics-v2.html): a screen of the Plegma (components/MediaPlegma.vue) whose web is the largest themes of the period with their largest stories, and beside it the lines over
// time and the list of the topics; the movers on its left.
definePageMeta({ backdrop: true })
const { t } = useI18n()
const lit = ref<number | null>(null)
useHead({ title: () => `${t('nav.topics')} · ${t('site.name')}` })
const period = usePeriodStore()
const { status, refresh, dates, view, range, rows, total, colorOf, series, movers } = await useTopics()

// The web (components/TopicWeb.vue): the themes that have a color (the lines and the list have the same), each with its largest stories of the period.
const slotOfIssue = computed(() => new Map([...colorOf.value].map(([k, c]) => [k, Number(/--cat-(\d+)/.exec(c)?.[1] ?? 0)])))
const webFrom = computed(() => view.value.from)
const webTo = computed(() => view.value.to)
const periodWeb = import.meta.client ? usePeriodWeb(webFrom, webTo, slotOfIssue) : null
const webThemes = computed(() => (periodWeb?.ready.value ? periodWeb.themesFor([...colorOf.value.keys()]) : []))
// The topics of the Sankey: the largest ones, the first 8 with a color.
const FLOW_TOPICS = 16
const flow = computed(() => (periodWeb?.ready.value ? periodWeb.flows(rows.value.slice(0, FLOW_TOPICS).map(r => r.k), new Map(rows.value.map(r => [r.k, r.count])), total.value) : null))
const sliced = computed(() => dates.value.slice(range.value[0], range.value[1] + 1))
// A new period draws the lines in again (assets/motion.js replay); the first view is played by plugins/motion.client.ts.
const { $motion } = useNuxtApp()
watch(sliced, async () => { await nextTick(); $motion.replay(document.querySelector('[data-card="time"]')) })
const timeInfo = computed(() => `${t('topics2.time.title')}. ${t('topics2.time.sub')}`)
const moveInfo = computed(() => {
  const up = movers.value.filter(r => r.change! > 0)
  const down = movers.value.filter(r => r.change! < 0)
  if (!up.length || !down.length) return t('topics2.move.sub')
  const last = down[down.length - 1]!
  const finding = t('topics2.move.finding', { up: topicName(up[0]!.issue), a: `${fmtSigned(up[0]!.change! * 100)}%`, down: topicName(last.issue), b: `${fmtSigned(last.change! * 100)}%` })
  return `${finding}. ${t('topics2.move.sub')}`
})

const bars = computed(() => movers.value.map(r => ({
  key: r.k, label: topicName(r.issue), to: topicHref(r.k), value: Math.abs(r.change ?? 0), color: (r.change ?? 0) > 0 ? 'var(--emph-more)' : 'var(--emph-less)',
  arrow: (r.change ?? 0) > 0 ? 'up' as const : 'down' as const, text: `${fmtSigned((r.change ?? 0) * 100)}%`
})))
const widest = computed(() => Math.max(...bars.value.map(b => b.value), 0))
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
      <DashCard :title="t('topics2.time.title')" :info="timeInfo" card="time">
        <LinesChart v-if="series.length" :dates="sliced" :series="series" :tall="196" :caption="t('topics2.time.title')" />
      </DashCard>
    </template>
    <template #side>
      <DashCard :title="t('topics2.move.title')" :info="moveInfo" card="movers"><BarList :rows="bars" :max="widest" /></DashCard>
    </template>
    <template #aside>
      <DashCard :title="t('topics2.flow.title')" :info="t('topics2.flow.info')">
        <ClientOnly><TopicOutletFlow v-if="flow" :data="flow" :lit="lit" @update:lit="v => lit = v" /></ClientOnly>
      </DashCard>
    </template>
  </MediaPlegma>
  <p class="proto-note">{{ t('proto.states') }}</p>
</template>
