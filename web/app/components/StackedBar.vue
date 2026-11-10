<script setup lang="ts">
// UI.StackedBar of assets/components.js without the legend: the parts of one whole.
const props = defineProps<{ segments: { label: string, value: number, color: string }[] }>()
const tooltip = useTooltipStore()
const total = computed(() => props.segments.reduce((s, x) => s + (x.value || 0), 0))
const text = computed(() => props.segments.map(s => `${s.label} ${fmtPct(total.value ? s.value / total.value : 0)}`).join(', '))
const show = (e: PointerEvent) => tooltip.show({ title: text.value }, e)
</script>

<template>
  <div :class="total ? 'stacked' : 'stacked is-empty'" role="img" :aria-label="text" @pointerenter="show" @pointermove="show" @pointerleave="tooltip.hide()">
    <span v-for="s in segments.filter(x => x.value > 0)" :key="s.label" :style="{ width: `${(s.value / total) * 100}%`, background: s.color }" />
  </div>
</template>
