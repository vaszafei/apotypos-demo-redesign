<script setup lang="ts">
// The list «Όλες οι ομιλίες» (speeches-v2.html): the speeches by the measure the visitor picks, with the fingerprint of the topics of each. It scrolls inside its card and has every speech of the picked region.
const props = defineProps<{ rows: UnSpeech[], topicName: (key: string) => string }>()
const { t, locale } = useI18n()
const MEASURES = [
  { key: 'seconds', label: 'un.measure.minutes', value: (r: UnSpeech) => r.seconds / 60, color: undefined },
  { key: 'claims', label: 'un.measure.claims', value: (r: UnSpeech) => r.counts.claims, color: undefined },
  { key: 'promises', label: 'un.measure.promises', value: (r: UnSpeech) => r.counts.promises, color: undefined },
  { key: 'attacks', label: 'un.measure.attacks', value: (r: UnSpeech) => r.counts.attacks, color: 'var(--stance-critical)' }
]
const measure = ref('seconds')
const query = ref('')
const current = computed(() => MEASURES.find(m => m.key === measure.value)!)
const countryOf = (name: string) => (locale.value === 'el' ? UN_COUNTRY_EL[name] ?? name : name)
const list = computed(() => {
  const q = query.value.trim().toLowerCase()
  const value = current.value.value
  return props.rows.filter(r => !q || `${r.speaker} ${r.country} ${countryOf(r.country)}`.toLowerCase().includes(q)).sort((a, b) => value(b) - value(a) || b.seconds - a.seconds)
})
const max = computed(() => Math.max(...list.value.map(current.value.value), 1))
// The fingerprint: the topics of the speech as parts of one bar (the other topics in the track color), in the gray of the topics of the page.
const print = (r: UnSpeech) => {
  const rest = Math.max(0, 1 - r.shares.reduce((a, [, s]) => a + s, 0))
  return [...r.shares.map(([k, s], i) => ({ label: props.topicName(k), value: s, color: `var(--cat-${Math.min(i + 1, 9)})` })), { label: t('un.other'), value: rest > 0.01 ? rest : 0, color: 'var(--bar-track)' }]
}
</script>

<template>
  <div class="un-tools">
    <div class="region-pills" role="group" :aria-label="t('un.table.title')">
      <button v-for="m in MEASURES" :key="m.key" type="button" :aria-pressed="measure === m.key" @click="measure = m.key">{{ t(m.label) }}</button>
    </div>
    <input v-model="query" class="un-search" type="search" :placeholder="t('un.search')" :aria-label="t('un.search')">
  </div>
  <ul class="un-list">
    <template v-if="list.length">
      <li v-for="(r, i) in list" :key="r.vid" class="un-row">
        <span class="un-rank">{{ i + 1 }}</span>
        <span class="un-name"><a class="quiet-link" :href="r.url" target="_blank" rel="noopener">{{ r.speaker }}</a><span class="muted-text">{{ countryOf(r.country) }}</span></span>
        <HBar :value="current.value(r)" :max="max" :color="current.color" />
        <strong class="un-val">{{ fmtInt(Math.round(current.value(r))) }}</strong>
        <span class="un-print"><StackedBar :segments="print(r)" /></span>
      </li>
    </template>
    <li v-else class="dcard-empty">{{ t('un.list.none') }}</li>
  </ul>
  <p class="dcard-sub">{{ t('un.list.count', { n: fmtInt(list.length) }) }}</p>
</template>
