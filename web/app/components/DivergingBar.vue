<script setup lang="ts">
// UI.DivergingBar of assets/components.js: shares on the two sides of a center line. middle is a share across the line (the neutral stance), half on each side.
// scale is the value that fills half of the track.
const props = withDefaults(defineProps<{ left?: number, middle?: number, right?: number, scale?: number, label?: string }>(), { left: 0, middle: 0, right: 0, scale: 1 })
const tooltip = useTooltipStore()
const COLORS = ['var(--stance-critical)', 'var(--stance-neutral)', 'var(--stance-supportive)']

const half = (v: number) => Math.min(50, (Math.max(0, v) / (props.scale || 1)) * 50)
const parts = computed(() => {
  const m = half(props.middle / 2)
  const l = Math.min(half(props.left), 50 - m)
  const r = Math.min(half(props.right), 50 - m)
  // The outer end of a part is round, the end at the center line or at the next part is square.
  return [
    { from: 50 - m - l, width: l, color: COLORS[0], ends: ['left'] },
    { from: 50 - m, width: 2 * m, color: COLORS[1], ends: [!l && 'left', !r && 'right'].filter(Boolean) as string[] },
    { from: 50 + m, width: r, color: COLORS[2], ends: ['right'] }
  ].filter(p => p.width > 0)
})
const show = (e: PointerEvent) => { if (props.label) tooltip.show({ title: props.label }, e) }
</script>

<template>
  <div class="dbar" :role="label ? 'img' : undefined" :aria-label="label" @pointerenter="show" @pointermove="show" @pointerleave="tooltip.hide()">
    <span v-for="p in parts" :key="p.color" :class="['dbar-seg', ...p.ends.map(e => `is-${e}`)]" :style="{ left: `${p.from}%`, width: `${p.width}%`, background: p.color }" />
    <span class="dbar-mid" />
  </div>
</template>
