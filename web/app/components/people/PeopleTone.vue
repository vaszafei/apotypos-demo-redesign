<script setup lang="ts">
import { useElementSize } from '@vueuse/core'
import { nameSpot, netPoints, type NameBox } from '~/utils/people'

// PeopleScatter of assets/mme.js: one dot for each person, the tone across, the statements up (per 1,000 articles), the size is the articles about the person. Every dot has its name.
export interface TonePoint { name: string, net: number, rate: number, n: number }
const props = defineProps<{ points: TonePoint[] }>()
const { t } = useI18n()
const tooltip = useTooltipStore()
const netColor = useNetColor()

const holder = ref<HTMLElement | null>(null)
const { width: measured } = useElementSize(holder)
const width = computed(() => Math.floor(measured.value) || 640)
const height = 392
const pad = { l: 40, r: 14, t: 30, b: 40 }
const xmax = computed(() => Math.max(25, Math.ceil(Math.max(...props.points.map(p => Math.abs(p.net * 100)), 0) / 25) * 25))
const ymax = computed(() => Math.max(10, Math.ceil((Math.max(...props.points.map(p => p.rate), 0) * 1.2) / 10) * 10))
const nmax = computed(() => Math.max(...props.points.map(p => p.n), 1))
const sx = (v: number) => pad.l + ((v + xmax.value) / (2 * xmax.value)) * (width.value - pad.l - pad.r)
const sy = (v: number) => height - pad.b - (v / ymax.value) * (height - pad.t - pad.b)
const radius = (p: TonePoint) => 5 + 11 * Math.sqrt(p.n / nmax.value)
const xTicks = computed(() => [-xmax.value, -xmax.value / 2, 0, xmax.value / 2, xmax.value])
const yTicks = computed(() => [0, ymax.value / 2, ymax.value])
const tip = (p: TonePoint) => t('mme.panel.both.row', { outlet: p.name, net: netPoints(p.net), rate: fmtDec(p.rate), n: fmtInt(p.n) })

// The names: the corner labels and the dots are taken first; the largest dot is named first.
const dots = computed(() => props.points.slice().sort((a, b) => b.n - a.n))
const names = computed(() => {
  const placed: NameBox[] = [{ x0: pad.l, x1: pad.l + 240, y0: height - pad.b - 24, y1: height - pad.b }, { x0: width.value - pad.r - 240, x1: width.value - pad.r, y0: height - pad.b - 24, y1: height - pad.b }]
  const free = (b: NameBox) => b.x0 >= 0 && b.x1 <= width.value && !placed.some(q => b.x0 < q.x1 && b.x1 > q.x0 && b.y0 < q.y1 && b.y1 > q.y0)
  for (const p of props.points) placed.push({ x0: sx(p.net * 100) - radius(p), x1: sx(p.net * 100) + radius(p), y0: sy(p.rate) - radius(p), y1: sy(p.rate) + radius(p) })
  return dots.value.map((p) => {
    const spot = nameSpot(sx(p.net * 100), sy(p.rate), radius(p), p.name.length * 6.4, free)
    placed.push(spot.b)
    return { name: p.name, x: spot.x, y: spot.y, anchor: spot.anchor }
  })
})
</script>

<template>
  <div ref="holder" class="fit">
    <svg class="chart" :width="width" :height="height" :viewBox="`0 0 ${width} ${height}`" aria-hidden="true">
      <template v-for="v in xTicks" :key="`x${v}`">
        <line :class="v === 0 ? 'zero-line' : 'grid-line'" :x1="sx(v)" :x2="sx(v)" :y1="pad.t" :y2="height - pad.b" />
        <text :x="sx(v)" :y="height - pad.b + 16" text-anchor="middle">{{ v === 0 ? '0' : netPoints(v / 100) }}</text>
      </template>
      <template v-for="v in yTicks" :key="`y${v}`">
        <line class="grid-line" :x1="pad.l" :x2="width - pad.r" :y1="sy(v)" :y2="sy(v)" />
        <text :x="pad.l - 6" :y="sy(v) + 4" text-anchor="end">{{ fmtDec(v) }}</text>
      </template>
      <text class="pt-label" :x="(pad.l + width - pad.r) / 2" :y="height - 6" text-anchor="middle">{{ t('mme.panel.axis.tone') }}</text>
      <text class="q-label" :x="pad.l" y="14" text-anchor="start">{{ t('mme.panel.axis.voice') }}</text>
      <text class="q-label" :x="pad.l + 6" :y="height - pad.b - 8" text-anchor="start">{{ t('mme.panel.q.ll') }}</text>
      <text class="q-label" :x="width - pad.r - 6" :y="height - pad.b - 8" text-anchor="end">{{ t('mme.panel.q.lr') }}</text>
      <circle
        v-for="p in dots" :key="p.name" class="pt" :cx="sx(p.net * 100)" :cy="sy(p.rate)" :r="radius(p)" :fill="netColor(p.net).background" fill-opacity="0.92"
        style="stroke: var(--text-secondary); stroke-opacity: 0.55; stroke-width: 1"
        @pointerenter="tooltip.show({ title: tip(p) }, $event)" @pointermove="tooltip.show({ title: tip(p) }, $event)" @pointerleave="tooltip.hide()"
      />
      <text v-for="l in names" :key="l.name" class="pt-label" :x="l.x" :y="l.y" :text-anchor="l.anchor">{{ l.name }}</text>
    </svg>
    <div class="visually-hidden">
      <table>
        <caption>{{ t('mme.both.title') }}</caption>
        <tbody><tr v-for="p in points" :key="p.name"><th scope="row">{{ p.name }}</th><td>{{ tip(p) }}</td></tr></tbody>
      </table>
    </div>
  </div>
</template>
