<script setup lang="ts">
// Dash.Sunburst of assets/dash.js: two rings and a legend. The inner ring is the first level (rings), its children are the outer ring, from the top, clockwise.
// A child key is a legend key: a legend row, or a slice of the outer ring, dims the outer slices with another key; a slice of the inner ring dims the outer slices of other rings.
export interface SunChild { key: string, label: string, value: number, color: string, tip: string }
export interface SunRing { label: string, value: number, color: string, tip: string, children: SunChild[] }
export interface SunLegend { key: string, label: string, color: string, text: string, tip?: string }
const props = withDefaults(defineProps<{ rings: SunRing[], legend: SunLegend[], center: { num: string, cap: string }, size?: number, aria?: string }>(), { size: 250, aria: undefined })
const tooltip = useTooltipStore()

const c = computed(() => props.size / 2)
const R = computed(() => c.value - 4)
const total = computed(() => props.rings.reduce((a, r) => a + r.value, 0))
const arc = (a0: number, a1: number, r0: number, r1: number) => {
  a0 += 0.006
  a1 = Math.max(a0 + 0.002, a1 - 0.006)
  const p = (a: number, r: number) => `${(c.value + r * Math.sin(a)).toFixed(2)} ${(c.value - r * Math.cos(a)).toFixed(2)}`
  const large = a1 - a0 > Math.PI ? 1 : 0
  return `M${p(a0, r1)}A${r1} ${r1} 0 ${large} 1 ${p(a1, r1)}L${p(a1, r0)}A${r0} ${r0} 0 ${large} 0 ${p(a0, r0)}Z`
}
interface Slice { id: string, d: string, fill: string, tip: string, outer: boolean, ring: number, key: string }
const slices = computed<Slice[]>(() => {
  const out: Slice[] = []
  const inner: [number, number] = [R.value * 0.34, R.value * 0.6]
  const outer: [number, number] = [R.value * 0.63, R.value]
  let a = 0
  props.rings.forEach((r, ri) => {
    const span = Math.min(total.value ? (r.value / total.value) * 2 * Math.PI : 0, 2 * Math.PI - 0.02)
    out.push({ id: `r${ri}`, d: arc(a, a + span, ...inner), fill: r.color, tip: r.tip, outer: false, ring: ri, key: '' })
    let b = a
    r.children.forEach((ch, ci) => {
      const sp = total.value ? Math.min((ch.value / total.value) * 2 * Math.PI, 2 * Math.PI - 0.02) : 0
      if (ch.value > 0) out.push({ id: `r${ri}c${ci}`, d: arc(b, b + sp, ...outer), fill: ch.color, tip: ch.tip, outer: true, ring: ri, key: ch.key })
      b += sp
    })
    a += span
  })
  return out
})
// What the pointer is on: a legend key, an outer slice's key, or a ring of the inner circle.
const hot = ref<{ key: string } | { ring: number } | null>(null)
const dimmed = (s: Slice) => {
  if (!hot.value || !s.outer) return false
  return 'key' in hot.value ? s.key !== hot.value.key : s.ring !== hot.value.ring
}
const rowOn = (key: string) => !!hot.value && 'key' in hot.value && hot.value.key === key && slices.value.some(s => s.outer && s.key === key)
const show = (tip: string, e: PointerEvent) => tooltip.show({ title: tip }, e)
const label = computed(() => props.aria ?? props.rings.map(r => `${r.label} ${fmtPct(r.value / total.value)}`).join(', '))
</script>

<template>
  <div class="donut-wrap dn-wrap">
    <svg class="chart donut dn dn-sun" :width="size" :height="size" :viewBox="`0 0 ${size} ${size}`" role="img" :aria-label="label">
      <path
        v-for="s in slices" :key="s.id" class="dn-slice" :class="{ 'is-dim': dimmed(s) }" :d="s.d" :fill="s.fill"
        @pointerenter="show(s.tip, $event); hot = s.outer ? { key: s.key } : { ring: s.ring }" @pointermove="show(s.tip, $event)" @pointerleave="tooltip.hide(); hot = null"
      />
      <text class="donut-num" :x="c" :y="c + 2" text-anchor="middle">{{ center.num }}</text>
      <text class="donut-cap" :x="c" :y="c + 18" text-anchor="middle">{{ center.cap }}</text>
    </svg>
    <ul class="rows dn-legend">
      <li
        v-for="l in legend" :key="l.key" class="dn-row" :class="{ 'is-on': rowOn(l.key) }"
        @pointerenter="hot = { key: l.key }; l.tip && show(l.tip, $event)" @pointermove="l.tip && show(l.tip, $event)" @pointerleave="hot = null; tooltip.hide()"
      >
        <span class="dn-dot" :style="{ background: l.color }" aria-hidden="true" />
        <span class="row-name">{{ l.label }}</span>
        <span class="row-value">{{ l.text }}</span>
      </li>
    </ul>
  </div>
</template>
