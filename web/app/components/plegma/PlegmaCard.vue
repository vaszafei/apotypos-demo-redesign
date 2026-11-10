<script setup lang="ts">
// One floating card of the Orbit: a raised surface that takes the pointer only on itself, so the map and the gaps between cards pass it to the stage (KTD8).
// `at` is its slot (0 and 1 on the right, 2 and 3 below the map); `order` is when it arrives after the camera lands.
defineProps<{ at: number, order: number }>()
</script>

<template>
  <div class="plegma-card" :class="`at-${at}`" :style="{ '--i': order }"><slot /></div>
</template>
