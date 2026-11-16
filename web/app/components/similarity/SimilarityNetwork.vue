<script setup lang="ts">
import { useElementSize } from '@vueuse/core'
import { neighbours, type SimResult } from '~/utils/similarity'
import { round } from '~/utils/net-layout'

// Μέσα › Ομοιότητα: the outlets as a web of the Plegma. Two outlets are close when they write many of the same stories (their score, utils/similarity.ts), so the outlets that write alike
// gather and the ones that write apart stand far. The area of a circle is the articles of the outlet, its color is its group. The strongest links of each outlet are drawn.
// A hover on an outlet lights its 3 closest outlets (solid lines) and its 3 farthest (dashed lines) and fades the others; a click opens its page.
const props = defineProps<{ sim: SimResult, pos: [number, number][], colorOf: (group: string | null) => string, lit: number | null, active?: boolean }>()
const emit = defineEmits<{ 'update:lit': [value: number | null] }>()
const { t } = useI18n()
const tooltip = useTooltipStore()
const inkOf = useInk()

const holder = ref<HTMLElement | null>(null)
const { width: measured, height: measuredH } = useElementSize(holder)
const width = computed(() => Math.floor(measured.value) || 640)
const height = computed(() => Math.floor(measuredH.value) || 420)

const LINKS = 2 // the closest outlets of each outlet that get a line
const nodes = computed(() => {
  const [w, h] = [width.value, height.value]
  const { outlets } = props.sim
  const k = outlets.length
  const margin = { x: 90, y: 56 }
  const xs = props.pos.map(p => p[0])
  const ys = props.pos.map(p => p[1])
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  const maxArt = Math.max(...outlets.map(o => o.articles))
  const rMax = Math.min(w, h) * 0.05
  const list = outlets.map((o, i) => ({
    i, o,
    x: margin.x + ((props.pos[i]![0] - x0) / (x1 - x0 || 1)) * (w - 2 * margin.x),
    y: margin.y + ((props.pos[i]![1] - y0) / (y1 - y0 || 1)) * (h - 2 * margin.y),
    r: Math.max(5, rMax * Math.sqrt(o.articles / maxArt))
  }))
  // Circles that touch are pushed apart (the plane is stretched to the box, so some would overlap).
  for (let it = 0; it < 200; it++) {
    for (let a = 0; a < k; a++) {
      for (let b = a + 1; b < k; b++) {
        const [p, q] = [list[a]!, list[b]!]
        const dx = q.x - p.x
        const dy = q.y - p.y
        const d = Math.hypot(dx, dy) || 0.01
        const gap = p.r + q.r + 12
        if (d < gap) {
          const push = (gap - d) / 2
          p.x -= (dx / d) * push; p.y -= (dy / d) * push
          q.x += (dx / d) * push; q.y += (dy / d) * push
        }
      }
    }
    for (const n of list) { n.x = Math.max(n.r + 4, Math.min(w - n.r - 4, n.x)); n.y = Math.max(n.r + 4, Math.min(h - n.r - 4, n.y)) }
  }
  return list.map(n => ({ ...n, x: round(n.x), y: round(n.y) }))
})
const near = computed(() => props.sim.outlets.map((_, i) => neighbours(props.sim, i, 3)))
const edges = computed(() => {
  const seen = new Set<string>()
  const out: { a: number, b: number, v: number }[] = []
  props.sim.outlets.forEach((_, i) => {
    for (const e of near.value[i]!.near.slice(0, LINKS)) {
      const [a, b] = i < e.j ? [i, e.j] : [e.j, i]
      if (seen.has(`${a}-${b}`)) continue
      seen.add(`${a}-${b}`)
      out.push({ a, b, v: e.v })
    }
  })
  return out
})
const best = computed(() => Math.max(...edges.value.map(e => e.v), 0.01))
const lit = computed(() => props.lit)
const related = computed(() => {
  if (lit.value === null) return null
  const n = near.value[lit.value]!
  return { near: new Set(n.near.map(e => e.j)), far: new Set(n.far.map(e => e.j)) }
})
const state = (i: number) => (lit.value === null ? '' : i === lit.value || related.value!.near.has(i) || related.value!.far.has(i) ? 'is-active' : 'is-dim')

const pct = (v: number) => fmtPct(v)
const tipOf = (i: number) => {
  const o = props.sim.outlets[i]!
  const n = near.value[i]!
  const row = (e: { j: number, v: number }) => ({ label: props.sim.outlets[e.j]!.name, value: pct(e.v), color: props.colorOf(props.sim.outlets[e.j]!.group) })
  return {
    title: o.group ? `${o.name} · ${o.group}` : o.name,
    rows: [
      { label: t('sim.web.stories'), value: fmtInt(o.stories) },
      { label: t('sim.web.near'), value: '' }, ...n.near.map(row),
      { label: t('sim.web.far'), value: '' }, ...n.far.map(row)
    ]
  }
}
const plain = (i: number) => { const tip = tipOf(i); return `${tip.title}: ${tip.rows.map(r => `${r.label} ${r.value}`.trim()).join(', ')}` }
const enter = (i: number, e: PointerEvent) => { emit('update:lit', i); tooltip.show(tipOf(i), e) }
const leave = () => { emit('update:lit', null); tooltip.hide() }
const open = (slug: string) => navigateTo(outletHref(slug), { external: !portedPath(outletHref(slug)) })

// The names: beside the circle where there is room, else under it or over it; a name that would touch another name or a circle is left out.
const labels = computed(() => {
  const [w0, h0] = [width.value, height.value]
  const boxes: { x0: number, x1: number, y0: number, y1: number }[] = []
  const circles = nodes.value
  const hit = (x0: number, x1: number, y0: number, y1: number) => boxes.some(b => x0 < b.x1 && b.x0 < x1 && y0 < b.y1 && b.y0 < y1)
    || circles.some((o) => { const nx = Math.max(x0, Math.min(o.x, x1)); const ny = Math.max(y0, Math.min(o.y, y1)); return Math.hypot(o.x - nx, o.y - ny) < o.r })
  const out: { i: number, text: string, x: number, y: number, anchor: 'start' | 'middle' | 'end' }[] = []
  for (const n of circles.slice().sort((a, b) => b.r - a.r)) {
    const w = n.o.name.length * 6.3
    const tries = [
      { x: n.x + n.r + 5, y: n.y + 4, anchor: 'start' as const }, { x: n.x - n.r - 5, y: n.y + 4, anchor: 'end' as const },
      { x: n.x, y: n.y + n.r + 14, anchor: 'middle' as const }, { x: n.x, y: n.y - n.r - 6, anchor: 'middle' as const }
    ]
    for (const c of tries) {
      const x0 = c.anchor === 'middle' ? c.x - w / 2 : c.anchor === 'start' ? c.x : c.x - w
      if (x0 < 2 || x0 + w > w0 - 2 || c.y - 12 < 0 || c.y + 4 > h0 || hit(x0, x0 + w, c.y - 12, c.y + 4)) continue
      boxes.push({ x0, x1: x0 + w, y0: c.y - 12, y1: c.y + 4 })
      out.push({ i: n.i, text: n.o.name, x: round(c.x), y: round(c.y), anchor: c.anchor })
      break
    }
  }
  return out
})
const tint = (i: number) => tintOf(props.colorOf(props.sim.outlets[i]!.group), 0.35)
</script>

<template>
  <div ref="holder" class="fit net-fill" :class="{ 'is-in': active }">
    <svg v-if="measured > 0" class="chart net sim-net" :width="width" :height="height" :viewBox="`0 0 ${width} ${height}`" role="group" :aria-label="t('sim.web.title')">
      <g>
        <g v-for="e in edges" :key="`${e.a}-${e.b}`" class="net-drift" :style="{ '--d': e.a }">
          <line
            :class="['net-edge', 'sim-edge']" :style="{ '--g': e.a % 6, opacity: lit === null ? 0.18 + 0.5 * (e.v / best) : 0 }"
            :x1="nodes[e.a]!.x" :y1="nodes[e.a]!.y" :x2="nodes[e.b]!.x" :y2="nodes[e.b]!.y" stroke="var(--text-secondary)"
          />
        </g>
        <template v-if="lit !== null">
          <line
            v-for="j in related!.near" :key="`n-${j}`" class="sim-link" :x1="nodes[lit]!.x" :y1="nodes[lit]!.y" :x2="nodes[j]!.x" :y2="nodes[j]!.y" stroke="var(--text-primary)" stroke-width="1.6"
          />
          <line
            v-for="j in related!.far" :key="`f-${j}`" class="sim-link" :x1="nodes[lit]!.x" :y1="nodes[lit]!.y" :x2="nodes[j]!.x" :y2="nodes[j]!.y" stroke="var(--text-secondary)" stroke-width="1.2" stroke-dasharray="3 5"
          />
        </template>
      </g>
      <g>
        <g v-for="n in nodes" :key="n.o.slug" :class="['sim-node', state(n.i)]">
          <g class="net-drift" :style="{ '--d': n.i }">
          <circle
            :class="['net-outlet']" :cx="n.x" :cy="n.y" :r="n.r" :fill="tint(n.i)" :stroke="colorOf(n.o.group)" stroke-width="1.2" :style="{ '--g': n.i % 6 }"
            tabindex="0" role="link" :aria-label="plain(n.i)"
            @pointerenter="enter(n.i, $event)" @pointermove="tooltip.show(tipOf(n.i), $event)" @pointerleave="leave"
            @click="open(n.o.slug)" @keydown.enter="open(n.o.slug)" @focus="emit('update:lit', n.i)" @blur="emit('update:lit', null)"
          />
          </g>
        </g>
      </g>
      <g class="bubble-labels">
        <g v-for="l in labels" :key="l.i" class="net-drift" :style="{ '--d': l.i }">
          <text :class="['net-name', 'net-el', state(l.i)]" :x="l.x" :y="l.y" :text-anchor="l.anchor" :style="{ fill: inkOf(colorOf(sim.outlets[l.i]!.group), 0.35) }">{{ l.text }}</text>
        </g>
      </g>
    </svg>
    <div class="visually-hidden">
      <table>
        <caption>{{ t('sim.web.title') }}</caption>
        <tbody><tr v-for="(o, i) in sim.outlets" :key="o.slug"><th scope="row">{{ o.name }}</th><td>{{ plain(i) }}</td></tr></tbody>
      </table>
    </div>
  </div>
</template>
