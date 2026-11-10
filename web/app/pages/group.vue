<script setup lang="ts">
// Μέσα › Ιδιοκτησία › one ownership group (group-v2.html?g=): its outlets, its daily articles, the topics it writes more or less than all outlets. A detail page of the tab Ιδιοκτησία.
definePageMeta({ detail: '/groups' })
const { t } = useI18n()
useHead({ title: () => `${t('nav.media')} · ${t('site.name')}` })
const route = useRoute()
// Politis Group when there is no slug, as the static page.
const slug = computed(() => String(route.query.g || 'politis'))
// The page is drawn in the browser: the slug is in the query, which the prerendered page does not have, and the data of the stories is 1.4 MB that the page should not carry.
watch(slug, () => window.scrollTo(0, 0))
</script>

<template>
  <ClientOnly><GroupDetail :key="slug" :slug="slug" /></ClientOnly>
</template>
