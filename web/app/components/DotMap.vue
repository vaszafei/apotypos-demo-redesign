<script setup lang="ts" generic="P extends MapPoint">
import { useElementSize } from '@vueuse/core'
import type { Box } from '~/utils/stance-labels'

// DotMap of similarity-v2.html: one dot for each outlet with its name, sized by its articles (n) and colored by its group, with dashed lines at the averages.
// x and y are shares from 0 to 1. text(p) is the tooltip, caption the title of the table for a screen reader.
export interface MapPoint { name: string, x: number, y: number, n: number, color: string }
const props = defineProps<{ points: P[], avg: { x: number, y: number }, xTitle: string, yTitle: string, avgX: string, avgY: string, text: (p: P) => string, caption: string }>()
const tooltip = useTooltipStore()

const holder = ref<HTMLElement | null>(null)
const { width: measured } = useElementSize(holder)
const width = computed(() => Math.floor(measured.value) || 640)
const narrow = computed(() => width.value < 480)
const height = computed(() => (narrow.value ? 340 : 400))
const pad = computed(() => ({ top: 14, right: 20, bottom: 54, left: narrow.value ? 52 : 62 }))
const plotW = computed(() => width.value - pad.value.left - pad.value.right)
const plotH = computed(() => height.value - pad.value.top - pad.value.bottom)
// The axes start and end near the data, so that the dots spread over the whole plot.
const ext = computed(() => {
  const xs = props.points.map(p => p.x)
  const ys = props.points.map(p => p.y)
  return {
    x0: Math.max(0, Math.floor((Math.min(...xs) - 0.03) * 10) / 10), xm: Math.min(1, Math.ceil((Math.max(...xs) + 0.03) * 10) / 10),
    y0: Math.max(0, Math.floor((Math.min(...ys) - 0.03) * 10) / 10), ym: Math.min(1, Math.ceil((Math.max(...ys) + 0.03) * 10) / 10)
  }
})
const sx = (v: number) => pad.value.left + ((v - ext.value.x0) / (ext.value.xm - ext.value.x0)) * plotW.value
const sy = (v: number) => pad.value.top + plotH.value - ((v - ext.value.y0) / (ext.value.ym - ext.value.y0)) * plotH.value
const maxN = computed(() => Math.max(...props.points.map(p => p.n)))
const radius = (p: P) => 5 + 9 * Math.sqrt(p.n / maxN.value)
const stepOf = (range: number) => (range > 0.45 ? 0.1 : 0.05) * (narrow.value ? 2 : 1)
const ticks = (from: number, to: number, step: number) => {
  const out: number[] = []
  for (let v = Math.ceil(from / step - 1e-9) * step; v <= to + 1e-9; v += step) out.push(v)
  return out
}
const yTicks = computed(() => ticks(ext.value.y0, ext.value.ym, stepOf(ext.value.ym - ext.value.y0)))
const xTicks = computed(() => ticks(ext.value.x0, ext.value.xm, stepOf(ext.value.xm - ext.value.x0)))

const labels = computed(() => {
  const { left, top } = pad.value
  const right = width.value - pad.value.right
  const bottom = top + plotH.value
  const boxes: Box[] = [
    { x0: sx(props.avg.x) + 6, x1: sx(props.avg.x) + 6 + props.avgX.length * 6.6, y0: bottom - 22, y1: bottom - 6 },
    { x0: left + 8, x1: left + 8 + props.avgY.length * 6.6, y0: sy(props.avg.y) - 20, y1: sy(props.avg.y) - 2 }
  ]
  return placeLabels(props.points.map(p => ({ name: p.name, n: p.n, x: sx(p.x), y: sy(p.y), r: radius(p) })), boxes, { x0: left, x1: right, y0: top, y1: bottom })
})
const dots = computed(() => props.points.slice().sort((a, b) => b.n - a.n))
const picked = ref<string | null>(null)
const show = (p: P, e: PointerEvent) => { picked.value = p.name; tooltip.show({ title: props.text(p) }, e) }
const leave = () => { picked.value = null; tooltip.hide() }
</script>

<template>
  <div ref="holder" class="fit">
    <svg class="chart" :width="width" :height="height" :viewBox="`0 0 ${width} ${height}`" aria-hidden="true">
      <template v-for="v in yTicks" :key="`y${v}`">
        <line class="grid-line" :x1="pad.left" :x2="width - pad.right" :y1="sy(v)" :y2="sy(v)" />
        <text :x="pad.left - 8" :y="sy(v) + 4" text-anchor="end">{{ fmtPct0(v) }}</text>
      </template>
      <text v-for="v in xTicks" :key="`x${v}`" :x="sx(v)" :y="pad.top + plotH + 18" text-anchor="middle">{{ fmtPct0(v) }}</text>
      <text class="axis-title" :x="pad.left + plotW / 2" :y="height - 8" text-anchor="middle">{{ xTitle }}</text>
      <text class="axis-title" :transform="`translate(16 ${pad.top + plotH / 2}) rotate(-90)`" text-anchor="middle">{{ yTitle }}</text>
      <line class="avg-line" :x1="sx(avg.x)" :x2="sx(avg.x)" :y1="pad.top" :y2="pad.top + plotH" />
      <line class="avg-line" :x1="pad.left" :x2="width - pad.right" :y1="sy(avg.y)" :y2="sy(avg.y)" />
      <text class="axis-title" :x="sx(avg.x) + 6" :y="pad.top + plotH - 8">{{ avgX }}</text>
      <text class="axis-title" :x="pad.left + 8" :y="sy(avg.y) - 6">{{ avgY }}</text>
      <g>
        <line v-for="l in labels.filter(x => x.leader)" :key="l.name" :x1="l.leader!.x1" :y1="l.leader!.y1" :x2="l.leader!.x2" :y2="l.leader!.y2" style="stroke:var(--text-secondary);stroke-width:0.75;opacity:0.7" />
      </g>
      <circle
        v-for="p in dots" :key="p.name" class="pt" :cx="sx(p.x)" :cy="sy(p.y)" :r="radius(p)" :fill="p.color" :style="picked ? (picked === p.name ? 'opacity:1' : 'opacity:0.3') : undefined"
        @pointerenter="show(p, $event)" @pointermove="show(p, $event)" @pointerleave="leave"
      />
      <text v-for="l in labels" :key="l.name" class="pt-label" :x="l.x" :y="l.y" pointer-events="none">{{ l.name }}</text>
    </svg>
    <div class="visually-hidden">
      <table>
        <caption>{{ caption }}</caption>
        <tbody><tr v-for="p in points" :key="p.name"><th scope="row">{{ p.name }}</th><td>{{ text(p) }}</td></tr></tbody>
      </table>
    </div>
  </div>
</template>
