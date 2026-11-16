<script setup lang="ts">
import { useElementSize } from '@vueuse/core'
import type { FlowData } from '~/composables/usePeriodWeb'

// A Sankey of the topics of a period (left, in their colors) and the outlets that wrote them (right, in the colors of their groups): a band is the articles of a topic in an outlet, a bar is
// the share of all the articles of the period (the one of the list of the topics). The topic pointed at, here or on the web beside it (`lit`), takes its bands forward; a click on a topic opens its page (`select`).
// The bands of a topic are one group that fades as a whole (a hover fades a few groups, not every band). Layout by hand (two columns, no iteration): the bars are as tall as their articles on one scale, the bands leave a bar one after the other.
const props = defineProps<{ data: FlowData, lit: number | null }>()
const emit = defineEmits<{ select: [issue: number], 'update:lit': [issue: number | null] }>()
const { t } = useI18n()
const tooltip = useTooltipStore()
const box = ref<HTMLElement>()
const { width, height } = useElementSize(box)

// The gap between bars: wide enough for the names of the small ones not to touch.
const gapOf = (count: number) => (count > 16 ? 8 : count > 10 ? 9 : 5)
const BAR = 10
const PAD = 6
const labelW = computed(() => Math.max(96, Math.min(150, width.value * 0.27)))
const colour = (slot: number) => `var(--cat-${slot})`

const layout = computed(() => {
  const d = props.data
  const w = width.value
  const h = height.value
  if (w < 120 || h < 120) return null
  const gl = gapOf(d.topics.length)
  const gr = d.outlets.length > 16 ? 4 : 5
  const k = Math.min((h - 2 * PAD - gl * (d.topics.length - 1)) / d.total, (h - 2 * PAD - gr * (d.outlets.length - 1)) / d.total)
  if (!(k > 0)) return null
  const place = (nodes: { n: number }[], gap: number) => {
    let y = PAD
    return nodes.map((nd) => { const at = y; y += nd.n * k + gap; return { y: at, h: Math.max(2, nd.n * k) } })
  }
  const left = place(d.topics, gl)
  const right = place(d.outlets, gr)
  const x0 = labelW.value + BAR
  const x1 = w - labelW.value - BAR
  const outTop = left.map(() => 0)
  const inTop = right.map(() => 0)
  const links = d.links.slice().sort((a, b) => a.b - b.b || a.a - b.a).map((l, i) => {
    const th = l.n * k
    return { ...l, i, th, y0: 0, y1: 0 }
  })
  // The bands leave a topic in the order of the outlets and enter an outlet in the order of the topics.
  for (const l of links.slice().sort((a, b) => a.a - b.a || a.b - b.b)) { l.y0 = left[l.a]!.y + outTop[l.a]! + l.th / 2; outTop[l.a]! += l.th }
  for (const l of links.slice().sort((a, b) => a.b - b.b || a.a - b.a)) { l.y1 = right[l.b]!.y + inTop[l.b]! + l.th / 2; inTop[l.b]! += l.th }
  const xm = (x0 + x1) / 2
  const drawn = links.map(l => ({ ...l, path: `M${x0},${l.y0} C${xm},${l.y0} ${xm},${l.y1} ${x1},${l.y1}` }))
  // The bands of a topic are one group, so pointing at a topic fades a few groups and not hundreds of bands.
  return { left, right, x0, x1, byTopic: d.topics.map((_, a) => drawn.filter(l => l.a === a)) }
})

const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s)
const chars = computed(() => Math.floor((labelW.value - 34) / 5.6))
const share = (n: number) => fmtPct(n / props.data.all)
const dim = (a: number) => (props.lit !== null && props.data.topics[a]!.issue !== props.lit)
const showLink = (e: PointerEvent, l: { a: number, b: number, n: number }) => {
  const tp = props.data.topics[l.a]!
  const o = props.data.outlets[l.b]!
  // What the band is of its two ends: of the articles of the topic that this outlet wrote, and of the articles of this outlet that are the topic.
  tooltip.show({
    title: `${tp.name} → ${o.name}`,
    note: t('topics2.flow.estimate'),
    rows: [
      { label: t('home.field.articles'), value: `${fmtInt(Math.round(l.n))} · ${share(l.n)}`, color: colour(tp.slot) },
      { label: t('topics2.flow.ofTopic'), value: fmtPct(l.n / tp.n) },
      { label: t('topics2.flow.ofOutlet'), value: fmtPct(l.n / o.n) }
    ],
    field: true
  }, e)
  if (tp.issue !== undefined && tp.issue >= 0) emit('update:lit', tp.issue)
}
// A bar of a topic (left) says which outlets its articles went to, a bar of an outlet (right) which topics its articles are: the largest parts as shares of the bar, the rest together.
const SHOWN = 8
const showNode = (e: PointerEvent, side: 'topic' | 'outlet', i: number) => {
  const d = props.data
  const nd = side === 'topic' ? d.topics[i]! : d.outlets[i]!
  const mine = d.links.filter(l => (side === 'topic' ? l.a : l.b) === i).sort((x, y) => y.n - x.n)
  const total = mine.reduce((sum, l) => sum + l.n, 0) || nd.n
  const part = (l: { a: number, b: number }) => (side === 'topic' ? d.outlets[l.b]! : d.topics[l.a]!)
  const line = (n: number) => `${fmtInt(Math.round(n))} · ${fmtPct(n / total)}`
  const rows = [
    { label: t('home.field.articles'), value: `${fmtInt(Math.round(nd.n))} · ${share(nd.n)}`, color: colour(nd.slot) },
    ...mine.slice(0, SHOWN).map(l => ({ label: part(l).name, value: line(l.n), color: colour(part(l).slot) }))
  ]
  const rest = mine.slice(SHOWN).reduce((sum, l) => sum + l.n, 0)
  if (rest > 0) rows.push({ label: t(side === 'topic' ? 'topics2.flow.restOutlets' : 'topics2.flow.restTopics'), value: line(rest), color: colour(0) })
  tooltip.show({ title: nd.name, note: `${t(side === 'topic' ? 'topics2.flow.byOutlet' : 'topics2.flow.byTopic')} ${t('topics2.flow.estimate')}`, rows, field: true }, e)
}
const leave = () => { tooltip.hide(); emit('update:lit', null) }
onBeforeUnmount(() => tooltip.hide())
</script>

<template>
  <div ref="box" class="tof-box">
    <svg v-if="layout" class="tof-svg" role="img" :aria-label="t('topics2.flow.title')" :width="width" :height="height" @pointerleave="leave">
      <g v-for="(nd, a) in data.topics" :key="`b${nd.key}`" class="tof-bands" :style="`--a:${a}`" :opacity="lit === null ? 0.46 : dim(a) ? 0.1 : 1">
        <path
          v-for="l in layout.byTopic[a]" :key="l.b" class="tof-link" :d="l.path" :stroke="colour(nd.slot)" :stroke-width="Math.max(0.6, l.th)" opacity="0.7" @pointermove="showLink($event, l)"
        />
      </g>
      <g v-for="(nd, a) in data.topics" :key="nd.key" class="tof-node" :opacity="lit === null || !dim(a) ? 1 : 0.4">
        <rect :x="layout.x0 - BAR" :y="layout.left[a]!.y" :width="BAR" :height="layout.left[a]!.h" rx="2" :fill="colour(nd.slot)" @pointermove="nd.issue! >= 0 && emit('update:lit', nd.issue!); showNode($event, 'topic', a)" />
        <text class="tof-label is-topic" :x="layout.x0 - BAR - 7" :y="layout.left[a]!.y + layout.left[a]!.h / 2 + 4" text-anchor="end" @click="nd.issue! >= 0 && emit('select', nd.issue!)" @pointermove="nd.issue! >= 0 && emit('update:lit', nd.issue!); showNode($event, 'topic', a)">{{ cut(nd.name, chars) }} <tspan class="tof-pct">{{ share(nd.n) }}</tspan></text>
      </g>
      <g v-for="(nd, b) in data.outlets" :key="nd.key" class="tof-node">
        <rect :x="layout.x1" :y="layout.right[b]!.y" :width="BAR" :height="layout.right[b]!.h" rx="2" :fill="colour(nd.slot)" @pointermove="showNode($event, 'outlet', b)" />
        <text class="tof-label" :x="layout.x1 + BAR + 7" :y="layout.right[b]!.y + layout.right[b]!.h / 2 + 4" text-anchor="start" @pointermove="showNode($event, 'outlet', b)">{{ cut(nd.name, chars) }} <tspan class="tof-pct">{{ share(nd.n) }}</tspan></text>
      </g>
    </svg>
  </div>
</template>
