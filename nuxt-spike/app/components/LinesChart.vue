<script setup lang="ts">
import { line, curveMonotoneX } from 'd3-shape'
import { scaleLinear } from 'd3-scale'
import { useElementSize } from '@vueuse/core'
import type { Series } from '~/types/topics'

const props = defineProps<{ dates: string[], series: Series[], caption: string }>()
const tooltip = useTooltipStore()

const holder = ref<HTMLElement | null>(null)
const { width: measured } = useElementSize(holder)
const width = computed(() => measured.value || 640)
const height = computed(() => (width.value < 520 ? 190 : width.value < 640 ? 280 : 380))
const labelled = computed(() => width.value >= 520)
const pad = computed(() => ({ top: 10, right: labelled.value ? (width.value >= 700 ? 205 : 135) : 12, bottom: 24, left: 44 }))
const n = computed(() => props.dates.length)
const plotW = computed(() => width.value - pad.value.left - pad.value.right)
const plotH = computed(() => height.value - pad.value.top - pad.value.bottom)

const peak = computed(() => Math.max(...props.series.flatMap(s => s.values), 1))
const step = computed(() => niceStep(peak.value / (height.value < 300 ? 4 : 6)))
const yMax = computed(() => Math.ceil(peak.value / step.value) * step.value)
const x = computed(() => scaleLinear([0, Math.max(n.value - 1, 1)], [pad.value.left, pad.value.left + plotW.value]))
const y = computed(() => scaleLinear([0, yMax.value], [pad.value.top + plotH.value, pad.value.top]))
const ticks = computed(() => y.value.ticks(Math.round(yMax.value / step.value)))
const xTicks = computed(() => {
  const per = plotW.value / Math.max(n.value - 1, 1)
  const fit = Math.max(1, Math.ceil(72 / per))
  const every = fit > 7 ? Math.ceil(fit / 7) * 7 : fit
  return props.dates.map((d, i) => ({ d, i })).filter(t => t.i % every === 0)
})

const path = computed(() => {
  const gen = line<number>().x((_, i) => x.value(i)).y(v => y.value(v)).curve(curveMonotoneX)
  return props.series.map(s => ({ s, d: gen(s.values) ?? '' }))
})

// The name of a line sits at its end. Where two ends are closer than 13 px, the names move apart.
const ends = computed(() => {
  if (!labelled.value) return []
  const marks = props.series.map(s => ({ s, at: y.value(s.values[n.value - 1] ?? 0), y: y.value(s.values[n.value - 1] ?? 0) })).sort((a, b) => a.y - b.y)
  for (let round = 0; round < 40; round++) {
    let moved = false
    for (let k = 1; k < marks.length; k++) {
      const miss = 13 - (marks[k]!.y - marks[k - 1]!.y)
      if (miss > 0.1) { marks[k - 1]!.y -= miss / 2; marks[k]!.y += miss / 2; moved = true }
    }
    if (!moved) break
  }
  return marks
})
const maxChars = computed(() => (width.value >= 700 ? 32 : 17))
const cut = (s: string) => (s.length > maxChars.value ? `${s.slice(0, maxChars.value - 1)}…` : s)

const hover = ref<number | null>(null)
const onMove = (e: PointerEvent) => {
  const box = (e.currentTarget as SVGElement).ownerSVGElement!.getBoundingClientRect()
  const i = Math.max(0, Math.min(n.value - 1, Math.round(((e.clientX - box.left - pad.value.left) / plotW.value) * (n.value - 1))))
  hover.value = i
  tooltip.show({
    title: fmtDay(props.dates[i]!),
    rows: props.series.map(s => ({ label: s.name, value: fmtInt(Math.round(s.values[i] ?? 0)), color: s.color })).sort((a, b) => Number(b.value.replace(/\D/g, '')) - Number(a.value.replace(/\D/g, '')))
  }, e)
}
const onLeave = () => { hover.value = null; tooltip.hide() }
</script>

<template>
  <div ref="holder" class="w-full">
    <svg class="line-draw block" :width="width" :height="height" :viewBox="`0 0 ${width} ${height}`" role="img" :aria-label="caption">
      <g class="text-xs">
        <template v-for="v in ticks" :key="v">
          <line :x1="pad.left" :x2="width - pad.right" :y1="y(v)" :y2="y(v)" stroke="var(--border)" stroke-width="1" />
          <text :x="pad.left - 6" :y="y(v) + 4" text-anchor="end" fill="var(--text-secondary)">{{ fmtInt(v) }}</text>
        </template>
        <text v-for="t in xTicks" :key="t.d" :x="x(t.i)" :y="height - 6" text-anchor="middle" fill="var(--text-secondary)">{{ fmtDay(t.d) }}</text>
      </g>
      <path v-for="p in path.toReversed()" :key="p.s.key" class="line-series" :d="p.d" :stroke="p.s.color" stroke-width="1.5" pathLength="1" />
      <g v-for="m in ends" :key="m.s.key" class="text-xs">
        <circle :cx="x(n - 1)" :cy="m.at" r="3" :fill="m.s.color" />
        <line v-if="Math.abs(m.y - m.at) > 6" :x1="x(n - 1)" :y1="m.at" :x2="x(n - 1) + 8" :y2="m.y" :stroke="m.s.color" />
        <NuxtLink :to="`/topic/${m.s.key}`"><text :x="x(n - 1) + 10" :y="m.y + 4" fill="currentColor">{{ cut(m.s.name) }}<title>{{ m.s.name }}</title></text></NuxtLink>
      </g>
      <template v-if="hover !== null">
        <line :x1="x(hover)" :x2="x(hover)" :y1="pad.top" :y2="pad.top + plotH" stroke="var(--rule)" />
        <circle v-for="s in series" :key="s.key" :cx="x(hover)" :cy="y(s.values[hover] ?? 0)" r="3.5" :fill="s.color" stroke="var(--surface-page)" stroke-width="1.5" />
      </template>
      <rect :x="pad.left" :y="pad.top" :width="plotW" :height="plotH" fill="transparent" @pointermove="onMove" @pointerleave="onLeave" />
    </svg>
  </div>
</template>
