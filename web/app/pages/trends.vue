<script setup lang="ts">
// Θέματα (topics-v2.html): the topics of the period as a donut and a list, the lines over time, the movers and the shifts of 2025.
useHead({ title: 'Θέματα · Απότυπος' })
const period = usePeriodStore()
const { status, refresh, dates, view, range, rows, total, colorOf, series, movers } = await useTopics()
const { data: shifts } = await useFetch<{ window: [string, string], threshold: number, topics: { label: string, ratio: number, week: string }[] }>('/data/shifts.json', { key: 'shifts' })

const sliced = computed(() => dates.value.slice(range.value[0], range.value[1] + 1))
const top3 = computed(() => rows.value.slice(0, 3).reduce((a, r) => a + r.count, 0) / (total.value || 1))
const timeInfo = 'Θέματα στον χρόνο. Άρθρα ανά ημέρα, μέσος όρος 7 ημερών, για τα 8 θέματα με τα περισσότερα άρθρα στην περίοδο.'
const allInfo = 'Όλα τα θέματα. Όλα τα θέματα της περιόδου, με τα άρθρα και το μερίδιο του καθενός.'
const moveSub = 'Αλλαγή των άρθρων στις τελευταίες 14 ημέρες έναντι των 14 πριν. Μόνο θέματα με 200 άρθρα ή περισσότερα στις 14 πριν. Το θέμα «Άλλα» δεν μετράει.'
const moveInfo = computed(() => {
  const up = movers.value.filter(r => r.change! > 0)
  const down = movers.value.filter(r => r.change! < 0)
  if (!up.length || !down.length) return moveSub
  const last = down[down.length - 1]!
  return `Πιο πολύ ανεβαίνει: ${up[0]!.issue.el} (${fmtSigned(up[0]!.change! * 100)}%), πέφτει: ${last.issue.el} (${fmtSigned(last.change! * 100)}%). ${moveSub}`
})

const ratio = (v: number) => `${new Intl.NumberFormat('el-GR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(v)}×`
const shiftModel = computed(() => {
  const sd = shifts.value
  if (!sd) return null
  const ranked = sd.topics.slice().sort((a, b) => b.ratio - a.ratio)
  const moved = ranked.filter(r => r.ratio >= sd.threshold)
  const finding = `${fmtInt(moved.length)} από ${fmtInt(ranked.length)} θέματα μετατοπίστηκαν, πιο πολύ η «${ranked[0]!.label}» (${ratio(ranked[0]!.ratio)})`
  const info = 'Για κάθε θέμα μετράμε πόσο μετακινείται από εβδομάδα σε εβδομάδα το κέντρο των άρθρων του (embeddings). Η μετατόπιση είναι η μέγιστη μετακίνηση προς τον συνηθισμένο θόρυβο του ίδιου του θέματος. Εβδομάδες με λιγότερα από 50 άρθρα δεν μετρούν. Τα δεδομένα είναι του 2025, γιατί τα embeddings υπάρχουν μόνο για εκείνη τη χρονιά.'
  return {
    info: `${finding}. ${info}`,
    sub: `Εβδομάδες ${fmtDate(sd.window[0])} – ${fmtDate(sd.window[1])}. Τα δεδομένα είναι του 2025 και δεν αλλάζουν με την περίοδο των άλλων σελίδων.`,
    max: ranked[0]!.ratio,
    rows: moved.map(r => ({ key: r.label, label: r.label, sub: fmtDay(r.week), value: r.ratio, text: ratio(r.ratio), color: 'var(--accent)' }))
  }
})
const bars = computed(() => movers.value.map(r => ({
  key: r.k, label: r.issue.el, to: topicHref(r.k), value: Math.abs(r.change ?? 0), color: (r.change ?? 0) > 0 ? 'var(--emph-more)' : 'var(--emph-less)',
  arrow: (r.change ?? 0) > 0 ? 'up' as const : 'down' as const, text: `${fmtSigned((r.change ?? 0) * 100)}%`
})))
const widest = computed(() => Math.max(...bars.value.map(b => b.value), 0))
</script>

<template>
  <Teleport v-if="dates.length" defer to="#page-actions">
    <DateRange :dates="dates" :from="view.from" :to="view.to" @change="r => period.set(r.from, r.to)" />
  </Teleport>

  <div v-if="status === 'error'" class="dash-grid">
    <div class="card-col c-12"><div class="empty-state" data-state="error"><p>Δεν φορτώθηκαν τα δεδομένα.</p><button type="button" class="button" @click="refresh()">Δοκιμάστε ξανά</button></div></div>
  </div>
  <div v-else-if="status === 'success' && !rows.length" class="dash-grid">
    <div class="card-col c-12"><section class="dcard"><div class="empty-state" data-state="empty"><p>Δεν υπάρχουν άρθρα σε αυτή την περίοδο.</p></div></section></div>
  </div>
  <div v-else class="dash-grid">
    <div class="card-col c-3">
      <DashCard title="Όλα τα θέματα" :info="allInfo" :delay="100">
        <p v-if="rows.length > 3" class="dcard-sub">Τα 3 μεγαλύτερα θέματα έχουν το {{ fmtPct(top3) }} των άρθρων</p>
        <TopicDonut :rows="rows" :total="total" :color-of="colorOf" />
      </DashCard>
    </div>
    <div class="card-col c-9">
      <DashCard title="Θέματα στον χρόνο" :info="timeInfo" :delay="140">
        <LinesChart v-if="series.length" :dates="sliced" :series="series" caption="Θέματα στον χρόνο" />
      </DashCard>
      <div class="dash-grid">
        <div class="card-col c-6">
          <DashCard title="Τάσεις" :info="moveInfo" :delay="180" card="movers"><BarList :rows="bars" :max="widest" /></DashCard>
        </div>
        <div class="card-col c-6">
          <DashCard v-if="shiftModel" title="Μετατοπίσεις" :info="shiftModel.info" :delay="220" card="shifts">
            <p class="dcard-sub">{{ shiftModel.sub }}</p>
            <div class="shift-scroll"><BarList :rows="shiftModel.rows" :max="shiftModel.max" /></div>
          </DashCard>
        </div>
      </div>
    </div>
  </div>
  <p class="proto-note">Πρωτότυπο: δείτε την κενή κατάσταση με ?state=empty και την κατάσταση σφάλματος με ?state=error.</p>
</template>
