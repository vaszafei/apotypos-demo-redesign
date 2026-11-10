<script setup lang="ts">
// Μέσα › one outlet (outlet-v2.html?slug=): its numbers, its daily articles and four tabs of cards. A detail page of the tab Επισκόπηση.
definePageMeta({ detail: '/media' })
const { t } = useI18n()
useHead({ title: () => `${t('nav.media')} · ${t('site.name')}` })
const route = useRoute()
// Rosa.gr when there is no slug, as the static page.
const slug = computed(() => String(route.query.slug || '17661f5754'))
// The page is drawn in the browser: the slug is in the query, which the prerendered page does not have, and the data of the stories is 2.8 MB that the page should not carry.
watch(slug, () => window.scrollTo(0, 0))
</script>

<template>
  <ClientOnly><OutletDetail :key="slug" :slug="slug" /></ClientOnly>
</template>
