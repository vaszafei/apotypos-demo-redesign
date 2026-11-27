<script setup lang="ts">
import { useResizeObserver } from '@vueuse/core'
import { ARC_MIN, arcThick } from '~/utils/plegma/stage/stage-draw-util'
import { RING_START } from '~/utils/plegma/plegma-ring'
import { NAME_MAX } from '~/utils/plegma/stage/stage-names'

// The ring of the circle web, alone (no web inside it): an arc for each part, from the start of the ring, as wide as its weight (`w`, else its count) and as thick as its count against
// the largest's, in the calm color of its group (a silent part, which has no articles, is a thin dashed arc); the names in two columns beside it, each joined to its arc by a thin line
// (utils/plegma/stage/stage-names.ts drawColumns). Not in a card: it lies on the Plegma. An arc (its band, wider than the arc) or a name under the pointer is the part pointed at (`hover`).
// In the middle: a big number and a line under it (`middle`), or those of the part pointed at (`pointed`).
export interface RingPart { key: string, name: string, group: string | null, n: number, color: string, w?: number, silent?: boolean }
export interface RingMiddle { big: string, bigCap: string, line: string, cap: string }
// `bare`: the ring alone in its room, with no names (the middle names the part pointed at).
// `compact`: the ring on the left of its room and the names in one list beside it, the largest first, as many as fit (and how many more), with no lines to the arcs.
const props = withDefaults(defineProps<{ parts: RingPart[], middle: RingMiddle, pointed: (p: RingPart) => RingMiddle, sorted?: boolean, named?: (p: RingPart) => boolean, label?: (p: RingPart, total: number) => string, compact?: boolean, bare?: boolean }>(), { sorted: true, compact: false, bare: false })
const emit = defineEmits<{ hover: [part: RingPart | null] }>()
const box = ref<HTMLElement>()
const w = ref(0)
const h = ref(0)
useResizeObserver(box, ([e]) => { w.value = e!.contentRect.width; h.value = e!.contentRect.height })
const on = ref<RingPart | null>(null)
watch(on, part => emit('hover', part))
watch(() => props.parts, () => { on.value = null })

const GAP = 15
const LINE_OUT = 24
let ctx: CanvasRenderingContext2D | null = null
const family = ref('')
onMounted(() => { family.value = getComputedStyle(box.value!).fontFamily; ctx = document.createElement('canvas').getContext('2d') })
const width = (text: string, font = '11.5px') => { if (!ctx) return text.length * 6; ctx.font = `${font} ${family.value}`; return ctx.measureText(text).width }
// A text cut to a width (with …).
const fit = (text: string, font: string, room: number) => { let s = text; while (s.length > 4 && width(s, font) > room) s = `${s.slice(0, -2).trimEnd()}…`; return s }

const soft = (color: string) => `color-mix(in srgb, ${color} 70%, var(--cat-0))`
const ring = computed(() => {
  const parts = props.sorted ? [...props.parts].filter(p => p.n > 0).sort((a, b) => b.n - a.n) : props.parts
  const weight = (p: RingPart) => p.w ?? p.n
  const total = parts.reduce((s, p) => s + weight(p), 0)
  const count = parts.reduce((s, p) => s + p.n, 0)
  // The names need a column of about 130 px on each side.
  const R = props.bare ? Math.min(h.value / 2 - 6, w.value / 2 - 6, 90) : props.compact ? Math.min(h.value / 2 - 6, (w.value - 140) / 2, 90) : Math.min(h.value / 2 - 12, (w.value - 2 * (LINE_OUT + 130)) / 2, 110)
  if (!total || R < 40) return null
  const cx = props.compact && !props.bare ? R + 6 : w.value / 2
  const cy = h.value / 2
  const top = Math.max(1, ...parts.map(p => p.n))
  const at = (a: number, r = R) => ({ x: cx + Math.cos(a - Math.PI / 2) * r, y: cy + Math.sin(a - Math.PI / 2) * r })
  let start = RING_START
  const arcs = parts.map((p) => {
    const span = (weight(p) / total) * Math.PI * 2
    const thick = p.silent ? 1.5 : arcThick(p.n, top)
    const pad = Math.min(span / 2 - 0.001, (Math.max(thick, ARC_MIN) / 2 + 1.5) / R)
    const a0 = start + pad
    const a1 = start + span - pad
    const mid = start + span / 2
    start += span
    const p0 = at(a0)
    const p1 = at(a1)
    const d = a1 > a0 ? `M ${p0.x} ${p0.y} A ${R} ${R} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${p1.x} ${p1.y}` : ''
    return { p, d, thick: p.silent ? thick : Math.max(ARC_MIN, thick), mid, end: at(mid) }
  })
  // The names: two columns, on the right the arcs of the right half and on the left the others, each at the height of its arc as far as the names around it allow.
  const names: { p: RingPart, d: string, x: number, y: number, side: 1 | -1, text: string }[] = []
  let more = 0
  if (props.bare) return { arcs, names, cx, cy, middle: R >= 60, room: 2 * Math.sqrt(Math.max(0, (R - 8) ** 2 - 34 ** 2)) - 8, more: null, moreN: 0 }
  if (props.compact) {
    const list = arcs.filter(a => !props.named || props.named(a.p)).sort((u, v) => v.p.n - u.p.n)
    const lines = Math.max(1, Math.floor((h.value - 4) / 16))
    const shown = list.length > lines ? list.slice(0, lines - 1) : list
    more = list.length - shown.length
    const x = 2 * R + 30
    const top = cy - ((shown.length + (more ? 1 : 0)) * 16) / 2 + 8
    shown.forEach((a, k) => names.push({ p: a.p, d: '', x, y: top + k * 16, side: 1, text: fit(props.label ? props.label(a.p, count) : `${a.p.name} · ${fmtPct(a.p.n / count)}`, '11.5px', w.value - x - 14) }))
    return { arcs, names, cx, cy, middle: R >= 64, room: 2 * Math.sqrt(Math.max(0, (R - 8) ** 2 - 34 ** 2)) - 8, more: more ? { x: x + 9, y: top + shown.length * 16 } : null, moreN: more }
  }
  for (const side of [1, -1] as const) {
    const colx = cx + side * (R + LINE_OUT)
    const room = side === 1 ? w.value - (colx + 9) - 4 : colx - 9 - 4
    const mine = arcs.filter(a => (!props.named || props.named(a.p)) && (side === 1 ? Math.sin(a.mid) >= -0.0001 : Math.sin(a.mid) < -0.0001)).sort((u, v) => u.end.y - v.end.y)
    const ys = mine.map(a => a.end.y)
    for (let round = 0; round < 60; round++) {
      let moved = false
      for (let k = 1; k < ys.length; k++) { const miss = GAP - (ys[k]! - ys[k - 1]!); if (miss > 0.1) { ys[k - 1]! -= miss / 2; ys[k]! += miss / 2; moved = true } }
      if (!moved) break
    }
    for (let k = ys.length - 1; k >= 0; k--) ys[k] = Math.min(ys[k]!, k === ys.length - 1 ? h.value - 6 : ys[k + 1]! - GAP)
    for (let k = 0; k < ys.length; k++) ys[k] = Math.max(ys[k]!, k === 0 ? 8 : ys[k - 1]! + GAP)
    mine.forEach((a, k) => {
      const y = ys[k]!
      if (y > h.value - 6 + 0.5) return
      const name = a.p.name.length > NAME_MAX ? `${a.p.name.slice(0, NAME_MAX - 1)}…` : a.p.name
      const text = fit(props.label ? props.label(a.p, count) : `${name} · ${fmtPct(a.p.n / count)}`, '11.5px', room)
      names.push({ p: a.p, d: `M ${a.end.x} ${a.end.y} L ${colx - side * 14} ${y} L ${colx} ${y}`, x: colx, y, side, text })
    })
  }
  // The middle holds a number and a line when the ring leaves them room; a line is as wide as the inside of the ring at its height.
  return { arcs, names, cx, cy, middle: R >= 64, room: 2 * Math.sqrt(Math.max(0, (R - 8) ** 2 - 34 ** 2)) - 8, more: null, moreN: 0 }
})
const middle = computed(() => {
  const r = ring.value
  const m = on.value ? props.pointed(on.value) : props.middle
  return r ? { ...m, line: fit(m.line, '600 20px', r.room), cap: fit(m.cap, '12px', r.room), bigCap: fit(m.bigCap, '12px', r.room) } : m
})
</script>

<template>
  <div ref="box" class="plegma-ring">
    <svg v-if="ring" :width="w" :height="h" :class="{ 'has-hover': on }">
      <template v-for="n in ring.names" :key="`l${n.p.key}`"><path v-if="n.d" class="por-line" :d="n.d" /></template>
      <text v-if="ring.more" :x="ring.more.x" :y="ring.more.y" class="por-more" dominant-baseline="middle">{{ $t('story.views.more', { n: ring.moreN }) }}</text>
      <path v-for="a in ring.arcs" :key="a.p.key" class="por-arc" :class="{ 'is-on': on === a.p, 'is-silent': a.p.silent }" :d="a.d" :stroke="a.p.silent ? undefined : on === a.p ? a.p.color : soft(a.p.color)" :stroke-width="a.thick + (on === a.p ? 1.4 : 0)" />
      <path v-for="a in ring.arcs" :key="`h${a.p.key}`" class="por-hit" :d="a.d" @pointerenter="on = a.p" @pointerleave="on = null" />
      <g v-if="ring.middle" class="por-middle">
        <text :x="ring.cx" :y="ring.cy - 22" class="por-big">{{ middle.big }}</text>
        <text :x="ring.cx" :y="ring.cy - 2" class="por-cap">{{ middle.bigCap }}</text>
        <text :x="ring.cx" :y="ring.cy + 24" class="por-mid">{{ middle.line }}</text>
        <text :x="ring.cx" :y="ring.cy + 42" class="por-cap">{{ middle.cap }}</text>
      </g>
      <g v-for="n in ring.names" :key="`n${n.p.key}`" class="por-name" :class="{ 'is-on': on === n.p }" @pointerenter="on = n.p" @pointerleave="on = null">
        <circle :cx="n.x" :cy="n.y" r="3.2" :fill="n.p.silent ? 'var(--text-secondary)' : n.p.color" />
        <text :x="n.x + n.side * 9" :y="n.y" :text-anchor="n.side === 1 ? 'start' : 'end'" dominant-baseline="middle">{{ n.text }}</text>
      </g>
    </svg>
  </div>
</template>
