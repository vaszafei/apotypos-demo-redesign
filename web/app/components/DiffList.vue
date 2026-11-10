<script setup lang="ts" generic="R extends DiffInput">
import type { BarRow } from '~/components/BarList.vue'

// Entity.DiffRow of assets/entity-cards.js in a UI.BarList: the share of a row, and a bar from the center line (the usual share) that goes right in teal when the row has more
// and left in orange when it has less. scale is the difference that fills half of the track; the rows of one card share it. tipKey is the message of the tooltip.
// The slot label replaces the name (a link, a group with its dot).
export interface DiffInput { key: string | number, label: string, value: number, usual: number }
const props = defineProps<{ rows: R[], scale: number, tipKey: string }>()
defineSlots<{ label?: (p: { row: R }) => unknown }>()
const slots = useSlots()
const { t } = useI18n()

type Item = BarRow & { diff: number, tipText: string, source: R }
const items = computed<Item[]>(() => props.rows.map((r) => {
  const diff = r.value - r.usual
  return {
    key: r.key, label: slots.label ? '' : r.label, text: fmtPct(r.value), value: 0, color: '', diff, source: r,
    tipText: t(props.tipKey, { label: r.label, value: fmtPct(r.value), usual: fmtPct(r.usual), diff: `${diff >= 0 ? '+' : '−'}${fmtPct(Math.abs(diff))}` })
  }
}))
</script>

<template>
  <BarList :rows="items">
    <template v-if="$slots.label" #label="{ row }"><slot name="label" :row="row.source" /></template>
    <template #bar="{ row }"><DivergingBar :left="-row.diff" :right="row.diff" :scale="scale" :colors="['var(--emph-less)', null, 'var(--emph-more)']" :label="row.tipText" /></template>
  </BarList>
</template>
