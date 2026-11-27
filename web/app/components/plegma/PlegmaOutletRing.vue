<script setup lang="ts">
import { useResizeObserver } from '@vueuse/core'
import type { StackPart } from '~/components/story/OutletStack.vue'
import { ARC_MIN, arcThick } from '~/utils/plegma/stage/stage-draw-util'
import { RING_START } from '~/utils/plegma/plegma-ring'
import { NAME_MAX } from '~/utils/plegma/stage/stage-names'

// The ring of the outlets of the circle web, alone (no web inside it): an arc for each outlet, the largest first from the start of the ring, as thick as its articles against the largest's,
// in the calm color of its group; the names in two columns beside it, each joined to its arc by a thin line (utils/plegma/stage/stage-names.ts drawColumns). Not in a card: it lies on the Plegma.
// An arc (its band, wider than the arc, so a thin one is easy to point at) or a name under the pointer lights the articles of its outlet on the map.
// In the middle: the articles of the story and its outlets of all (the facts of the title card, which leaves them out while the ring shows).
const props = defineProps<{ parts: StackPart[], articles: number, outlets: number, of: number }>()
const { t } = useI18n()
const emit = defineEmits<{ hover: [part: StackPart | null] }>()
const box = ref<HTMLElement>()
const w = ref(0)
const h = ref(0)
useResizeObserver(box, ([e]) => { w.value = e!.contentRect.width; h.value = e!.contentRect.height })
const on = ref<StackPart | null>(null)
watch(on, part => emit('hover', part))

const GAP = 15
const LINE_OUT = 24
let ctx: CanvasRenderingContext2D | null = null
const font = ref('')
onMounted(() => { font.value = `11.5px ${getComputedStyle(box.value!).fontFamily}`; ctx = document.createElement('canvas').getContext('2d') })
const width = (text: string) => { if (!ctx) return text.length * 6; ctx.font = font.value; return ctx.measureText(text).width }

const soft = (color: string) => `color-mix(in srgb, ${color} 70%, var(--cat-0))`
const ring = computed(() => {
  const parts = [...props.parts].filter(p => p.n > 0).sort((a, b) => b.n - a.n)
  const total = parts.reduce((s, p) => s + p.n, 0)
  // The names need a column of about 130 px on each side.
  const R = Math.min(h.value / 2 - 12, (w.value - 2 * (LINE_OUT + 130)) / 2, 110)
  if (!total || R < 40) return null
  const cx = w.value / 2
  const cy = h.value / 2
  const top = parts[0]!.n
  const at = (a: number, r = R) => ({ x: cx + Math.cos(a - Math.PI / 2) * r, y: cy + Math.sin(a - Math.PI / 2) * r })
  let start = RING_START
  const arcs = parts.map((p) => {
    const span = (p.n / total) * Math.PI * 2
    const thick = arcThick(p.n, top)
    const pad = Math.min(span / 2 - 0.001, (thick / 2 + 1.5) / R)
    const a0 = start + pad
    const a1 = start + span - pad
    const mid = start + span / 2
    start += span
    const p0 = at(a0)
    const p1 = at(a1)
    const d = a1 > a0 ? `M ${p0.x} ${p0.y} A ${R} ${R} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${p1.x} ${p1.y}` : ''
    return { p, d, thick: Math.max(ARC_MIN, thick), mid, end: at(mid) }
  })
  // The names: two columns, on the right the arcs of the right half and on the left the others, each at the height of its arc as far as the names around it allow.
  const names: { p: StackPart, d: string, x: number, y: number, side: 1 | -1, text: string }[] = []
  for (const side of [1, -1] as const) {
    const colx = cx + side * (R + LINE_OUT)
    const room = side === 1 ? w.value - (colx + 9) - 4 : colx - 9 - 4
    const mine = arcs.filter(a => (side === 1 ? Math.sin(a.mid) >= -0.0001 : Math.sin(a.mid) < -0.0001)).sort((u, v) => u.end.y - v.end.y)
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
      let text = `${name} · ${fmtPct(a.p.n / total)}`
      while (text.length > 4 && width(text) > room) text = `${text.slice(0, -2).trimEnd()}…`
      names.push({ p: a.p, d: `M ${a.end.x} ${a.end.y} L ${colx - side * 14} ${y} L ${colx} ${y}`, x: colx, y, side, text })
    })
  }
  // The middle holds the two facts when the ring leaves them room.
  return { arcs, names, cx, cy, middle: R >= 64 }
})
</script>

<template>
  <div ref="box" class="plegma-outlet-ring">
    <svg v-if="ring" :width="w" :height="h" role="group" :aria-label="$t('story.ring.outlets')" :class="{ 'has-hover': on }">
      <path v-for="n in ring.names" :key="`l${n.p.name}`" class="por-line" :d="n.d" />
      <path v-for="a in ring.arcs" :key="a.p.name" class="por-arc" :class="{ 'is-on': on === a.p }" :d="a.d" :stroke="on === a.p ? a.p.color : soft(a.p.color)" :stroke-width="a.thick + (on === a.p ? 1.4 : 0)" />
      <path v-for="a in ring.arcs" :key="`h${a.p.name}`" class="por-hit" :d="a.d" @pointerenter="on = a.p" @pointerleave="on = null" />
      <g v-if="ring.middle" class="por-middle">
        <text :x="ring.cx" :y="ring.cy - 22" class="por-big">{{ fmtInt(articles) }}</text>
        <text :x="ring.cx" :y="ring.cy - 2" class="por-cap">{{ t('entity.fact.articles') }}</text>
        <text :x="ring.cx" :y="ring.cy + 24"><tspan class="por-mid">{{ fmtInt(outlets) }}</tspan><tspan class="por-cap" dx="5">{{ t('entity.fact.of', { n: of }) }}</tspan></text>
        <text :x="ring.cx" :y="ring.cy + 42" class="por-cap">{{ t('entity.fact.outlets') }}</text>
      </g>
      <g v-for="n in ring.names" :key="`n${n.p.name}`" class="por-name" :class="{ 'is-on': on === n.p }" @pointerenter="on = n.p" @pointerleave="on = null">
        <circle :cx="n.x" :cy="n.y" r="3.2" :fill="n.p.color" />
        <text :x="n.x + n.side * 9" :y="n.y" :text-anchor="n.side === 1 ? 'start' : 'end'" dominant-baseline="middle">{{ n.text }}</text>
      </g>
    </svg>
  </div>
</template>
