<script setup lang="ts">
// Αρχική: the Plegma framed on the best stories of the latest week, with the hero over it. The large search is in the page, the one of the top bar waits (hero).
definePageMeta({ plegma: true, hero: true })
const { t } = useI18n()
useHead({ title: () => t('home.title') })
</script>

<template>
  <HomeHero />
</template>
