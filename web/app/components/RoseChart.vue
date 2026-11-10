<script setup lang="ts">
import { useElementSize } from '@vueuse/core'

// The rose of the related outlets (RoseChart in outlet-v2.html): a slice as wide as the similarity that reaches as far as it. The color of a slice is the group of the outlet.
// A narrow slice has no label of its own (it would sit on its neighbors): its value is in the list under the pie.
export interface RoseSlice { name: string, score: number, color: string, tip: string }
const props = defineProps<{ rows: RoseSlice[] }>()
const tooltip = useTooltipStore()
const holder = ref<HTMLElement | null>(null)
const { width: measured } = useElementSize(holder)
const width = computed(() => Math.floor(measured.value))
const size = computed(() => Math.min(width.value, 340))
const R = computed(() => size.value / 2 - 30)
const cx = computed(() => width.value / 2)
const cy = computed(() => size.value / 2)
const pt = (r: number, a: number): [number, number] => [cx.value + r * Math.cos(a), cy.value + r * Math.sin(a)]

const slices = computed(() => {
  const total = props.rows.reduce((a, r) => a + r.score, 0)
  const top = Math.max(...props.rows.map(r => r.score))
  let a0 = -Math.PI / 2
  return props.rows.map((r) => {
    const sweep = (r.score / total) * Math.PI * 2
    const a1 = a0 + sweep
    const rad = R.value * (r.score / top)
    const [x0, y0] = pt(rad, a0)
    const [x1, y1] = pt(rad, a1)
    const d = props.rows.length === 1
      ? `M ${cx.value - rad} ${cy.value} a ${rad} ${rad} 0 1 0 ${rad * 2} 0 a ${rad} ${rad} 0 1 0 ${-rad * 2} 0 Z`
      : `M ${cx.value} ${cy.value} L ${x0} ${y0} A ${rad} ${rad} 0 ${sweep > Math.PI ? 1 : 0} 1 ${x1} ${y1} Z`
    const mid = a0 + sweep / 2
    const [lx, ly] = pt(rad + 10, mid)
    const side = Math.cos(mid)
    const out = { r, d, label: sweep >= 0.4 ? { x: lx, y: ly + 4, anchor: side > 0.3 ? 'start' : side < -0.3 ? 'end' : 'middle' } : null }
    a0 = a1
    return out
  })
})
</script>

<template>
  <div ref="holder" class="fit">
    <svg v-if="width" class="chart" :width="width" :height="size" :viewBox="`0 0 ${width} ${size}`" aria-hidden="true">
      <template v-for="s in slices" :key="s.r.name">
        <path class="rose-slice" :d="s.d" :fill="s.r.color" stroke="var(--surface-page)" stroke-width="2" stroke-linejoin="round" @pointermove="tooltip.show({ title: s.r.tip }, $event)" @pointerleave="tooltip.hide()" />
        <text v-if="s.label" :x="s.label.x" :y="s.label.y" :text-anchor="s.label.anchor">{{ fmtPct(s.r.score) }}</text>
      </template>
    </svg>
  </div>
</template>
