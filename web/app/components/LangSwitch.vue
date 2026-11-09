<script setup lang="ts">
// The ΕΛ / EN switch (langSwitch of assets/shell.js). The choice is stored by plugins/locale.client.ts.
const { t, locale, setLocale } = useI18n()
const langs = [['el', 'ΕΛ'], ['en', 'EN']] as const
</script>

<template>
  <div class="lang-switch" role="group" :aria-label="t('shell.lang')">
    <button v-for="[code, label] in langs" :key="code" type="button" :lang="code" :aria-pressed="tf(locale === code)" @click="setLocale(code)">{{ label }}</button>
  </div>
</template>
