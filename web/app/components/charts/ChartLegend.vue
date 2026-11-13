<script setup lang="ts">
// UI.Legend of assets/components.js: a swatch and a name for each color of a chart. tick: the marker of a reference value instead of a swatch.
defineProps<{ items: { label: string, color?: string, tick?: boolean }[] }>()
</script>

<template>
  <ul class="legend"><li v-for="i in items" :key="i.label"><span v-if="i.tick" class="swatch-tick" /><span v-else class="swatch" :style="{ background: i.color }" />{{ i.label }}</li></ul>
</template>
