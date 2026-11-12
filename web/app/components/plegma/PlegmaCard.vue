<script setup lang="ts">
// One floating card of the Orbit: a raised surface that takes the pointer only on itself, so the map and the gaps between cards pass it to the stage (KTD8).
// `at` is its slot (0 and 1 on the right, 2 and 3 below the map); `order` is when it arrives after the camera lands. It arrives as a grid of blocks (8 by 5) that grow and shrink in a
// sweep from the top left corner (the "blocks" loading spinner), and its content shows as they shrink (assets/css/plegma.css, ".plegma-blocks").
defineProps<{ at: number, order: number }>()
</script>

<template>
  <div class="plegma-card" :class="`at-${at}`" :style="{ '--i': order }">
    <div class="plegma-card-body"><slot /></div>
    <span class="plegma-blocks" aria-hidden="true"><i v-for="n in 40" :key="n" :style="{ '--d': Math.floor((n - 1) / 8) + ((n - 1) % 8) }" /></span>
  </div>
</template>
