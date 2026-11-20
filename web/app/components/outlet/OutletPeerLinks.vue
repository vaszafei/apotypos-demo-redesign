<script setup lang="ts">
import { useRafFn } from '@vueuse/core'

// The lines from the outlet at the center of its web to the other outlets of its group in the card of the similarity: each ends at the edge of the card, at the row of the outlet. The row the
// pointer is on (`hover`) has its line lit and the others step back. The places are read from the page each frame (the web and the rows move: the web drifts, the card scrolls).
// A line is a way to the outlet too: under the pointer it lights as its row does (`hover`), and a click opens the outlet (`open`). The lines come in with the card (`order`: its order of arrival, components/plegma/PlegmaCard.vue).
const props = defineProps<{ root: HTMLElement | undefined, count: number, hover: number, color: string, order: number }>()
const emit = defineEmits<{ hover: [index: number | null], open: [index: number] }>()
interface Line { d: string, hit: string, x: number, y: number }
const lines = ref<Line[]>([])
// A point of a quadratic curve (one coordinate), and the start and the control point of its part from t0 to t1.
const at = (p0: number, p1: number, p2: number, t: number) => (1 - t) ** 2 * p0 + 2 * (1 - t) * t * p1 + t * t * p2
const split = (x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, t0: number, t1: number) => {
  const lerp = (p: number, q: number, t: number) => p + (q - p) * t
  const cxp = lerp(lerp(x0, x1, t0), lerp(x1, x2, t0), t1)
  const cyp = lerp(lerp(y0, y1, t0), lerp(y1, y2, t0), t1)
  return [{ x: at(x0, x1, x2, t0), y: at(y0, y1, y2, t0) }, { x: cxp, y: cyp }] as const
}
const { pause, resume } = useRafFn(() => {
  const root = props.root
  if (!root || !props.count) { if (lines.value.length) lines.value = []; return }
  const base = root.getBoundingClientRect()
  const canvas = root.querySelector<HTMLCanvasElement>('.outlet-article-web canvas')
  const card = root.querySelector<HTMLElement>('.card-similar')
  const rows = card ? [...card.querySelectorAll<HTMLElement>('.bar-list > li')] : []
  if (!canvas || !card || !rows.length) { if (lines.value.length) lines.value = []; return }
  const c = canvas.getBoundingClientRect()
  const k = card.getBoundingClientRect()
  const cx = c.left - base.left + c.width / 2
  const cy = c.top - base.top + c.height / 2 - 8
  const web = Math.min(c.width, c.height) / 2
  const next: Line[] = []
  rows.forEach((li) => {
    const r = li.getBoundingClientRect()
    if (r.bottom > k.bottom || r.top < k.top) { next.push({ d: '', hit: '', x: 0, y: 0 }); return }
    const x = k.left - base.left
    const y = r.top - base.top + r.height / 2
    const qx = (cx + x) / 2
    const qy = cy + (y - cy) * 0.35 - 28
    // The part of the line the pointer takes: from where it leaves the web (the web keeps its own pointer) to just before the card.
    let t0 = 0
    while (t0 < 0.9 && Math.hypot((1 - t0) ** 2 * cx + 2 * (1 - t0) * t0 * qx + t0 * t0 * x - cx, (1 - t0) ** 2 * cy + 2 * (1 - t0) * t0 * qy + t0 * t0 * y - cy) < web) t0 += 0.01
    const [a, b] = split(cx, cy, qx, qy, x, y, t0, 0.97)
    next.push({ d: `M ${cx.toFixed(1)} ${cy.toFixed(1)} Q ${qx.toFixed(1)} ${qy.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}`, hit: `M ${a.x.toFixed(1)} ${a.y.toFixed(1)} Q ${b.x.toFixed(1)} ${b.y.toFixed(1)} ${(at(cx, qx, x, 0.97)).toFixed(1)} ${(at(cy, qy, y, 0.97)).toFixed(1)}`, x, y })
  })
  if (JSON.stringify(next) !== JSON.stringify(lines.value)) lines.value = next
}, { immediate: false })
onMounted(resume)
onBeforeUnmount(pause)
</script>

<template>
  <svg class="outlet-links" aria-hidden="true" :style="{ '--i': order }">
    <template v-for="(l, i) in lines" :key="i">
      <template v-if="l.d">
        <path class="outlet-link-hit" :d="l.hit" fill="none" stroke="transparent" stroke-width="12" @pointerenter="emit('hover', i)" @pointerleave="emit('hover', null)" @click="emit('open', i)" />
        <path :d="l.d" fill="none" :stroke="hover === i ? color : 'var(--text-secondary)'" :stroke-width="hover === i ? 2 : 1" :opacity="hover < 0 ? 0.35 : hover === i ? 1 : 0.12" />
        <circle :cx="l.x" :cy="l.y" :r="hover === i ? 4 : 2.5" :fill="hover === i ? color : 'var(--text-secondary)'" :opacity="hover < 0 ? 0.5 : hover === i ? 1 : 0.2" />
      </template>
    </template>
  </svg>
</template>
