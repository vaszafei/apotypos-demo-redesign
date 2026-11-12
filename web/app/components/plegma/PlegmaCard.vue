<script setup lang="ts">
import { useResizeObserver } from '@vueuse/core'

// One floating card of the Orbit: a raised surface that takes the pointer only on itself, so the map and the gaps between cards pass it to the stage (KTD8).
// `at` is its slot (0 and 1 on the right, 2 and 3 below the map); `order` is when it arrives after the camera lands. It arrives as thin bars leaning like the "/" of the logo, which grow and
// shrink one after the other from the top left corner to the bottom right, and its content shows as they shrink (assets/css/plegma.css, ".plegma-blocks").
defineProps<{ at: number, order: number }>()
const BARS = 16
// The bars lie along the diagonal of the card, so their pitch is the card's (width + height) over the bars, seen across the lean (1 / sqrt 2); a bar is most of its pitch wide.
const card = ref<HTMLElement>()
const bar = ref(14)
useResizeObserver(card, () => { const el = card.value; if (el) bar.value = Math.max(6, Math.round(((el.offsetWidth + el.offsetHeight) / BARS / Math.SQRT2) * 0.72)) })
</script>

<template>
  <div ref="card" class="plegma-card" :class="`at-${at}`" :style="{ '--i': order, '--bar': `${bar}px` }">
    <div class="plegma-card-body"><slot /></div>
    <span class="plegma-blocks" aria-hidden="true"><i v-for="n in BARS" :key="n" :style="{ '--k': n - 1 }" /></span>
  </div>
</template>
