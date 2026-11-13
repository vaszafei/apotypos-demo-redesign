<script setup lang="ts">
// Θέματα (topics-v2.html): a screen of the Plegma (components/MediaPlegma.vue) whose web is the largest themes of the period with their largest stories, and beside it the lines over
// time and the list of the topics; under it the movers and the shifts of 2025.
definePageMeta({ backdrop: true })
const { t } = useI18n()
const lit = ref<number | null>(null)
// The topic picked on the web or in the list: its cards take the place of the lines and the list (components/TopicCards.vue); a second pick of the same topic puts them back.
const picked = ref<number | null>(null)
const toggle = (k: number) => { picked.value = picked.value === k ? null : k }
useHead({ title: () => `${t('nav.topics')} · ${t('site.name')}` })
const period = usePeriodStore()
const { status, refresh, dates, view, range, rows, total, colorOf, series, movers } = await useTopics()
const { data: shifts, status: shiftsStatus } = await useFixture<{ window: [string, string], threshold: number, topics: { label: string, ratio: number, week: string }[], weeks: unknown[] }>('overton', { required: ['topics', 'weeks'], isEmpty: b => b.topics.length === 0 })

// The web (components/TopicWeb.vue): the themes that have a color (the lines and the list have the same), each with its largest stories of the period.
const slotOfIssue = computed(() => new Map([...colorOf.value].map(([k, c]) => [k, Number(/--cat-(\d+)/.exec(c)?.[1] ?? 0)])))
const webFrom = computed(() => view.value.from)
const webTo = computed(() => view.value.to)
const periodWeb = import.meta.client ? usePeriodWeb(webFrom, webTo, slotOfIssue) : null
const webThemes = computed(() => (periodWeb?.ready.value ? periodWeb.themesFor([...colorOf.value.keys()]) : []))
const flow = computed(() => (periodWeb?.ready.value ? periodWeb.flows([...colorOf.value.keys()]) : null))
const sliced = computed(() => dates.value.slice(range.value[0], range.value[1] + 1))
// A new period draws the lines in again (assets/motion.js replay); the first view is played by plugins/motion.client.ts.
const { $motion } = useNuxtApp()
watch(sliced, async () => { await nextTick(); $motion.replay(document.querySelector('[data-card="time"]')) })
const pickedRow = computed(() => (picked.value === null ? null : rows.value.find(r => r.k === picked.value) ?? null))
const top3 = computed(() => rows.value.slice(0, 3).reduce((a, r) => a + r.count, 0) / (total.value || 1))
const timeInfo = computed(() => `${t('topics2.time.title')}. ${t('topics2.time.sub')}`)
const allInfo = computed(() => `${t('topics2.all.title')}. ${t('topics2.all.sub')}`)
const moveInfo = computed(() => {
  const up = movers.value.filter(r => r.change! > 0)
  const down = movers.value.filter(r => r.change! < 0)
  if (!up.length || !down.length) return t('topics2.move.sub')
  const last = down[down.length - 1]!
  const finding = t('topics2.move.finding', { up: topicName(up[0]!.issue), a: `${fmtSigned(up[0]!.change! * 100)}%`, down: topicName(last.issue), b: `${fmtSigned(last.change! * 100)}%` })
  return `${finding}. ${t('topics2.move.sub')}`
})

const ratio = (v: number) => `${new Intl.NumberFormat('el-GR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(v)}×`
const shiftModel = computed(() => {
  const sd = shifts.value
  if (!sd || shiftsStatus.value !== 'ready') return null
  const ranked = sd.topics.slice().sort((a, b) => b.ratio - a.ratio)
  const moved = ranked.filter(r => r.ratio >= sd.threshold)
  const finding = t('shifts.table.finding', { n: fmtInt(moved.length), total: fmtInt(ranked.length), topic: ranked[0]!.label, x: ratio(ranked[0]!.ratio) })
  return {
    info: `${finding}. ${t('shifts.table.info')}`,
    sub: t('shifts.table.sub', { from: fmtDate(sd.window[0]), to: fmtDate(sd.window[1]) }),
    max: ranked[0]!.ratio,
    rows: moved.map(r => ({ key: r.label, label: r.label, sub: fmtDay(r.week), value: r.ratio, text: ratio(r.ratio), color: 'var(--accent)' }))
  }
})
const bars = computed(() => movers.value.map(r => ({
  key: r.k, label: topicName(r.issue), to: topicHref(r.k), value: Math.abs(r.change ?? 0), color: (r.change ?? 0) > 0 ? 'var(--emph-more)' : 'var(--emph-less)',
  arrow: (r.change ?? 0) > 0 ? 'up' as const : 'down' as const, text: `${fmtSigned((r.change ?? 0) * 100)}%`
})))
const widest = computed(() => Math.max(...bars.value.map(b => b.value), 0))
</script>

<template>
  <Teleport v-if="dates.length" defer to="#page-actions">
    <DateRange :dates="dates" :from="view.from" :to="view.to" @change="r => period.set(r.from, r.to)" />
  </Teleport>

  <div v-if="status === 'error'" class="dash-grid">
    <div class="card-col c-12"><div class="empty-state" data-state="error"><p>{{ t('state.failed') }}</p><button type="button" class="button" @click="refresh()">{{ t('state.retry') }}</button></div></div>
  </div>
  <div v-else-if="status === 'empty' || (status === 'ready' && !rows.length)" class="dash-grid">
    <div class="card-col c-12"><section class="dcard"><div class="empty-state" data-state="empty"><p>{{ t('topics2.empty') }}</p></div></section></div>
  </div>
  <MediaPlegma v-else variant="topics">
    <template #map="{ active }">
      <ClientOnly><TopicWeb :lit="lit ?? picked" :rows="rows" :total="total" :color-of="colorOf" :themes="webThemes" :zoom="0.84" selectable :active="active && webThemes.length > 0" @update:lit="v => lit = v" @select="toggle" /></ClientOnly>
    </template>
    <template #side>
      <Transition name="side-swap" mode="out-in">
        <TopicCards v-if="pickedRow" :key="pickedRow.k" :row="pickedRow" :total="total" :from="view.from" :to="view.to" @back="picked = null" />
        <div v-else key="all" class="media-plegma-stack">
          <DashCard class="media-plegma-fill" :title="t('topics2.all.title')" :info="allInfo">
            <p v-if="rows.length > 3" class="dcard-sub">{{ t('topics2.all.finding', { share: fmtPct(top3) }) }}</p>
            <p class="dcard-sub">{{ t('topics2.pick.hint') }}</p>
            <TopicList v-model:lit="lit" :rows="rows" :total="total" :color-of="colorOf" pickable @pick="toggle" />
          </DashCard>
        </div>
      </Transition>
    </template>
    <template #aside>
      <DashCard :title="t('topics2.flow.title')" :info="t('topics2.flow.info')">
        <ClientOnly><TopicOutletFlow v-if="flow" :data="flow" :lit="lit ?? picked" @update:lit="v => lit = v" @select="toggle" /></ClientOnly>
      </DashCard>
    </template>
    <div class="topics-row">
      <div class="topics-row-pair">
        <DashCard :title="t('topics2.move.title')" :info="moveInfo" card="movers"><BarList :rows="bars" :max="widest" /></DashCard>
        <DashCard v-if="shiftModel" :title="t('tab.media.shifts')" :info="shiftModel.info" card="shifts">
          <p class="dcard-sub">{{ shiftModel.sub }}</p>
          <div class="shift-scroll"><BarList :rows="shiftModel.rows" :max="shiftModel.max" /></div>
        </DashCard>
      </div>
      <DashCard class="topics-row-lines" :title="t('topics2.time.title')" :info="timeInfo" card="time">
        <LinesChart v-if="series.length" :dates="sliced" :series="series" :caption="t('topics2.time.title')" />
      </DashCard>
    </div>
  </MediaPlegma>
  <p class="proto-note">{{ t('proto.states') }}</p>
</template>
