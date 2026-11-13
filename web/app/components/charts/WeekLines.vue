<script setup lang="ts">
import { useElementSize } from '@vueuse/core'

// Politics.LineChart of assets/politics.js with the labels in a legend above (no end labels): lines on one axis, smooth curves, a week with no value is a gap in the line.
// The hover line gives all values of one point. tips[i] names the point (labels[i] if there is none). yFormat writes the values of the axis and of the tooltip.
export interface WeekSeries { label: string, color: string, values: (number | null)[] }
const props = withDefaults(defineProps<{ labels: string[], tips?: string[], series: WeekSeries[], height?: number, zero?: boolean, yFormat: (v: number) => string, aria: string }>(), { height: 240 })
const tooltip = useTooltipStore()
const FRAME = { top: 12, left: 44, bottom: 24, right: 20, labelGap: 16, labelEvery: 64 }

const holder = ref<HTMLElement | null>(null)
const { width: measured } = useElementSize(holder)
const width = computed(() => Math.floor(measured.value))
const plotW = computed(() => width.value - FRAME.left - FRAME.right)
const plotH = computed(() => props.height - FRAME.top - FRAME.bottom)

const scale = computed(() => {
  const all = props.series.flatMap(s => s.values).filter((v): v is number => v !== null)
  let lo = Math.min(...all, props.zero ? 0 : Infinity)
  let hi = Math.max(...all, props.zero ? 0 : -Infinity)
  if (lo === hi) { lo -= 1; hi += 1 }
  const step = niceStep((hi - lo) / 4)
  return { lo: Math.floor(lo / step) * step, hi: Math.ceil(hi / step) * step, step }
})
const x = (i: number) => FRAME.left + (props.labels.length === 1 ? plotW.value / 2 : (i / Math.max(props.labels.length - 1, 1)) * plotW.value)
const y = (v: number) => FRAME.top + plotH.value - ((v - scale.value.lo) / (scale.value.hi - scale.value.lo)) * plotH.value

const grid = computed(() => {
  const out: number[] = []
  for (let v = scale.value.lo; v <= scale.value.hi + scale.value.step / 2; v += scale.value.step) out.push(v)
  return out
})
// The labels of the x axis: every n-th point and the last one. A label that would touch the last one is left out.
const shown = computed(() => {
  const n = props.labels.length
  const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(plotW.value / FRAME.labelEvery))))
  const out: number[] = []
  for (let i = 0; i < n; i++) {
    if (!(i % every === 0 || i === n - 1)) continue
    const prev = out[out.length - 1]
    if (prev !== undefined && x(i) - x(prev) < FRAME.labelEvery) { if (i !== n - 1) continue; out.pop() }
    out.push(i)
  }
  return out
})
// A smooth curve for each run of values: a missing value starts a new one.
const paths = computed(() => props.series.map((s) => {
  const runs: [number, number][][] = []
  let run: [number, number][] = []
  s.values.forEach((v, i) => {
    if (v === null) { if (run.length) runs.push(run); run = []; return }
    run.push([x(i), y(v)])
  })
  if (run.length) runs.push(run)
  return { s, d: runs.map(smoothPath).join('') }
}))

const hover = ref<number | null>(null)
const read = (e: PointerEvent) => {
  const box = (e.currentTarget as SVGElement).ownerSVGElement!.getBoundingClientRect()
  const px = e.clientX - box.left
  const i = props.labels.reduce((best, _, k) => (Math.abs(x(k) - px) < Math.abs(x(best) - px) ? k : best), 0)
  hover.value = i
  tooltip.show({ title: [props.tips ? props.tips[i] : props.labels[i], ...props.series.map(s => `${s.label}: ${s.values[i] === null ? '–' : props.yFormat(s.values[i]!)}`)].join(' · ') }, e)
}
const leave = () => { hover.value = null; tooltip.hide() }
</script>

<template>
  <div ref="holder" class="fit">
    <svg v-if="width" class="chart" :width="width" :height="height" :viewBox="`0 0 ${width} ${height}`" role="img" :aria-label="aria">
      <template v-for="v in grid" :key="v">
        <line :class="v === 0 && scale.lo < 0 ? 'zero-line' : 'grid-line'" :x1="FRAME.left" :x2="FRAME.left + plotW" :y1="y(v)" :y2="y(v)" />
        <text :x="FRAME.left - 6" :y="y(v) + 4" text-anchor="end">{{ yFormat(v) }}</text>
      </template>
      <text v-for="i in shown" :key="i" :x="x(i)" :y="FRAME.top + plotH + FRAME.labelGap" text-anchor="middle">{{ labels[i] }}</text>
      <path v-for="p in paths" :key="p.s.label" :d="p.d" fill="none" :stroke="p.s.color" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
      <line class="line-guide" :x1="hover !== null ? x(hover) : 0" :x2="hover !== null ? x(hover) : 0" :y1="FRAME.top" :y2="FRAME.top + plotH" :visibility="hover !== null ? 'visible' : 'hidden'" />
      <circle
        v-for="s in series" :key="s.label" class="line-dot" r="3.5" :fill="s.color"
        :cx="hover !== null ? x(hover) : undefined" :cy="hover !== null && s.values[hover] !== null ? y(s.values[hover]!) : undefined"
        :visibility="hover !== null && s.values[hover] !== null ? 'visible' : 'hidden'"
      />
      <rect class="hit" :x="FRAME.left" :y="FRAME.top" :width="plotW" :height="plotH" @pointermove="read" @pointerleave="leave" />
    </svg>
  </div>
</template>
