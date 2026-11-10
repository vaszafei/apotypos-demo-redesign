<script setup lang="ts">
// Dash.Stat of assets/dash.js: a small card with a label, a value, a line under it (sub) and a small picture (the slot viz). The slot value replaces the text (a link).
// text: the value is a name, not a number (a smaller size).
defineProps<{ label: string, value?: string, sub?: string, text?: boolean }>()
</script>

<template>
  <section class="dcard dstat">
    <h2 class="dstat-label">{{ label }}</h2>
    <div class="dstat-row">
      <p class="dstat-value" :class="{ 'is-text': text }"><slot name="value">{{ value }}</slot></p>
      <p class="dstat-sub">{{ sub }}</p>
      <slot name="viz" />
    </div>
  </section>
</template>
