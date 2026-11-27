<script setup lang="ts">
import { useResizeObserver } from '@vueuse/core'
import type { PlegmaArticle } from '~/utils/plegma/plegma-articles'

// How fast the story spread: the outlets that had written it, against the time after its first article, as steps; each step is an outlet's first article, as a dot in the color of
// its group. The time runs on a square-root scale, so the first hours, when most outlets come, have room. On top: how long it took to reach half of its outlets.
// The pointer on the chart picks the step under it: its outlet, when it came, and the articles of the story until then lit on the map (`hover`: the minutes from and to).
const props = defineProps<{ articles: PlegmaArticle[], colorOf: (outlet: string) => string }>()
const emit = defineEmits<{ hover: [span: { from: number, to: number } | null] }>()
const { t } = useI18n()
const box = ref<HTMLElement>()
const w = ref(0)
const h = ref(0)
useResizeObserver(box, ([e]) => { w.value = e!.contentRect.width; h.value = e!.contentRect.height })
// The time on top, in words: minutes, hours or days.
const span = (m: number) => {
  const [key, n] = m < 60 ? ['min', Math.max(1, Math.round(m))] : m < 1440 ? ['hours', Math.floor(m / 60)] : ['days', Math.floor(m / 1440)]
  return t(`story.speed.${key}${n === 1 ? '1' : ''}`, { n })
}

const PAD = { left: 30, right: 16, top: 58, bottom: 26 }
const TICKS = [60, 360, 1440, 2880, 7200, 14400]
const chart = computed(() => {
  const list = props.articles.filter(a => a.time !== undefined)
  if (!list.length || w.value < 160 || h.value < 120) return null
  const t0 = list[0]!.time!
  const firsts: { outlet: string, m: number }[] = []
  const seen = new Set<string>()
  for (const a of list) if (!seen.has(a.outlet)) { seen.add(a.outlet); firsts.push({ outlet: a.outlet, m: a.time! - t0 }) }
  const end = Math.max(60, firsts[firsts.length - 1]!.m)
  const x = (m: number) => PAD.left + Math.sqrt(m / end) * (w.value - PAD.left - PAD.right)
  const y = (k: number) => h.value - PAD.bottom - (k / firsts.length) * (h.value - PAD.top - PAD.bottom)
  let d = `M ${x(0)} ${y(1)}`
  const dots = firsts.map((f, k) => {
    if (k) d += ` H ${x(f.m)} V ${y(k + 1)}`
    return { ...f, k: k + 1, x: x(f.m), y: y(k + 1), color: props.colorOf(f.outlet) }
  })
  const half = dots[Math.ceil(firsts.length / 2) - 1]!
  // The marks of the axis keep 58 px apart (the scale squeezes the late ones less than the early ones).
  const ticks: { x: number, text: string }[] = []
  for (const m of [0, ...TICKS.filter(v => v < end * 0.92)]) if (!ticks.length || x(m) - ticks[ticks.length - 1]!.x >= 58) ticks.push({ x: x(m), text: m ? span(m) : t('story.speed.start') })
  return { t0, dots, half, ticks, d, baseY: h.value - PAD.bottom, n: firsts.length }
})
type Dot = NonNullable<typeof chart.value>['dots'][number]
const on = ref<Dot | null>(null)
const pickAt = (px: number): Dot | null => {
  const c = chart.value
  if (!c) return null
  let best = c.dots[0]!
  for (const dot of c.dots) if (dot.x <= px + 4) best = dot
  return best
}
const move = (e: PointerEvent) => {
  const r = box.value!.getBoundingClientRect()
  on.value = pickAt(e.clientX - r.left)
}
watch(on, (dot) => { const c = chart.value; emit('hover', dot && c ? { from: c.t0, to: c.t0 + dot.m } : null) })
</script>

<template>
  <div ref="box" class="plegma-speed" @pointermove="move" @pointerleave="on = null">
    <svg v-if="chart" :width="w" :height="h">
      <text x="0" y="22" class="por-big ps-head">{{ span(on ? on.m : chart.half.m) }}</text>
      <text x="0" y="42" class="por-cap ps-head">{{ on ? t('story.speed.at', { outlet: on.outlet, k: on.k, n: chart.n }) : t('story.speed.half', { k: chart.half.k, n: chart.n }) }}</text>
      <line :x1="chart.ticks[0]!.x" :x2="w - 16" :y1="chart.baseY" :y2="chart.baseY" class="ps-axis" />
      <g v-for="tk in chart.ticks" :key="tk.text">
        <line :x1="tk.x" :x2="tk.x" :y1="chart.baseY" :y2="chart.baseY + 4" class="ps-axis" />
        <text :x="tk.x" :y="chart.baseY + 17" class="ps-tick">{{ tk.text }}</text>
      </g>
      <text :x="4" :y="chart.dots[chart.n - 1]!.y + 4" class="ps-tick is-left">{{ chart.n }}</text>
      <line :x1="chart.half.x" :x2="chart.half.x" :y1="chart.half.y" :y2="chart.baseY" class="ps-half" />
      <path :d="chart.d" class="ps-step" />
      <circle v-for="dot in chart.dots" :key="dot.outlet" :cx="dot.x" :cy="dot.y" :r="on === dot ? 5 : 3.4" :fill="dot.color" class="ps-dot" :class="{ 'is-on': on === dot }" />
      <line v-if="on" :x1="on.x" :x2="on.x" :y1="PAD.top - 6" :y2="chart.baseY" class="ps-rule" />
    </svg>
  </div>
</template>
