<script setup lang="ts">
import { useElementSize } from '@vueuse/core'
import type { Series } from '~/types/topics'

// Dash.LinesChart of assets/dash.js, same layout and arithmetic: the names sit at the line ends where there is room, else a legend names the lines.
const props = defineProps<{ dates: string[], series: Series[], caption: string }>()
const tooltip = useTooltipStore()

const holder = ref<HTMLElement | null>(null)
const { width: measured } = useElementSize(holder)
const width = computed(() => Math.floor(measured.value) || 640)
const height = computed(() => (width.value < 520 ? 190 : width.value < 640 ? 280 : 380))
const labelled = computed(() => width.value >= 520)
const long = computed(() => width.value >= 700)
const pad = computed(() => ({ top: 10, right: labelled.value ? (long.value ? 205 : 135) : 12, bottom: 24, left: 44 }))
const n = computed(() => props.dates.length)
const plotW = computed(() => width.value - pad.value.left - pad.value.right)
const plotH = computed(() => height.value - pad.value.top - pad.value.bottom)

const peak = computed(() => Math.max(...props.series.flatMap(s => s.values), 1))
const tickStep = computed(() => niceStep(peak.value / (height.value < 300 ? 4 : 6)))
const yMax = computed(() => Math.ceil(peak.value / tickStep.value) * tickStep.value)
const X = (i: number) => pad.value.left + (i / Math.max(n.value - 1, 1)) * plotW.value
const Y = (v: number) => pad.value.top + plotH.value - (v / yMax.value) * plotH.value

const ticks = computed(() => { const t: number[] = []; for (let v = 0; v <= yMax.value; v += tickStep.value) t.push(v); return t })
const xTicks = computed(() => {
  const step = plotW.value / Math.max(n.value - 1, 1)
  const fit = Math.max(1, Math.ceil(72 / step))
  const every = fit > 7 ? Math.ceil(fit / 7) * 7 : fit
  const out: { d: string, i: number }[] = []
  for (let i = 0; i < n.value; i += every) out.push({ d: props.dates[i]!, i })
  return out
})
const paths = computed(() => props.series.slice().reverse().map(s => ({ s, d: smoothPath(s.values.map((v, i) => [X(i), Y(v)] as [number, number])) })))

// Where two ends are less than 13 px apart the names move apart, each by half of what is missing; the names stay inside the plot.
const ends = computed(() => {
  if (!labelled.value) return []
  const marks = props.series.map((s, i) => { const y = Y(s.values[n.value - 1] ?? 0); return { s, i, y, at: y } }).sort((a, b) => a.y - b.y)
  for (let round = 0; round < 40; round++) {
    let moved = false
    for (let k = 1; k < marks.length; k++) {
      const miss = 13 - (marks[k]!.y - marks[k - 1]!.y)
      if (miss > 0.1) { marks[k - 1]!.y -= miss / 2; marks[k]!.y += miss / 2; moved = true }
    }
    if (!moved) break
  }
  const [lo, hi] = [pad.value.top + 4, pad.value.top + plotH.value + 4]
  for (let k = marks.length - 1; k >= 0; k--) marks[k]!.y = Math.min(marks[k]!.y, k === marks.length - 1 ? hi : marks[k + 1]!.y - 13)
  for (let k = 0; k < marks.length; k++) marks[k]!.y = Math.max(marks[k]!.y, k === 0 ? lo : marks[k - 1]!.y + 13)
  return marks
})
const maxChars = computed(() => (long.value ? 32 : 17))
const cut = (s: string) => (s.length > maxChars.value ? `${s.slice(0, maxChars.value - 1)}…` : s)

const hover = ref<number | null>(null)
const read = (e: PointerEvent) => {
  const box = (e.currentTarget as SVGElement).ownerSVGElement!.getBoundingClientRect()
  const i = Math.max(0, Math.min(n.value - 1, Math.round(((e.clientX - box.left - pad.value.left) / plotW.value) * (n.value - 1))))
  hover.value = i
  tooltip.show({
    title: fmtDate(props.dates[i]!),
    rows: props.series.map(s => ({ label: s.name, value: fmtInt(Math.round(s.values[i] ?? 0)), color: s.color }))
      .sort((a, b) => Number(b.value.replace(/\D/g, '')) - Number(a.value.replace(/\D/g, '')))
  }, e)
}
const leave = () => { hover.value = null; tooltip.hide() }
</script>

<template>
  <div ref="holder" class="fit">
    <ul v-if="!labelled" class="legend">
      <li v-for="s in series" :key="s.key"><span class="swatch" :style="{ background: s.color }" />{{ s.name }}</li>
    </ul>
    <svg class="chart line-draw" :width="width" :height="height" :viewBox="`0 0 ${width} ${height}`" role="img" :aria-label="caption">
      <template v-for="v in ticks" :key="v">
        <line class="grid-line" :x1="pad.left" :x2="width - pad.right" :y1="Y(v)" :y2="Y(v)" />
        <text :x="pad.left - 6" :y="Y(v) + 4" text-anchor="end">{{ fmtInt(v) }}</text>
      </template>
      <text v-for="t in xTicks" :key="t.d" :x="X(t.i)" :y="height - 6" text-anchor="middle">{{ fmtDay(t.d) }}</text>
      <path v-for="p in paths" :key="p.s.key" class="line-series" :d="p.d" :stroke="p.s.color" stroke-width="1.5" pathLength="1" />
      <template v-for="m in ends" :key="m.s.key">
        <line v-if="Math.abs(m.y - m.at) > 6" class="line-leader" :x1="X(n - 1)" :y1="m.at" :x2="X(n - 1) + 8" :y2="m.y" :stroke="m.s.color" />
        <circle class="line-dot" :cx="X(n - 1)" :cy="m.at" r="3" :fill="m.s.color" :style="`--m-i: ${m.i};`" />
        <NuxtLink :to="`/topic/${m.s.key}`" class="line-end-link" custom v-slot="{ href, navigate }">
          <a :href="href ?? undefined" class="line-end-link" @click="navigate"><title>{{ m.s.name }}</title><text class="line-end" :x="X(n - 1) + 10" :y="m.y + 4">{{ cut(m.s.name) }}</text></a>
        </NuxtLink>
      </template>
      <line class="hover-rule" :y1="pad.top" :y2="pad.top + plotH" stroke="var(--rule)" stroke-width="1" :x1="hover !== null ? X(hover) : 0" :x2="hover !== null ? X(hover) : 0" :visibility="hover !== null ? 'visible' : 'hidden'" />
      <circle
        v-for="s in series" :key="s.key" r="3.5" :fill="s.color" stroke="var(--surface-page)" stroke-width="1.5"
        :cx="hover !== null ? X(hover) : 0" :cy="hover !== null ? Y(s.values[hover] ?? 0) : 0" :visibility="hover !== null ? 'visible' : 'hidden'"
      />
      <rect :x="pad.left" :y="pad.top" :width="plotW" :height="plotH" fill="transparent" @pointermove="read" @pointerenter="read" @pointerleave="leave" />
    </svg>
    <div class="visually-hidden">
      <table>
        <caption>{{ caption }}</caption>
        <tbody><tr v-for="s in series" :key="s.key"><th scope="row">{{ s.name }}</th><td>{{ fmtInt(Math.round(s.values[n - 1] ?? 0)) }}</td></tr></tbody>
      </table>
    </div>
  </div>
</template>
