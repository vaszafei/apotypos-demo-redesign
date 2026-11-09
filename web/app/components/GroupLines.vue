<script setup lang="ts">
import { useElementSize } from '@vueuse/core'
import type { NetGroup } from '~/utils/groups'

// VolumeChart of groups-v2.html: a line for each group, the articles of each day, on a square-root scale so the groups with few articles can be read beside the one with the most.
// A gap day of the collection has a band and breaks the lines. A hover reads the day for every group.
const props = defineProps<{ dates: string[], stacks: { g: NetGroup, value: number }[][] }>()
const { t } = useI18n()
const tooltip = useTooltipStore()

const holder = ref<HTMLElement | null>(null)
const { width: measured } = useElementSize(holder)
const width = computed(() => Math.floor(measured.value) || 640)
const height = 230
const pad = { top: 10, right: 12, bottom: 24, left: 44 }
const plotW = computed(() => width.value - pad.left - pad.right)
const plotH = height - pad.top - pad.bottom
const n = computed(() => props.dates.length)
const step = computed(() => plotW.value / (n.value - 1))

const totals = computed(() => props.stacks.map(day => day.reduce((a, x) => a + x.value, 0)))
const gapDay = computed(() => totals.value.map(v => v < GAP))
const groups = computed(() => props.stacks[0]?.map(x => x.g) ?? [])

const STEPS = [100, 250, 500, 1000, 1500, 2000, 3000, 5000, 8000, 10000]
const peak = computed(() => Math.max(1, ...props.stacks.flatMap((day, i) => (gapDay.value[i] ? [] : day.map(x => x.value)))))
const yMax = computed(() => STEPS.find(v => v >= peak.value) ?? Math.ceil(peak.value / 1000) * 1000)
const X = (i: number) => pad.left + (i / (n.value - 1)) * plotW.value
const Y = (v: number) => pad.top + plotH - (Math.sqrt(v) / Math.sqrt(yMax.value)) * plotH

// The ticks from the top down, each at least 20 px under the one before, and the zero.
const ticks = computed(() => {
  const kept: number[] = []
  ;[...STEPS.filter(v => v <= yMax.value), 50].sort((a, b) => b - a).forEach((v) => { if (!kept.length || Y(v) - Y(kept[kept.length - 1]!) >= 20) kept.push(v) })
  return [...kept.filter(v => Y(0) - Y(v) >= 20), 0]
})
const every = computed(() => Math.max(1, Math.ceil(72 / step.value / 7)) * 7)
const xTicks = computed(() => { const out: { d: string, i: number }[] = []; for (let i = 0; i < n.value; i += every.value) out.push({ d: props.dates[i]!, i }); return out })

// The outlets with no group are drawn first, so the groups are over them.
const paths = computed(() => groups.value.map((g, k) => k).reverse().map((k) => {
  const runs: [number, number][][] = []
  props.stacks.forEach((day, i) => {
    if (gapDay.value[i]) { runs.push([]); return }
    if (!runs.length) runs.push([])
    runs[runs.length - 1]!.push([X(i), Y(day[k]!.value)])
  })
  const g = groups.value[k]!
  return { g, d: runs.filter(r => r.length).map(smoothPath).join('') }
}))

const hover = ref<number | null>(null)
const read = (e: PointerEvent) => {
  const box = (e.currentTarget as SVGElement).ownerSVGElement!.getBoundingClientRect()
  const i = Math.max(0, Math.min(n.value - 1, Math.round(((e.clientX - box.left - pad.left) / plotW.value) * (n.value - 1))))
  hover.value = i
  tooltip.show({
    title: t('g2.volume.tip', { date: fmtDate(props.dates[i]!), n: fmtInt(totals.value[i]!) }),
    rows: props.stacks[i]!.filter(x => x.value).slice().sort((x, y) => y.value - x.value).map(x => ({ label: x.g.key === null ? t('media2.groups.none') : shortName(x.g.label), value: fmtInt(x.value), color: x.g.color })),
    note: gapDay.value[i] ? t('g2.volume.gap') : null
  }, e)
}
const leave = () => { hover.value = null; tooltip.hide() }
</script>

<template>
  <div ref="holder" class="fit">
    <svg class="chart" :width="width" :height="height" :viewBox="`0 0 ${width} ${height}`" role="img" :aria-label="t('g2.volume.title')">
      <template v-for="v in ticks" :key="v">
        <line class="grid-line" :x1="pad.left" :x2="width - pad.right" :y1="Y(v)" :y2="Y(v)" />
        <text :x="pad.left - 6" :y="Y(v) + 4" text-anchor="end">{{ fmtInt(v) }}</text>
      </template>
      <text v-for="x in xTicks" :key="x.d" :x="X(x.i)" :y="height - 6" text-anchor="middle">{{ fmtDay(x.d) }}</text>
      <template v-for="(gap, i) in gapDay" :key="i">
        <rect v-if="gap" :x="X(i) - step / 2" :y="pad.top" :width="step" :height="plotH" fill="var(--bar-track)" opacity="0.8" />
      </template>
      <path
        v-for="p in paths" :key="p.g.key ?? 'none'" :d="p.d" fill="none" :stroke="p.g.color" :stroke-width="p.g.key === null ? 1.25 : 1.5"
        stroke-linejoin="round" stroke-linecap="round" :opacity="p.g.key === null ? 0.75 : 1"
      />
      <line class="hover-rule" :y1="pad.top" :y2="pad.top + plotH" stroke="var(--rule)" stroke-width="1" :x1="hover !== null ? X(hover) : 0" :x2="hover !== null ? X(hover) : 0" :visibility="hover !== null ? 'visible' : 'hidden'" />
      <circle
        v-for="(g, k) in groups" :key="g.key ?? 'none'" r="3.5" :fill="g.color" stroke="var(--surface-page)" stroke-width="1.5"
        :cx="hover !== null ? X(hover) : 0" :cy="hover !== null ? Y(stacks[hover]![k]!.value) : 0" :visibility="hover !== null && !gapDay[hover] ? 'visible' : 'hidden'"
      />
      <rect :x="pad.left" :y="pad.top" :width="plotW" :height="plotH" fill="transparent" @pointermove="read" @pointerenter="read" @pointerleave="leave" />
    </svg>
    <div class="visually-hidden">
      <table>
        <caption>{{ t('g2.volume.title') }}</caption>
        <tbody>
          <tr v-for="(dt, i) in dates" :key="dt">
            <th scope="row">{{ fmtDate(dt) }}</th>
            <td>{{ stacks[i]!.filter(x => x.value).map(x => t('g2.volume.tip.group', { group: shortName(x.g.label), n: fmtInt(x.value) })).join(', ') }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
