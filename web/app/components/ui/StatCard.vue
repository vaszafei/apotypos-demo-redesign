<script setup lang="ts">
// Dash.Stat of assets/dash.js: a label, a value and a line under it, in a small card.
defineProps<{ label: string, value: string, sub: string }>()
</script>

<template>
  <section class="dcard dstat">
    <h2 class="dstat-label">{{ label }}</h2>
    <div class="dstat-row"><p class="dstat-value">{{ value }}</p><p class="dstat-sub">{{ sub }}</p></div>
  </section>
</template>
