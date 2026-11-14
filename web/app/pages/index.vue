<script setup lang="ts">
// Αρχική: the Plegma framed on the best stories of the latest week, with the hero over it. The large search is in the page, the one of the top bar waits (hero).
// Under the hero «Η επικαιρότητα»: the calendar and the story of the picked day, with the Plegma between them showing that day (components/HomeToday.vue).
definePageMeta({ plegma: true, hero: true })
const { t } = useI18n()
// The stage reads these as soon as the page is hydrated: they start now, beside the scripts, so the web does not wait for the scripts to ask for them.
useHead({ title: () => t('home.title'), link: ['stories', 'plegma', 'home'].map(key => ({ rel: 'preload', as: 'fetch', crossorigin: 'anonymous', href: `/data/${key}.json` })) })
</script>

<template>
  <HomeHero />
  <ClientOnly><HomeToday /></ClientOnly>
</template>
