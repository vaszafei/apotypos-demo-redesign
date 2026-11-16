<script setup lang="ts">
import { useMediaQuery, useResizeObserver, useIntersectionObserver, useMutationObserver } from '@vueuse/core'
import { drawMethodRow, METHOD_LOOP_PLAY } from '~/utils/method-scene'
import type { MethodLabels, MethodPalette } from '~/utils/method-scene'

// One animation of «Μεθοδολογία»: the dots of one step on the Plegma world, looping while it is in view. A phone or a reader who asks for less motion gets the end of the step, still.
const props = defineProps<{ row: number, labels: MethodLabels, label: string }>()
const canvas = ref<HTMLCanvasElement>()
const reduced = useMediaQuery('(prefers-reduced-motion: reduce)')
const visible = ref(false)
const CYCLE_MS = 8000
let loop = METHOD_LOOP_PLAY
let raf = 0
let last = 0
let palette: MethodPalette | null = null

const readPalette = (el: HTMLElement): MethodPalette => {
  const style = getComputedStyle(el)
  const v = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback
  return {
    ink: v('--ink', '#111'),
    mute: v('--text-secondary', '#666'),
    groups: Array.from({ length: 9 }, (_, i) => v(`--cat-${i}`, '#999')),
    themes: Array.from({ length: 8 }, (_, i) => v(`--cat-${i + 1}`, '#999')),
    agree: v('--stance-supportive', '#1f8f5f'),
    differ: v('--stance-critical', '#c0392b')
  }
}
const paint = () => {
  const el = canvas.value
  const ctx = el?.getContext('2d')
  if (!el || !ctx) return
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const w = el.clientWidth
  const h = el.clientHeight
  if (!w || !h) return
  if (el.width !== Math.round(w * dpr)) { el.width = Math.round(w * dpr); el.height = Math.round(h * dpr) }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  palette ??= readPalette(el)
  drawMethodRow(ctx, w, h, props.row, Math.min(1, loop / METHOD_LOOP_PLAY), palette, props.labels)
  el.style.opacity = String(loop < 0.05 ? loop / 0.05 : loop > 0.94 ? (1 - loop) / 0.06 : 1)
}
const tick = (now: number) => {
  loop = (loop + (now - last) / CYCLE_MS) % 1
  if (loop < 0.02) palette = null
  last = now
  paint()
  raf = requestAnimationFrame(tick)
}
const stop = () => { cancelAnimationFrame(raf); raf = 0 }
const run = () => {
  stop()
  if (visible.value && !reduced.value) { last = performance.now(); loop = 0; raf = requestAnimationFrame(tick) }
  else { loop = METHOD_LOOP_PLAY; palette = null; paint() }
}
useIntersectionObserver(canvas, ([entry]) => { visible.value = !!entry?.isIntersecting })
useResizeObserver(canvas, () => { if (!raf) paint() })
watch([visible, reduced], run)
watch(() => props.labels, () => { palette = null; if (!raf) paint() })
onMounted(run)
useMutationObserver(() => document.documentElement, () => { palette = null; if (!raf) paint() }, { attributes: true })
onBeforeUnmount(stop)
</script>

<template>
  <canvas ref="canvas" class="method-canvas" role="img" :aria-label="label" />
</template>
