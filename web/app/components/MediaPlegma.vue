<script setup lang="ts">
defineProps<{ full?: boolean, variant?: 'topics' | 'stories' }>()
// A tab of Μέσα as a screen of the Plegma (as Home's «Η επικαιρότητα», the story and the theme views): the world is a dim map behind the page (the page meta `backdrop`), the web of the
// tab fills the free area on the left, and the cards of the tab float as glass cards on its right. The cards that do not fit the screen are under it (the default slot).
// `full`: the web takes the whole width (Στάση, a plot) and the cards float over its empty top right corner. `variant` 'topics' (Θέματα): the web with a card under it (`map`) on the left, a chart (`aside`) on the right, as 2 : 5 : 3, and under the cards and the web (`under`) a card as wide as the two; 'stories' (Ιστορίες): a card (`side`) as tall as the two rows on the left, and the web (`map`) with a card under it (`under`) on the right, as 3 : 5.
// The web runs only while the screen is in view, and it grows when it comes into view (`active` of the map slot).
const root = ref<HTMLElement>()
const inView = ref(false)
let watcher: IntersectionObserver | null = null
onMounted(() => {
  watcher = new IntersectionObserver(([entry]) => { inView.value = !!entry?.isIntersecting }, { threshold: 0.25 })
  if (root.value) watcher.observe(root.value)
})
onBeforeUnmount(() => watcher?.disconnect())
</script>

<template>
  <section ref="root" class="media-plegma" :class="[{ 'is-full': full }, variant && `is-${variant}`]">
    <div class="media-plegma-map"><slot name="map" :active="inView" /></div>
    <div class="media-plegma-side"><slot name="side" /></div>
    <div v-if="$slots.aside" class="media-plegma-aside"><slot name="aside" /></div>
    <div v-if="$slots.under" class="media-plegma-under"><slot name="under" /></div>
  </section>
  <div v-if="$slots.default" class="media-plegma-below"><slot /></div>
</template>
