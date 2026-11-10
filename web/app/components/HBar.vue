<script setup lang="ts">
// UI.HBar of assets/components.js: a value on a track, of max. marker: a reference value as a tick. text: a value written before the track. label: the tooltip.
const props = withDefaults(defineProps<{ value: number, max?: number, color?: string, marker?: number, text?: string, label?: string }>(), { max: 1 })
const tooltip = useTooltipStore()
const pct = (v: number) => `${Math.max(0, Math.min(1, v / (props.max || 1))) * 100}%`
const show = (e: PointerEvent) => { if (props.label) tooltip.show({ title: props.label }, e) }
</script>

<template>
  <div class="hbar" :role="label ? 'img' : undefined" :aria-label="label" @pointerenter="show" @pointermove="show" @pointerleave="label && tooltip.hide()">
    <span v-if="text !== undefined" class="bar-value">{{ text }}</span>
    <div class="hbar-track">
      <div class="hbar-fill" :style="{ width: pct(value), background: color }" />
      <span v-if="marker !== undefined" class="bar-marker" :style="{ left: pct(marker) }" />
    </div>
  </div>
</template>
