<script setup lang="ts">
import { useResizeObserver } from '@vueuse/core'
import { ARC_MIN, arcThick } from '~/utils/plegma/stage/stage-draw-util'
import { RING_START } from '~/utils/plegma/plegma-ring'

// The ring of the circle web, alone (no web inside it, no names): an arc for each part, from the start of the ring, as wide as its weight (`w`, else its count) and as thick as its count
// against the largest's, in the calm color of its group (a silent part, which has no articles, is a thin dashed arc). Not in a card: it lies on the Plegma. An arc under the pointer
// (its band, wider than the arc) is the part pointed at (`hover`). In the middle: a big number and a line under it (`middle`), or those of the part pointed at (`pointed`).
export interface RingPart { key: string, name: string, group: string | null, n: number, color: string, w?: number, silent?: boolean }
export interface RingMiddle { big: string, bigCap: string, line: string, cap: string }
const props = withDefaults(defineProps<{ parts: RingPart[], middle: RingMiddle, pointed: (p: RingPart) => RingMiddle, sorted?: boolean }>(), { sorted: true })
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

const soft = (color: string) => `color-mix(in srgb, ${color} 70%, var(--cat-0))`
const ring = computed(() => {
  const parts = props.sorted ? [...props.parts].filter(p => p.n > 0).sort((a, b) => b.n - a.n) : props.parts
  const weight = (p: RingPart) => p.w ?? p.n
  const total = parts.reduce((s, p) => s + weight(p), 0)
  const R = Math.min(h.value / 2 - 6, w.value / 2 - 6, 90)
  if (!total || R < 40) return null
  const cx = w.value / 2
  const cy = h.value / 2
  const top = Math.max(1, ...parts.map(p => p.n))
  const at = (a: number) => ({ x: cx + Math.cos(a - Math.PI / 2) * R, y: cy + Math.sin(a - Math.PI / 2) * R })
  let start = RING_START
  const arcs = parts.map((p) => {
    const span = (weight(p) / total) * Math.PI * 2
    const thick = p.silent ? 1.5 : Math.max(ARC_MIN, arcThick(p.n, top))
    const pad = Math.min(span / 2 - 0.001, (Math.max(thick, ARC_MIN) / 2 + 1.5) / R)
    const a0 = start + pad
    const a1 = start + span - pad
    start += span
    const p0 = at(a0)
    const p1 = at(a1)
    return { p, thick, d: a1 > a0 ? `M ${p0.x} ${p0.y} A ${R} ${R} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${p1.x} ${p1.y}` : '' }
  })
  // The middle holds a number and a line when the ring leaves them room; a line is as wide as the inside of the ring at its height.
  return { arcs, cx, cy, middle: R >= 60, room: 2 * Math.sqrt(Math.max(0, (R - 8) ** 2 - 34 ** 2)) - 8 }
})
const middle = computed(() => {
  const r = ring.value
  const m = on.value ? props.pointed(on.value) : props.middle
  return r ? { ...m, line: fit(m.line, '600 20px', r.room), cap: fit(m.cap, '12px', r.room), bigCap: fit(m.bigCap, '12px', r.room) } : m
})
</script>

<template>
  <div ref="box" class="plegma-ring">
    <svg v-if="ring" :width="w" :height="h">
      <path v-for="a in ring.arcs" :key="a.p.key" class="por-arc" :class="{ 'is-on': on === a.p, 'is-silent': a.p.silent }" :d="a.d" :stroke="a.p.silent ? undefined : on === a.p ? a.p.color : soft(a.p.color)" :stroke-width="a.thick + (on === a.p ? 1.4 : 0)" />
      <path v-for="a in ring.arcs" :key="`h${a.p.key}`" class="por-hit" :d="a.d" @pointerenter="on = a.p" @pointerleave="on = null" />
      <g v-if="ring.middle" class="por-middle">
        <text :x="ring.cx" :y="ring.cy - 22" class="por-big">{{ middle.big }}</text>
        <text :x="ring.cx" :y="ring.cy - 2" class="por-cap">{{ middle.bigCap }}</text>
        <text :x="ring.cx" :y="ring.cy + 24" class="por-mid">{{ middle.line }}</text>
        <text :x="ring.cx" :y="ring.cy + 42" class="por-cap">{{ middle.cap }}</text>
      </g>
    </svg>
  </div>
</template>
