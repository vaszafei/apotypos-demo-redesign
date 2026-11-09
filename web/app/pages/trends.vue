<script setup lang="ts">
// Θέματα (topics-v2.html): the topics of the period as a donut and a list, the lines over time, the movers and the shifts of 2025.
const { t } = useI18n()
useHead({ title: () => `${t('nav.topics')} · ${t('site.name')}` })
const period = usePeriodStore()
const { status, refresh, dates, view, range, rows, total, colorOf, series, movers } = await useTopics()
const { data: shifts, status: shiftsStatus } = await useFixture<{ window: [string, string], threshold: number, topics: { label: string, ratio: number, week: string }[], weeks: unknown[] }>('overton', { required: ['topics', 'weeks'], isEmpty: b => b.topics.length === 0 })

const sliced = computed(() => dates.value.slice(range.value[0], range.value[1] + 1))
// A new period draws the lines in again (assets/motion.js replay); the first view is played by plugins/motion.client.ts.
const { $motion } = useNuxtApp()
watch(sliced, async () => { await nextTick(); $motion.replay(document.querySelector('[data-card="time"]')) })
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
  <div v-else class="dash-grid">
    <div class="card-col c-3">
      <DashCard :title="t('topics2.all.title')" :info="allInfo">
        <p v-if="rows.length > 3" class="dcard-sub">{{ t('topics2.all.finding', { share: fmtPct(top3) }) }}</p>
        <TopicDonut :rows="rows" :total="total" :color-of="colorOf" />
      </DashCard>
    </div>
    <div class="card-col c-9">
      <DashCard :title="t('topics2.time.title')" :info="timeInfo" card="time">
        <LinesChart v-if="series.length" :dates="sliced" :series="series" :caption="t('topics2.time.title')" />
      </DashCard>
      <div class="dash-grid">
        <div class="card-col c-6">
          <DashCard :title="t('topics2.move.title')" :info="moveInfo" card="movers"><BarList :rows="bars" :max="widest" /></DashCard>
        </div>
        <div class="card-col c-6">
          <DashCard v-if="shiftModel" :title="t('tab.media.shifts')" :info="shiftModel.info" card="shifts">
            <p class="dcard-sub">{{ shiftModel.sub }}</p>
            <div class="shift-scroll"><BarList :rows="shiftModel.rows" :max="shiftModel.max" /></div>
          </DashCard>
        </div>
      </div>
    </div>
  </div>
  <p class="proto-note">{{ t('proto.states') }}</p>
</template>
