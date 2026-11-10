<script setup lang="ts" generic="Row extends BarRow">
// UI.BarList of assets/components.js: a name, a value and a horizontal bar on one scale. The slots label and bar replace the name and the bar of a row (bar: another bar, such as DivergingBar).
// columns: the rows are cut into that many lists side by side (on the scale of all the rows). marker: a reference value of a row on the same scale as the bar, as a tick. cls: a class of the list.
export interface BarRow { key: string | number, label: string, to?: string, sub?: string, text: string, value: number, color: string, arrow?: 'up' | 'down', tip?: string, marker?: number }
const props = defineProps<{ rows: Row[], max?: number, columns?: number, cls?: string }>()
defineSlots<{ label?: (p: { row: Row }) => unknown, bar?: (p: { row: Row }) => unknown }>()
const top = computed(() => props.max ?? Math.max(...props.rows.map(r => r.value), 1))
const tooltip = useTooltipStore()
const width = (v: number) => `${(Math.min(v / top.value, 1) * 100).toFixed(4).replace(/\.?0+$/, '')}%`
const parts = computed(() => {
  const size = props.columns && props.columns > 1 ? Math.ceil(props.rows.length / props.columns) : props.rows.length
  const out: Row[][] = []
  for (let i = 0; i < props.rows.length || !out.length; i += size || 1) out.push(props.rows.slice(i, i + size))
  return out
})
</script>

<template>
  <div v-if="parts.length > 1" class="bar-cols">
    <BarList v-for="(part, p) in parts" :key="p" :rows="part" :max="top" :cls="cls">
      <template v-if="$slots.label" #label="s"><slot name="label" v-bind="s" /></template>
      <template v-if="$slots.bar" #bar="s"><slot name="bar" v-bind="s" /></template>
    </BarList>
  </div>
  <div v-else class="bar-box">
    <ul :class="cls ? `bar-list ${cls}` : 'bar-list'">
      <li v-for="r in parts[0]" :key="r.key">
        <span class="row-name" :title="r.to ? undefined : r.label || undefined">
          <slot name="label" :row="r">
            <EntityLink v-if="r.to" :to="r.to">{{ r.label }}</EntityLink>
            <template v-else>{{ r.label }}</template>
          </slot>
          <span v-if="r.sub" class="row-sub">{{ r.sub }}</span>
        </span>
        <span class="row-value"><template v-if="r.arrow"><span :class="`tri tri-${r.arrow}`" :style="{ color: r.color }" aria-hidden="true" />{{ ' ' }}</template>{{ r.text }}</span>
        <slot v-if="$slots.bar" name="bar" :row="r" />
        <div v-else class="hbar" :role="r.tip ? 'img' : undefined" :aria-label="r.tip" @pointerenter="r.tip && tooltip.show({ title: r.tip }, $event)" @pointermove="r.tip && tooltip.show({ title: r.tip }, $event)" @pointerleave="r.tip && tooltip.hide()">
          <div class="hbar-track"><div class="hbar-fill" :style="{ width: width(r.value), background: r.color }" /><span v-if="r.marker !== undefined" class="bar-marker" :style="{ left: width(r.marker) }" /></div>
        </div>
      </li>
    </ul>
  </div>
</template>
