<script setup lang="ts">
// Prototype only: the theme, icon and font switches (themeSwitch, iconSwitch and fontSwitch of assets/shell.js). In the footer on a wide screen and in the drawer on a phone.
const { t } = useI18n()
const prefs = usePrefsStore()
const labelId = useId()
</script>

<template>
  <div class="theme-switch">
    <span :id="labelId">{{ t('shell.theme') }}</span>
    <div class="theme-swatches" role="group" :aria-labelledby="labelId">
      <button v-for="k in THEMES" :key="k" type="button" class="theme-swatch" :data-theme="k" :title="t(`theme.${k}`)" :aria-label="t(`theme.${k}`)" :aria-pressed="tf(prefs.theme === k)" @click="prefs.theme = k" />
    </div>
  </div>
  <label class="font-switch icon-switch"><span>{{ t('shell.icons') }}</span>
    <select v-model="prefs.icons"><option v-for="k in ICON_MODES" :key="k" :value="k">{{ t(`icons.${k}`) }}</option></select>
  </label>
  <label class="font-switch"><span>{{ t('shell.font') }}</span>
    <select v-model="prefs.font"><option v-for="[k, name] in FONTS" :key="k" :value="k">{{ name }}</option></select>
  </label>
</template>
