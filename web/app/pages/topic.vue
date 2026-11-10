<script setup lang="ts">
// Θέματα › one topic (topic-v2.html?i=): the daily articles, the stance, the outlets and groups that write it more or less than usual, its stories. A detail page of the tab Θέματα.
definePageMeta({ detail: '/trends' })
const { t } = useI18n()
useHead({ title: () => `${t('nav.topics')} · ${t('site.name')}` })
const route = useRoute()
// The first topic when there is no index, as the static page. Anything that is not a whole number is the 404 page.
const index = computed(() => Number(route.query.i || 0))
// The page is drawn in the browser: the index is in the query, which the prerendered page does not have, and the data of the stories is 1.4 MB that the page should not carry.
watch(index, () => window.scrollTo(0, 0))
</script>

<template>
  <ClientOnly><TopicDetail :key="String(index)" :index="index" /></ClientOnly>
</template>
