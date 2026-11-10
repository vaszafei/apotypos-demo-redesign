<script setup lang="ts">
// UI.SegmentedControl of assets/components.js: one choice of a few, as buttons in one group.
defineProps<{ options: { value: string, label: string }[], label: string }>()
const model = defineModel<string>({ required: true })
</script>

<template>
  <div class="segmented" role="group" :aria-label="label">
    <button v-for="o in options" :key="o.value" type="button" :aria-pressed="o.value === model" @click="model = o.value">{{ o.label }}</button>
  </div>
</template>
