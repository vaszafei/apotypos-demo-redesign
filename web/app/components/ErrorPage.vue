<script setup lang="ts">
// UI.ErrorPage of assets/components.js: the page for an address that has no page (404).
const props = defineProps<{ status: number }>()
const { t } = useI18n()
useHead({ title: () => `${t(`error.${props.status}.title`)} · ${t('site.name')}` })
</script>

<template>
  <section class="error-page" :data-state="`error-${status}`">
    <p class="error-code">{{ status }}</p>
    <h1 class="page-title">{{ t(`error.${status}.title`) }}</h1>
    <p class="page-hint">{{ t(`error.${status}.text`) }}</p>
    <p><a class="button" href="/index.html">{{ t('error.home') }}</a> <a class="button" href="/pages.html">{{ t('error.pages') }}</a></p>
  </section>
</template>
