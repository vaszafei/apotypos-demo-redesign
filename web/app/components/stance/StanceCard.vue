<script setup lang="ts">
import type { BarRow } from '~/components/charts/BarList.vue'

// Entity.StanceCard of assets/entity-cards.js: the neutral share in the center of a bar, the critical share to the left, the supportive share to the right.
// rows: counts are [critical, neutral, supportive]. A row needs 30 articles with a stance, and the card needs two rows to compare.
const props = defineProps<{ rows: { label: string, color: string, counts: number[] }[], foot?: string | null }>()
const { t } = useI18n()
const STANCES = ['critical', 'neutral', 'supportive'] as const

const shown = computed(() => props.rows.map((r) => {
  const n = totalOf(r.counts)
  return { ...r, n, crit: n ? r.counts[0]! / n : 0, neu: n ? r.counts[1]! / n : 0, sup: n ? r.counts[2]! / n : 0 }
}).filter(r => r.n >= 30))
const scale = computed(() => Math.max(...shown.value.map(r => Math.max(r.crit + r.neu / 2, r.sup + r.neu / 2))))
type StanceRow = BarRow & { row: (typeof shown.value)[number] }
const rows = computed<StanceRow[]>(() => shown.value.map(r => ({ key: r.label, label: '', text: `${fmtPct(r.crit)} · ${fmtPct(r.sup)}`, value: 0, color: '', row: r })))
</script>

<template>
  <DashCard :title="t('entity.stance.title')" :info="t('entity.stance.info')">
    <p v-if="shown.length < 2" class="dcard-empty">{{ t('entity.stance.none') }}</p>
    <template v-else>
      <ChartLegend :items="STANCES.map(nm => ({ label: t(`stance.${nm}`), color: `var(--stance-${nm})` }))" />
      <BarList :rows="rows">
        <template #label="{ row }"><span class="dot" :style="`--dot:${row.row.color}`" aria-hidden="true" />{{ row.row.label }}</template>
        <template #bar="{ row }">
          <DivergingBar
            :left="row.row.crit" :middle="row.row.neu" :right="row.row.sup" :scale="scale"
            :label="t('g2.stance.row', { group: row.row.label, critical: fmtPct(row.row.crit), neutral: fmtPct(row.row.neu), supportive: fmtPct(row.row.sup), n: fmtInt(row.row.n) })"
          />
        </template>
      </BarList>
      <p v-if="foot" class="dcard-sub">{{ foot }}</p>
    </template>
  </DashCard>
</template>
