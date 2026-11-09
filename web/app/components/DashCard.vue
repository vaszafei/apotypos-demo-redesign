<script setup lang="ts">
// Dash.card + Dash.cardHead: a card with its title and the info popover.
defineProps<{ title: string, info?: string, card?: string }>()
const { t } = useI18n()
</script>

<template>
  <section class="dcard" :data-card="card">
    <div class="dcard-head">
      <h2 class="dcard-title">{{ title }}</h2>
      <div class="dcard-tools">
        <span v-if="info" class="info">
          <button type="button" class="info-btn" :aria-label="t('dash.info')" aria-expanded="false"><AppIcon name="information-circle" /></button>
          <span class="info-pop" role="note">{{ info }}</span>
        </span>
      </div>
    </div>
    <slot />
  </section>
</template>
