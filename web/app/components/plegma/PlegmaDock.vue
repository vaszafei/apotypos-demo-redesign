<script setup lang="ts">
import type { PlegmaStoryCard } from '~/utils/plegma-story'

// The chips of the cards that wait outside the four slots: one opens at a time, and the same chip closes it.
defineProps<{ items: { key: PlegmaStoryCard, label: string }[], open: PlegmaStoryCard | null }>()
defineEmits<{ toggle: [key: PlegmaStoryCard] }>()
</script>

<template>
  <div class="plegma-dock" role="group">
    <button v-for="c in items" :key="c.key" type="button" class="plegma-chip" :aria-pressed="open === c.key" @click="$emit('toggle', c.key)">{{ c.label }}</button>
  </div>
</template>
