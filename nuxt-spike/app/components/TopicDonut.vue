<script setup lang="ts">
import type { TopicRow } from '~/types/topics'

const props = defineProps<{ rows: TopicRow[], total: number, colorOf: Map<number, string> }>()
const tooltip = useTooltipStore()

const size = 176
const c = size / 2
const [r0, r1] = [57, 87]
const pad = 0.008

const point = (a: number, r: number) => `${(c + r * Math.sin(a)).toFixed(2)} ${(c - r * Math.cos(a)).toFixed(2)}`
const arc = (a0: number, a1: number) => {
  a0 += pad / 2
  a1 = Math.max(a0 + 0.002, a1 - pad / 2)
  const large = a1 - a0 > Math.PI ? 1 : 0
  return `M${point(a0, r1)}A${r1} ${r1} 0 ${large} 1 ${point(a1, r1)}L${point(a1, r0)}A${r0} ${r0} 0 ${large} 0 ${point(a0, r0)}Z`
}

const slices = computed(() => {
  let a = 0
  return props.rows.map((r) => {
    const span = (r.count / props.total) * 2 * Math.PI
    const d = arc(a, a + span)
    a += span
    return { r, d, color: props.colorOf.get(r.k) ?? 'var(--bar-muted)', ranked: props.colorOf.has(r.k) }
  })
})
const tipOf = (r: TopicRow) => ({ text: `${r.issue.el}: ${fmtInt(r.count)} άρθρα (${fmtPct(r.count / props.total)})` })
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col items-center gap-3">
    <svg :width="size" :height="size" :viewBox="`0 0 ${size} ${size}`" class="shrink-0" role="img" aria-label="Όλα τα θέματα">
      <path
        v-for="s in slices" :key="s.r.k" :d="s.d" :style="{ fill: s.color }"
        :opacity="s.ranked ? 1 : 0.7"
        @pointerenter="tooltip.show(tipOf(s.r), $event)" @pointermove="tooltip.show(tipOf(s.r), $event)" @pointerleave="tooltip.hide()"
      />
      <text :x="c" :y="c + 3" text-anchor="middle" class="fill-current text-lg font-semibold">{{ fmtInt(total) }}</text>
      <text :x="c" :y="c + 19" text-anchor="middle" class="fill-[var(--text-secondary)] text-xs">άρθρα</text>
    </svg>
    <ul class="max-h-96 min-h-0 w-full flex-1 overflow-y-auto pr-1 text-sm lg:max-h-none">
      <li v-for="s in slices" :key="s.r.k" class="flex items-center gap-2 py-0.5" :title="tipOf(s.r).text">
        <span class="size-2 shrink-0 rounded-full" :style="{ background: s.color }" aria-hidden="true" />
        <NuxtLink :to="`/topic/${s.r.k}`" class="min-w-0 flex-1 truncate hover:underline">{{ s.r.issue.el }}</NuxtLink>
        <span class="tabular-nums text-[var(--text-secondary)]">{{ fmtPct(s.r.count / total) }}</span>
      </li>
    </ul>
  </div>
</template>
