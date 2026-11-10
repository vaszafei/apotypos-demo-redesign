<script setup lang="ts">
import { useElementSize } from '@vueuse/core'

// UI.BarChart of assets/components.js for one column a day: the series are stacked from the bottom, the highest day has its value above it,
// and a drag over the days selects a period (not with selectable false). Only the options that Μέσα › Επισκόπηση uses are here.
interface Bars { name: string, color: string, values: (number | null)[] }
const props = withDefaults(defineProps<{ dates: string[], series: Bars[], caption: string, height?: number, tipOf: (i: number) => string, selectable?: boolean }>(), { height: 170, selectable: true })
const emit = defineEmits<{ select: [range: { from: string, to: string }] }>()
const tooltip = useTooltipStore()

const FRAME = { top: 12, left: 44, bottom: 24, right: 8, labelGap: 16, barMax: 8, barRadius: 3, labelEvery: 64 }
const holder = ref<HTMLElement | null>(null)
const { width: measured } = useElementSize(holder)
// A fractional width rounds up in clientWidth, so the drawing would shrink below 12 px. Round down.
const width = computed(() => Math.floor(measured.value) || 640)
const n = computed(() => props.dates.length)
const totals = computed(() => props.dates.map((_, i) => props.series.reduce((a, s) => a + (s.values[i] ?? 0), 0)))

// The peak: the highest total, on up to 3 columns that share it.
const peaks = computed(() => {
  const highest = Math.max(...totals.value)
  if (highest <= 0) return new Set<number>()
  const at = totals.value.map((v, i) => (v === highest ? i : -1)).filter(i => i >= 0)
  return new Set(at.length <= 3 ? at : at.slice(0, 1))
})
const pad = computed(() => ({ top: (peaks.value.size ? 18 : 0) + FRAME.top, right: FRAME.right, bottom: FRAME.bottom, left: FRAME.left }))
const step = computed(() => niceStep(Math.max(...totals.value, 1) / 4))
const top = computed(() => Math.ceil(Math.max(...totals.value, 1) / step.value) * step.value)
const plotW = computed(() => width.value - pad.value.left - pad.value.right)
const plotH = computed(() => props.height - pad.value.top - pad.value.bottom)
const slot = computed(() => plotW.value / n.value)
const barW = computed(() => Math.max(1, Math.min(FRAME.barMax, slot.value * 0.7)))
const radius = computed(() => Math.min(FRAME.barRadius, barW.value / 2))
const Y = (v: number) => pad.value.top + plotH.value - (Math.min(v, top.value) / top.value) * plotH.value

const ticks = computed(() => { const out: number[] = []; for (let v = 0; v <= top.value + step.value / 2; v += step.value) out.push(v); return out })
// 64 px or more between two labels, and a label each week (7, 14 days) on more than 20 days.
const every = computed(() => { const s = Math.ceil(FRAME.labelEvery / slot.value); return n.value > 20 ? Math.ceil(s / 7) * 7 : s })
const labels = computed(() => props.dates.map((d, i) => ({ d, i })).filter(l => l.i % every.value === 0))

// A column has round top corners (a clip path) and a gap of 1 px between its parts.
const uid = useId()
const columns = computed(() => props.dates.map((_, i) => {
  const total = totals.value[i]!
  const bx = pad.value.left + i * slot.value + (slot.value - barW.value) / 2
  const yt = Y(total)
  const yb = Y(0)
  const r = radius.value
  const w = barW.value
  let base = 0
  const parts = total > 0 ? props.series.flatMap((s) => {
    const v = s.values[i] ?? 0
    if (!v) return []
    const gap = base + v < total ? 1 : 0
    const part = { color: s.color, y: Y(base + v), h: Math.max(0.5, Y(base) - Y(base + v) - gap) }
    base += v
    return [part]
  }) : []
  return { i, bx, total, parts, clip: `M${bx} ${yb}V${yt + r}Q${bx} ${yt} ${bx + r} ${yt}H${bx + w - r}Q${bx + w} ${yt} ${bx + w} ${yt + r}V${yb}Z` }
}))
const peakLabels = computed(() => [...peaks.value].map((i) => {
  const x = pad.value.left + i * slot.value + slot.value / 2
  return { i, x: Math.min(width.value - pad.value.right, Math.max(pad.value.left, x)), y: Y(totals.value[i]!) - 6, anchor: x < pad.value.left + 16 ? 'start' : x > width.value - pad.value.right - 16 ? 'end' : 'middle' }
}))

const indexAt = (e: PointerEvent) => {
  const box = (e.currentTarget as SVGElement).ownerSVGElement!.getBoundingClientRect()
  return Math.min(n.value - 1, Math.max(0, Math.floor((e.clientX - box.left - pad.value.left) / slot.value)))
}
const hover = ref<number | null>(null)
const anchor = ref<number | null>(null)
const showAt = (e: PointerEvent) => { const i = indexAt(e); hover.value = i; tooltip.show({ title: props.tipOf(i) }, e); return i }
const leave = () => { hover.value = null; tooltip.hide() }
const band = computed(() => {
  if (anchor.value === null || hover.value === null) return null
  const lo = Math.min(anchor.value, hover.value)
  return { x: pad.value.left + lo * slot.value, w: (Math.max(anchor.value, hover.value) - lo + 1) * slot.value }
})
const down = (e: PointerEvent) => { anchor.value = indexAt(e); (e.currentTarget as SVGElement).setPointerCapture(e.pointerId) }
const up = (e: PointerEvent) => {
  const i = indexAt(e)
  const a = anchor.value
  anchor.value = null
  leave()
  if (props.selectable && a !== null && a !== i) emit('select', { from: props.dates[Math.min(a, i)]!, to: props.dates[Math.max(a, i)]! })
}
</script>

<template>
  <div ref="holder" class="chart-holder">
    <svg class="chart bar-chart" :width="width" :height="height" :viewBox="`0 0 ${width} ${height}`" aria-hidden="true">
      <rect class="bar-hover" :x="hover === null ? 0 : pad.left + hover * slot" :y="pad.top" :width="slot" :height="plotH" :visibility="hover === null ? 'hidden' : 'visible'" />
      <rect class="bar-band" :x="band?.x ?? 0" :y="pad.top" :width="band?.w ?? 0" :height="plotH" :visibility="band ? 'visible' : 'hidden'" />
      <template v-for="v in ticks" :key="v">
        <line class="grid-line" :x1="pad.left" :x2="width - pad.right" :y1="Y(v)" :y2="Y(v)" />
        <text :x="pad.left - 6" :y="Y(v) + 4" text-anchor="end">{{ fmtInt(v) }}</text>
      </template>
      <template v-for="c in columns" :key="c.i">
        <defs v-if="c.total > 0"><clipPath :id="`bc-${uid}-${c.i}`"><path :d="c.clip" /></clipPath></defs>
        <g class="bar-col" :clip-path="c.total > 0 ? `url(#bc-${uid}-${c.i})` : undefined">
          <rect v-for="(p, k) in c.parts" :key="k" :x="c.bx" :y="p.y" :width="barW" :height="p.h" :fill="p.color" />
        </g>
      </template>
      <text v-for="p in peakLabels" :key="p.i" class="bar-top" :x="p.x" :y="p.y" :text-anchor="p.anchor">{{ fmtInt(totals[p.i]!) }}</text>
      <text v-for="l in labels" :key="l.d" :x="pad.left + l.i * slot + slot / 2" :y="pad.top + plotH + FRAME.labelGap" text-anchor="middle">{{ fmtDay(l.d) }}</text>
      <rect
        :class="selectable ? 'bar-hit is-select' : 'bar-hit'" :x="pad.left" :y="pad.top" :width="plotW" :height="plotH"
        @pointermove="showAt" @pointerleave="leave" @pointerdown="selectable && down($event)" @pointerup="up" @pointercancel="anchor = null"
      />
    </svg>
    <div class="visually-hidden">
      <table>
        <caption>{{ caption }}</caption>
        <tbody><tr v-for="(d, i) in dates" :key="d"><th scope="row">{{ fmtDate(d) }}</th><td>{{ tipOf(i) }}</td></tr></tbody>
      </table>
    </div>
  </div>
</template>
