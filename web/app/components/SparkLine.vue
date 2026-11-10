<script setup lang="ts">
// Dash.Spark of assets/dash.js: the whole window in gray and the chosen days in the accent color.
const props = withDefaults(defineProps<{ values: number[], from: number, to: number, label: string, width?: number, height?: number }>(), { width: 96, height: 28 })
const max = computed(() => Math.max(...props.values, 1))
const x = (i: number) => 1 + (i / Math.max(props.values.length - 1, 1)) * (props.width - 2)
const y = (v: number) => props.height - 2 - (v / max.value) * (props.height - 4)
const path = (from: number, to: number) => props.values.slice(from, to + 1).map((v, k) => `${k ? 'L' : 'M'}${x(from + k).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')
</script>

<template>
  <svg class="spark" :width="width" :height="height" :viewBox="`0 0 ${width} ${height}`" role="img" :aria-label="label">
    <path class="spark-base" :d="path(0, values.length - 1)" />
    <path class="spark-range" :d="path(from, to)" />
  </svg>
</template>
