<script setup lang="ts">
import { useRafFn } from '@vueuse/core'

// The lines from the outlet at the center of its web to the other outlets of its group in the card of the similarity: each ends at the edge of the card, at the row of the outlet. The row the
// pointer is on (`hover`) has its line lit and the others step back. The places are read from the page each frame (the web and the rows move: the web drifts, the card scrolls).
const props = defineProps<{ root: HTMLElement | undefined, count: number, hover: number, color: string }>()
interface Line { d: string, x: number, y: number }
const lines = ref<Line[]>([])
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
  const next: Line[] = []
  rows.forEach((li) => {
    const r = li.getBoundingClientRect()
    if (r.bottom > k.bottom || r.top < k.top) { next.push({ d: '', x: 0, y: 0 }); return }
    const x = k.left - base.left
    const y = r.top - base.top + r.height / 2
    next.push({ d: `M ${cx.toFixed(1)} ${cy.toFixed(1)} Q ${((cx + x) / 2).toFixed(1)} ${(cy + (y - cy) * 0.35 - 28).toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}`, x, y })
  })
  if (JSON.stringify(next) !== JSON.stringify(lines.value)) lines.value = next
}, { immediate: false })
onMounted(resume)
onBeforeUnmount(pause)
</script>

<template>
  <svg class="outlet-links" aria-hidden="true">
    <template v-for="(l, i) in lines" :key="i">
      <template v-if="l.d">
        <path :d="l.d" fill="none" :stroke="hover === i ? color : 'var(--text-secondary)'" :stroke-width="hover === i ? 2 : 1" :opacity="hover < 0 ? 0.35 : hover === i ? 1 : 0.12" />
        <circle :cx="l.x" :cy="l.y" :r="hover === i ? 4 : 2.5" :fill="hover === i ? color : 'var(--text-secondary)'" :opacity="hover < 0 ? 0.5 : hover === i ? 1 : 0.2" />
      </template>
    </template>
  </svg>
</template>
