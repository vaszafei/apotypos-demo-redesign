<script setup lang="ts">
import type { MmeProfile } from '~/types/mme'

// PortrayalCard of assets/mme.js: the tone of the outlet about each person. The bar goes left (critical, red) or right (supportive, blue) from the center line, the thin gray bar under it is the tone of the other outlets.
const props = defineProps<{ P: MmeProfile, k: number }>()
const { t } = useI18n()
const signed = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(Math.round(v * 100))}`
const portrayal = computed(() => portrayalOf(props.P, props.k))
const rows = computed(() => portrayal.value.rows.map(r => ({ key: r.p.name, label: '', name: r.p.name, n: r.n, text: signed(r.here), value: 0, color: '', here: r.here, other: r.other })))
const key = computed(() => [
  { label: t('stance.critical'), color: 'var(--stance-critical)' }, { label: t('stance.supportive'), color: 'var(--stance-supportive)' }, { label: t('mme.o.portray.else'), color: 'var(--cat-0)' }
])
</script>

<template>
  <DashCard class="c-12" :title="t('mme.o.portray.title')" :info="t('mme.o.portray.info')">
    <template v-if="rows.length">
      <div class="mme-key-row"><ChartLegend :items="key" /></div>
      <BarList :rows="rows">
        <template #label="{ row }">{{ row.name }} <span class="muted-text">{{ fmtInt(row.n) }}</span></template>
        <template #bar="{ row }">
          <PairBars
            :here="{ left: Math.max(0, -row.here), right: Math.max(0, row.here) }" :others="{ left: Math.max(0, -row.other), right: Math.max(0, row.other) }" :scale="portrayal.scale"
            :label="`${row.name}: ${t('mme.o.portray.row', { here: signed(row.here), else: signed(row.other) })}`"
          />
        </template>
      </BarList>
    </template>
    <p v-else class="dcard-empty">{{ t('media2.empty.list') }}</p>
  </DashCard>
</template>
