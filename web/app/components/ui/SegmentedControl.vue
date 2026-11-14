<script setup lang="ts">
// UI.SegmentedControl of assets/components.js: one choice of a few, as buttons in one group.
defineProps<{ options: { value: string, label: string }[], label: string }>()
const model = defineModel<string>({ required: true })
// A click on the choice that is already on changes nothing in the model; `again` says it happened (a page where the tab that is on can be turned off).
const emit = defineEmits<{ again: [value: string] }>()
const choose = (value: string) => { if (value === model.value) emit('again', value); else model.value = value }
</script>

<template>
  <div class="segmented" role="group" :aria-label="label">
    <button v-for="o in options" :key="o.value" type="button" :aria-pressed="o.value === model" @click="choose(o.value)">{{ o.label }}</button>
  </div>
</template>
