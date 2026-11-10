<script setup lang="ts">
// UI.Legend of assets/components.js: a swatch and a name for each color of a chart.
defineProps<{ items: { label: string, color: string }[] }>()
</script>

<template>
  <ul class="legend"><li v-for="i in items" :key="i.label"><span class="swatch" :style="{ background: i.color }" />{{ i.label }}</li></ul>
</template>
