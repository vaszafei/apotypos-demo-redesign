<script setup lang="ts">
import { useElementSize } from '@vueuse/core'
import type { StancePoint } from '~/types/mme'
import type { Box } from '~/utils/stance-labels'

// StanceMap of media-v2.html (Πώς γράφουν για την κυβέρνηση): one dot for each outlet. x = critical share, y = supportive share, the rest up to 100% is neutral.
// The dot is sized by its articles and colored by its group. The zones are where one share is the largest; they meet where the three shares are a third each.
const props = defineProps<{ points: StancePoint[], avg: { c: number, s: number }, caption: string }>()
const { t } = useI18n()
const tooltip = useTooltipStore()

const holder = ref<HTMLElement | null>(null)
const { width: measured } = useElementSize(holder)
const width = computed(() => Math.floor(measured.value) || 640)
// On a phone the names of the zones and the notes about the averages inside the plot are left out; the card then has a key of the three zones.
const narrow = computed(() => width.value < 640)
const height = computed(() => (narrow.value ? 380 : Math.max(420, Math.min(560, Math.round(width.value * 0.46)))))
const pad = computed(() => ({ top: 14, right: narrow.value ? 14 : 22, bottom: 54, left: narrow.value ? 56 : 66 }))
const step = computed(() => (narrow.value ? 0.2 : 0.1))
const plotW = computed(() => width.value - pad.value.left - pad.value.right)
const plotH = computed(() => height.value - pad.value.top - pad.value.bottom)

// The axes start and end near the data, so that the dots spread over the whole plot and more of them have room for a name.
const ext = computed(() => {
  const cs = props.points.map(p => p.c)
  const ss = props.points.map(p => p.s)
  return {
    x0: Math.max(0, Math.floor((Math.min(...cs) - 0.03) * 10) / 10), xm: Math.min(1, Math.ceil((Math.max(...cs) + 0.03) * 10) / 10),
    y0: Math.max(0, Math.floor((Math.min(...ss) - 0.02) * 10) / 10), ym: Math.min(1, Math.ceil((Math.max(...ss) + 0.03) * 10) / 10)
  }
})
const sx = (v: number) => pad.value.left + ((v - ext.value.x0) / (ext.value.xm - ext.value.x0)) * plotW.value
const sy = (v: number) => pad.value.top + plotH.value - ((v - ext.value.y0) / (ext.value.ym - ext.value.y0)) * plotH.value
const maxN = computed(() => Math.max(...props.points.map(p => p.n)))
const radius = (p: StancePoint) => 4 + 8 * Math.sqrt(p.n / maxN.value)
const text = (p: StancePoint) => t('mme.map.point', { name: p.name, c: fmtPct(p.c), u: fmtPct(p.u), s: fmtPct(p.s), n: fmtInt(p.n) })
const pct0 = (v: number) => `${Math.round(v * 100)}%`

const ticks = (from: number, to: number) => {
  const out: number[] = []
  for (let v = Math.ceil(from / step.value - 1e-9) * step.value; v <= to + 1e-9; v += step.value) out.push(v)
  return out
}
const yTicks = computed(() => ticks(ext.value.y0, ext.value.ym))
const xTicks = computed(() => ticks(ext.value.x0, ext.value.xm))

const third = 1 / 3
const poly = (pts: [number, number][]) => `M${pts.map(([c, s]) => `${sx(c).toFixed(1)},${sy(s).toFixed(1)}`).join('L')}Z`
const zones = computed(() => [
  { d: poly([[third, third], [0.5, 0], [1, 0], [0.5, 0.5]]), color: 'var(--stance-critical)' },
  { d: poly([[third, third], [0, 0.5], [0, 1], [0.5, 0.5]]), color: 'var(--stance-supportive)' },
  { d: poly([[0, 0], [0.5, 0], [third, third], [0, 0.5]]), color: 'var(--stance-neutral)' }
])
const diagonals: [number, number, number, number][] = [[third, third, 0.5, 0.5], [third, third, 0.5, 0], [third, third, 0, 0.5]]

const avgCrit = computed(() => t('mme.gov.avg', { v: pct0(props.avg.c) }))
const avgSupp = computed(() => t('mme.map.avg.supp', { v: pct0(props.avg.s) }))
const labels = computed(() => {
  const { left, top } = pad.value
  const right = width.value - pad.value.right
  const bottom = top + plotH.value
  const boxes: Box[] = []
  if (!narrow.value) {
    const wide = (key: string) => t(key).length * 7
    boxes.push(
      { x0: right - 8 - wide('mme.map.zone.crit'), x1: right - 8, y0: bottom - 26, y1: bottom - 4 },
      { x0: left + 8, x1: left + 8 + wide('mme.map.zone.supp'), y0: top + 2, y1: top + 22 },
      { x0: left + 8, x1: left + 8 + wide('mme.map.zone.neutral'), y0: bottom - 26, y1: bottom - 4 },
      { x0: sx(props.avg.c) + 6, x1: sx(props.avg.c) + 6 + avgCrit.value.length * 6.6, y0: bottom - 24, y1: bottom - 6 },
      { x0: right - 6 - avgSupp.value.length * 6.6, x1: right - 6, y0: sy(props.avg.s) - 20, y1: sy(props.avg.s) - 2 }
    )
  }
  return placeLabels(props.points.map(p => ({ name: p.name, n: p.n, x: sx(p.c), y: sy(p.s), r: radius(p) })), boxes, { x0: left, x1: right, y0: top, y1: bottom })
})
const dots = computed(() => props.points.slice().sort((a, b) => b.n - a.n))

const picked = ref<string | null>(null)
const show = (p: StancePoint, e: PointerEvent) => { picked.value = p.name; tooltip.show({ title: text(p) }, e) }
const leave = () => { picked.value = null; tooltip.hide() }
const clip = `stance-clip-${useId()}`
</script>

<template>
  <div ref="holder" class="fit">
    <svg class="chart" :width="width" :height="height" :viewBox="`0 0 ${width} ${height}`" aria-hidden="true">
      <clipPath :id="clip"><rect :x="pad.left" :y="pad.top" :width="plotW" :height="plotH" /></clipPath>
      <template v-for="v in yTicks" :key="`y${v}`">
        <line class="grid-line" :x1="pad.left" :x2="width - pad.right" :y1="sy(v)" :y2="sy(v)" />
        <text :x="pad.left - 8" :y="sy(v) + 4" text-anchor="end">{{ pct0(v) }}</text>
      </template>
      <text v-for="v in xTicks" :key="`x${v}`" :x="sx(v)" :y="pad.top + plotH + 18" text-anchor="middle">{{ pct0(v) }}</text>
      <text class="axis-title" :x="pad.left + plotW / 2" :y="height - 8" text-anchor="middle">{{ t('mme.map.x') }}</text>
      <text class="axis-title" :transform="`translate(16 ${pad.top + plotH / 2}) rotate(-90)`" text-anchor="middle">{{ t('mme.map.y') }}</text>

      <g :clip-path="`url(#${clip})`">
        <path v-for="z in zones" :key="z.color" :d="z.d" :style="`fill:color-mix(in srgb, ${z.color} 13%, transparent)`" />
        <line v-for="(d, i) in diagonals" :key="i" class="grid-line" style="stroke-width:1.5" :x1="sx(d[0])" :y1="sy(d[1])" :x2="sx(d[2])" :y2="sy(d[3])" />
      </g>
      <template v-if="!narrow">
        <text class="axis-title" style="font-weight:600" :x="width - pad.right - 8" :y="pad.top + plotH - 10" text-anchor="end">{{ t('mme.map.zone.crit') }}</text>
        <text class="axis-title" style="font-weight:600" :x="pad.left + 8" :y="pad.top + 16">{{ t('mme.map.zone.supp') }}</text>
        <text class="axis-title" style="font-weight:600" :x="pad.left + 8" :y="pad.top + plotH - 10">{{ t('mme.map.zone.neutral') }}</text>
      </template>

      <line class="avg-line" :x1="sx(avg.c)" :x2="sx(avg.c)" :y1="pad.top" :y2="pad.top + plotH" />
      <line class="avg-line" :x1="pad.left" :x2="width - pad.right" :y1="sy(avg.s)" :y2="sy(avg.s)" />
      <template v-if="!narrow">
        <text class="axis-title" :x="sx(avg.c) + 6" :y="pad.top + plotH - 10">{{ avgCrit }}</text>
        <text class="axis-title" :x="width - pad.right - 6" :y="sy(avg.s) - 6" text-anchor="end">{{ avgSupp }}</text>
      </template>

      <g>
        <line v-for="l in labels.filter(x => x.leader)" :key="l.name" :x1="l.leader!.x1" :y1="l.leader!.y1" :x2="l.leader!.x2" :y2="l.leader!.y2" style="stroke:var(--text-secondary);stroke-width:0.75;opacity:0.7" />
      </g>
      <circle
        v-for="p in dots" :key="p.name" class="pt" :cx="sx(p.c)" :cy="sy(p.s)" :r="radius(p)" :fill="p.color" :style="picked ? (picked === p.name ? 'opacity:1' : 'opacity:0.3') : undefined"
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
