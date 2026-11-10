<script setup lang="ts">
// Μέσα › Ιστορίες › one story (story-v2.html?id=): the story on the Plegma, with its cards around the map (components/plegma/PlegmaStoryView.vue). A detail page of the tab Ιστορίες.
definePageMeta({ detail: '/stories', plegma: true })
const { t } = useI18n()
useHead({ title: () => `${t('tab.media.stories')} · ${t('site.name')}` })
const route = useRoute()
const id = computed(() => Number(route.query.id))
// The page is drawn in the browser: the id is in the query, which the prerendered page does not have, and the data of a story is 1.4 MB that the page should not carry.
// A related story opens at the top, as the static page does (the router keeps the scroll of a link that changes only the query).
watch(id, () => window.scrollTo(0, 0))
</script>

<template>
  <ClientOnly><PlegmaStoryView :key="String(id)" :id="id" /></ClientOnly>
</template>
