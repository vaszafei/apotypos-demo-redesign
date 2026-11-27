<script setup lang="ts">
import { useResizeObserver } from '@vueuse/core'
import { ARC_MIN, arcThick } from '~/utils/plegma/stage/stage-draw-util'
import { RING_START } from '~/utils/plegma/plegma-ring'

// The ring of the circle web, alone (no web inside it, no names): an arc for each part, from the start of the ring, as wide as its weight (`w`, else its count) and as thick as its count
// against the largest's, in the calm color of its group (a silent part, which has no articles, is a thin dashed arc). Not in a card: it lies on the Plegma. An arc under the pointer
// (its band, wider than the arc) is the part pointed at (`hover`). In the middle: a big number and a line under it (`middle`), or those of the part pointed at (`pointed`).
// With `labels`, each part's name beside the ring, on the side of its arc, with a thin line to it; the ring leaves them room on both sides.
export interface RingPart { key: string, name: string, group: string | null, n: number, color: string, w?: number, silent?: boolean }
export interface RingMiddle { big: string, bigCap: string, line: string, cap: string }
const props = withDefaults(defineProps<{ parts: RingPart[], middle: RingMiddle, pointed: (p: RingPart) => RingMiddle, sorted?: boolean, labels?: boolean }>(), { sorted: true, labels: false })
const emit = defineEmits<{ hover: [part: RingPart | null] }>()
const box = ref<HTMLElement>()
const w = ref(0)
const h = ref(0)
useResizeObserver(box, ([e]) => { w.value = e!.contentRect.width; h.value = e!.contentRect.height })
const on = ref<RingPart | null>(null)
watch(on, part => emit('hover', part))
watch(() => props.parts, () => { on.value = null })

let ctx: CanvasRenderingContext2D | null = null
const family = ref('')
onMounted(() => { family.value = getComputedStyle(box.value!).fontFamily; ctx = document.createElement('canvas').getContext('2d') })
const width = (text: string, font: string) => { if (!ctx) return text.length * 6; ctx.font = `${font} ${family.value}`; return ctx.measureText(text).width }
// A text cut to a width (with …).
const fit = (text: string, font: string, room: number) => { let s = text; while (s.length > 4 && width(s, font) > room) s = `${s.slice(0, -2).trimEnd()}…`; return s }

const NAME_FONT = '11.5px'
const NAME_LINE = 14
const soft = (color: string) => `color-mix(in srgb, ${color} 70%, var(--cat-0))`
// The arcs as angles: where each part goes (`layout`), and where it is drawn (`shown`), which moves there in FILL_MS when the parts change: a new part grows out of the place
// it takes, a part that goes shrinks to nothing between its neighbours, the others slide. The first parts fill the ring from its start.
interface Arc { p: RingPart, thick: number, a0: number, a1: number }
const FILL_MS = 650
const layout = computed(() => {
  const parts = props.sorted ? [...props.parts].filter(p => p.n > 0).sort((a, b) => b.n - a.n) : props.parts
  const weight = (p: RingPart) => p.w ?? p.n
  const total = parts.reduce((s, p) => s + weight(p), 0)
  const room = props.labels ? Math.max(0, ...parts.map(p => width(p.name, NAME_FONT))) + 18 : 0
  const named = props.labels && Math.min(h.value / 2 - 6, w.value / 2 - 6 - room) >= 60
  const R = Math.min(h.value / 2 - 6, w.value / 2 - 6 - (named ? room : 0), 90)
  if (!total || R < 40) return null
  const top = Math.max(1, ...parts.map(p => p.n))
  let start = RING_START
  const arcs: Arc[] = parts.map((p) => {
    const span = (weight(p) / total) * Math.PI * 2
    const thick = p.silent ? 1.5 : Math.max(ARC_MIN, arcThick(p.n, top))
    const pad = Math.min(span / 2 - 0.001, (Math.max(thick, ARC_MIN) / 2 + 1.5) / R)
    const arc = { p, thick, a0: start + pad, a1: start + span - pad }
    start += span
    return arc
  })
  return { arcs, named, R, cx: w.value / 2, cy: h.value / 2 }
})
const shown = shallowRef<Arc[]>([])
let raf = 0
const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches
const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2)
watch(() => layout.value?.arcs, (to) => {
  cancelAnimationFrame(raf)
  if (!to) { shown.value = []; return }
  const from = shown.value
  if (still()) { shown.value = to; return }
  const next = new Map(to.map(a => [a.p.key, a]))
  const was = new Map(from.map(a => [a.p.key, a]))
  // Where a part that comes or goes is a point: at the next part that stays (in the old order for one that goes, in the new for one that comes), else at an end of the ring.
  const pointAt = (list: Arc[], k: number, other: Map<string, Arc>, side: Map<string, Arc>) => {
    for (let j = k + 1; j < list.length; j++) { const o = side.get(list[j]!.p.key); if (o && other.has(list[j]!.p.key)) return o.a0 }
    return from.length ? RING_START + Math.PI * 2 : RING_START
  }
  const moves = to.map((a, k) => ({ p: a.p, s: was.get(a.p.key) ?? { thick: a.thick, a0: pointAt(to, k, was, was), a1: pointAt(to, k, was, was) }, e: a }))
  from.forEach((a, k) => { if (!next.has(a.p.key)) { const at = pointAt(from, k, next, next); moves.push({ p: a.p, s: a, e: { ...a, a0: at, a1: at } }) } })
  const t0 = performance.now()
  const step = (now: number) => {
    const t = Math.min(1, (now - t0) / FILL_MS)
    const f = ease(t)
    const mix = (x: number, y: number) => x + (y - x) * f
    shown.value = t < 1 ? moves.map(m => ({ p: m.p, thick: mix(m.s.thick, m.e.thick), a0: mix(m.s.a0, m.e.a0), a1: mix(m.s.a1, m.e.a1) })) : to
    if (t < 1) raf = requestAnimationFrame(step)
  }
  raf = requestAnimationFrame(step)
}, { immediate: true })
onBeforeUnmount(() => cancelAnimationFrame(raf))
const ring = computed(() => {
  const l = layout.value
  if (!l) return null
  const { R, cx, cy } = l
  const at = (a: number) => ({ x: cx + Math.cos(a - Math.PI / 2) * R, y: cy + Math.sin(a - Math.PI / 2) * R })
  const path = (a0: number, a1: number) => { const p0 = at(a0); const p1 = at(a1); return a1 - a0 > 0.002 ? `M ${p0.x} ${p0.y} A ${R} ${R} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${p1.x} ${p1.y}` : '' }
  const arcs = shown.value.map(a => ({ p: a.p, thick: a.thick, d: path(a.a0, a.a1) }))
  // The names (at the places their arcs go to): on each side, in the order of their arcs from the top, pushed apart a line at least; when a side has more names than lines, the smallest parts lose theirs.
  const names: { p: RingPart, x: number, y: number, end: boolean, d: string }[] = []
  if (l.named) {
    const lines = Math.max(1, Math.floor((h.value - 8) / NAME_LINE))
    for (const end of [false, true]) {
      const side = l.arcs.map(a => ({ ...a, mid: (a.a0 + a.a1) / 2 })).filter(a => a.a1 > a.a0 && (Math.cos(a.mid - Math.PI / 2) < 0) === end)
        .sort((a, b) => b.p.n - a.p.n).slice(0, lines)
        .map(a => ({ a, ay: cy + Math.sin(a.mid - Math.PI / 2) * (R + a.thick / 2 + 2), ax: cx + Math.cos(a.mid - Math.PI / 2) * (R + a.thick / 2 + 2) }))
        .sort((u, v) => u.ay - v.ay)
      const ys = side.map(u => u.ay)
      for (let i = 0; i < ys.length; i++) ys[i] = Math.max(ys[i]!, i ? ys[i - 1]! + NAME_LINE : 4 + NAME_LINE / 2)
      for (let i = ys.length - 1; i >= 0; i--) ys[i] = Math.min(ys[i]!, i < ys.length - 1 ? ys[i + 1]! - NAME_LINE : h.value - 4 - NAME_LINE / 2)
      const x = cx + (end ? -1 : 1) * (R + 14)
      side.forEach((u, i) => names.push({ p: u.a.p, x, y: ys[i]!, end, d: `M ${u.ax} ${u.ay} L ${x + (end ? 3 : -3)} ${ys[i]}` }))
    }
  }
  // The middle holds a number and a line when the ring leaves them room.
  return { arcs, names, cx, cy, R, middle: R >= 60 }
})
// The middle: each line as wide as the inside of the ring at its height; a long line takes a smaller size before it is cut (a name of an outlet or a group is read whole).
const MIDDLE_Y = { big: -24, bigCap: -4, line: 18, cap: 34 }
const LINE_SIZES = [20, 17, 15, 13]
const CAP_SIZES = [12, 11, 10]
const middle = computed(() => {
  const r = ring.value
  const m = on.value ? props.pointed(on.value) : props.middle
  if (!r) return { ...m, lineSize: LINE_SIZES[0]!, capSize: CAP_SIZES[0]!, bigCapSize: CAP_SIZES[0]! }
  const roomAt = (y: number, size: number) => 2 * Math.sqrt(Math.max(0, (r.R - 8) ** 2 - (Math.abs(y) + size / 2) ** 2)) - 6
  const sized = (text: string, y: number, sizes: number[], weight: string) => {
    const size = sizes.find(z => width(text, `${weight} ${z}px`) <= roomAt(y, z)) ?? sizes[sizes.length - 1]!
    return { text: fit(text, `${weight} ${size}px`, roomAt(y, size)), size }
  }
  const line = sized(m.line, MIDDLE_Y.line, LINE_SIZES, '600')
  const cap = sized(m.cap, MIDDLE_Y.cap, CAP_SIZES, '400')
  const bigCap = sized(m.bigCap, MIDDLE_Y.bigCap, CAP_SIZES, '400')
  return { ...m, line: line.text, lineSize: line.size, cap: cap.text, capSize: cap.size, bigCap: bigCap.text, bigCapSize: bigCap.size }
})
</script>

<template>
  <div ref="box" class="plegma-ring">
    <svg v-if="ring" :width="w" :height="h">
      <path v-for="a in ring.arcs" :key="a.p.key" class="por-arc" :class="{ 'is-on': on === a.p, 'is-silent': a.p.silent }" :d="a.d" :stroke="a.p.silent ? undefined : on === a.p ? a.p.color : soft(a.p.color)" :stroke-width="a.thick + (on === a.p ? 1.4 : 0)" />
      <path v-for="a in ring.arcs" :key="`h${a.p.key}`" class="por-hit" :d="a.d" @pointerenter="on = a.p" @pointerleave="on = null" />
      <g v-for="l in ring.names" :key="`n${l.p.key}`" class="por-name" :class="{ 'is-on': on === l.p }">
        <path class="por-lead" :d="l.d" />
        <text :x="l.x" :y="l.y" :text-anchor="l.end ? 'end' : 'start'" @pointerenter="on = l.p" @pointerleave="on = null">{{ l.p.name }}</text>
      </g>
      <g v-if="ring.middle" class="por-middle">
        <text :x="ring.cx" :y="ring.cy + MIDDLE_Y.big" class="por-big">{{ middle.big }}</text>
        <text :x="ring.cx" :y="ring.cy + MIDDLE_Y.bigCap" class="por-cap" :style="{ fontSize: `${middle.bigCapSize}px` }">{{ middle.bigCap }}</text>
        <text :x="ring.cx" :y="ring.cy + MIDDLE_Y.line" class="por-mid" :style="{ fontSize: `${middle.lineSize}px` }">{{ middle.line }}</text>
        <text :x="ring.cx" :y="ring.cy + MIDDLE_Y.cap" class="por-cap" :style="{ fontSize: `${middle.capSize}px` }">{{ middle.cap }}</text>
      </g>
    </svg>
  </div>
</template>
