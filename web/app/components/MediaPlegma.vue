<script setup lang="ts">
// A tab of Μέσα as a screen of the Plegma (as Home's «Η επικαιρότητα», the story and the theme views): the world is a dim map behind the page (the page meta `backdrop`), the web of the
// tab fills the free area on the left, and the cards of the tab float as glass cards on its right. The cards that do not fit the screen are under it (the default slot).
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
  <section ref="root" class="media-plegma">
    <div class="media-plegma-map"><slot name="map" :active="inView" /></div>
    <div class="media-plegma-side"><slot name="side" /></div>
  </section>
  <div v-if="$slots.default" class="media-plegma-below"><slot /></div>
</template>
