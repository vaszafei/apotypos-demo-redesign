<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core'

// The Plegma of Αναλύσεις › ΟΗΕ: a dot for each of the 192 countries, in the seats of the hall of the General Assembly. A tab asks for another arrangement (the topics, who attacked whom, who named Greece and Cyprus) and the dots move there
// from left to right, then the curves draw in. The hall is drawn, not measured: the order of the seats is the UN's, the rows and aisles are schematic (the note under the plan says so).
const props = defineProps<{
  countries: UnCountry[]
  seats: Map<string, UnSeat>
  tab: UnTab
  // The page of Παλαιστίνη–Ισραήλ: the dots grow with their minutes on the topic, and the arrangement is the attackers of Israel.
  israel?: boolean
  region: string | null
  active?: boolean
}>()
const { t, te, locale } = useI18n()
const tooltip = useTooltipStore()
const reduced = useMediaQuery('(prefers-reduced-motion: reduce)')

// The data has the English names; a Greek page shows the Greek name of a country, and of a topic when it has one (a cluster of the others is «Άλλα»).
const nameOf = (country: string) => (locale.value === 'el' ? UN_COUNTRY_EL[country] ?? country : country)
const topicName = (key: string) => (key === '*' ? t('un.other') : locale.value === 'el' && te(`un.topic.${key}`) ? t(`un.topic.${key}`) : key)
const input = computed<UnLayoutInput>(() => ({ countries: props.countries, seats: props.seats, nameOf, clusterName: topicName, firstSeat: t('un.hall.first') }))
const maxMinutes = computed(() => Math.max(...props.countries.map(c => c.israelMinutes), 1))
const layout = computed(() => (props.israel && props.tab === 'attacks' ? unIsraelLayout(input.value) : unLayout(props.tab, input.value)))
const base = computed(() => unHallLayout(input.value))
const lines = computed(() => unHallLines(props.seats))
const hallOpacity = computed(() => (layout.value.hall ? 1 : 0))

const dust = (() => {
  let seed = 7
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  return Array.from({ length: 300 }, () => ({ x: UN_VIEW.x + rnd() * UN_VIEW.w, y: UN_VIEW.y + rnd() * UN_VIEW.h, r: 0.8 + rnd() * 1.1, c: ['var(--cat-0)', 'var(--cat-1)', 'var(--cat-2)', 'var(--cat-3)', 'var(--cat-4)', 'var(--cat-5)'][Math.floor(rnd() * 6)]!, o: 0.1 + rnd() * 0.16 }))
})()

// Each dot lives at (x, y, r, o) and moves to the place of the layout of the tab: left to right, one second each, a little later for the ones on the right.
interface Dot { c: UnCountry, x: number, y: number, r: number, o: number, from: UnPlace & { r: number, o: number }, to: UnPlace & { r: number, o: number }, delay: number }
const radiusOf = (c: UnCountry) => unRadius(c, !!props.israel, maxMinutes.value)
const opacityOf = (c: UnCountry) => unOpacity(c, !!props.israel)
const dots: Dot[] = props.countries.map((c) => {
  const s = props.seats.get(c.name)!
  const st = { x: s.x, y: s.y, r: radiusOf(c), o: opacityOf(c) }
  return { c, ...st, from: st, to: st, delay: 0 }
})
const circles = ref<SVGCircleElement[]>([])
const paint = (d: Dot, i: number) => {
  const e = circles.value[i]
  if (!e) return
  e.setAttribute('cx', d.x.toFixed(1)); e.setAttribute('cy', d.y.toFixed(1)); e.setAttribute('r', Math.max(0, d.r).toFixed(2)); e.setAttribute('opacity', d.o.toFixed(2))
}
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
let raf = 0
let started = 0
const frame = (now: number) => {
  let more = false
  dots.forEach((d, i) => {
    const t = Math.min(1, Math.max(0, (now - started - d.delay) / 1000))
    const k = ease(t)
    d.x = d.from.x + (d.to.x - d.from.x) * k
    d.y = d.from.y + (d.to.y - d.from.y) * k
    d.r = d.from.r + (d.to.r - d.from.r) * k
    d.o = d.from.o + (d.to.o - d.from.o) * k
    if (t < 1) more = true
    paint(d, i)
  })
  raf = more ? requestAnimationFrame(frame) : 0
}

// The curves and the labels of the arrangement: they leave first, and the new ones come after the dots have moved (0.9 s).
const shown = shallowRef<UnLayout>(base.value)
const drawn = ref(true)
let timer: ReturnType<typeof setTimeout> | undefined
const go = (to: UnLayout, first = false) => {
  const order = [...dots].sort((a, b) => props.seats.get(a.c.name)!.angle - props.seats.get(b.c.name)!.angle).map(d => d.c.name)
  dots.forEach((d) => {
    const p = to.pos.get(d.c.name)!
    d.from = { x: d.x, y: d.y, r: d.r, o: d.o }
    d.to = { x: p.x, y: p.y, r: p.r ?? radiusOf(d.c), o: p.o ?? opacityOf(d.c) }
    d.delay = reduced.value ? 0 : order.indexOf(d.c.name) / dots.length * 380
  })
  clearTimeout(timer)
  if (reduced.value || first) {
    dots.forEach((d, i) => { d.x = d.to.x; d.y = d.to.y; d.r = d.to.r; d.o = d.to.o; paint(d, i) })
    shown.value = to
    drawn.value = true
    return
  }
  drawn.value = false
  cancelAnimationFrame(raf)
  started = performance.now()
  raf = requestAnimationFrame(frame)
  timer = setTimeout(() => { shown.value = to; drawn.value = false; nextTick(() => requestAnimationFrame(() => { drawn.value = true })) }, 900)
}
onMounted(() => go(layout.value, true))
watch(layout, to => go(to))
onBeforeUnmount(() => { cancelAnimationFrame(raf); clearTimeout(timer) })

const dim = (c: UnCountry) => (props.region && c.region !== props.region ? 0.15 : 1)
const hint = computed(() => t(props.tab === 'hall' ? (props.israel ? 'un.hint.hall.il' : 'un.hint.hall') : props.israel ? 'un.hint.attacks.il' : `un.hint.${props.tab}`))
const tip = (c: UnCountry, e: PointerEvent) => tooltip.show({
  title: nameOf(c.name),
  rows: [
    { label: t('un.tip.speaker'), value: c.speaker },
    { label: t('un.tip.region'), value: t(`un.region.${c.region}`), color: unRegionColor(c.region) },
    { label: t('un.tip.minutes'), value: fmtInt(Math.round(c.seconds / 60)) },
    ...(props.israel ? [{ label: t('un.tip.israel'), value: fmtDec(c.israelMinutes) }] : []),
    ...(props.tab === 'attacks' && c.attacksOnIsrael ? [{ label: t('un.tip.attacksIl'), value: fmtInt(c.attacksOnIsrael) }] : [])
  ]
}, e)
</script>

<template>
  <figure class="un-hall" :class="{ 'is-ready': active !== false }">
    <svg :viewBox="`${UN_VIEW.x} ${UN_VIEW.y} ${UN_VIEW.w} ${UN_VIEW.h}`" preserveAspectRatio="xMidYMid meet" role="img" :aria-label="t('un.hall.title')">
      <g class="un-dust"><circle v-for="(p, i) in dust" :key="i" :cx="p.x" :cy="p.y" :r="p.r" :fill="p.c" :opacity="p.o" /></g>
      <g class="un-lines" :style="{ opacity: hallOpacity }">
        <path :d="lines.wall" /><path v-for="(d, i) in lines.arcs" :key="i" :d="d" />
        <circle class="un-rostrum" :cx="lines.rostrum.x" :cy="lines.rostrum.y" r="9" /><circle class="un-rostrum-ring" :cx="lines.rostrum.x" :cy="lines.rostrum.y" r="14" />
        <text class="un-label" :x="lines.rostrum.x" :y="lines.rostrum.y + 32" text-anchor="middle">{{ t('un.hall.rostrum') }}</text>
      </g>
      <g class="un-edges">
        <path v-for="(e, i) in shown.edges" :key="`${tab}${i}`" class="un-edge" :class="{ 'is-in': drawn }" :d="e.d" pathLength="1" :stroke="e.color" :stroke-width="e.w" :opacity="e.o" />
      </g>
      <g class="un-dots">
        <circle
          v-for="(d, i) in dots" :ref="el => { if (el) circles[i] = el as SVGCircleElement }" :key="d.c.name" :fill="unRegionColor(d.c.region)" :fill-opacity="dim(d.c)"
          @pointermove="e => tip(d.c, e)" @pointerleave="tooltip.hide()"
        />
      </g>
      <g class="un-labels" :class="{ 'is-in': drawn }">
        <text v-for="(l, i) in shown.labels" :key="`${tab}${i}`" class="un-label" :class="{ 'is-small': l.small }" :x="l.x" :y="l.y" :text-anchor="tab === 'themes' && !israel ? 'middle' : 'start'">{{ l.text }}</text>
      </g>
    </svg>
    <figcaption class="un-hint">{{ hint }}</figcaption>
  </figure>
</template>
