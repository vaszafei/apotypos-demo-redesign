<script setup lang="ts">
// Ιδιοκτησία (groups-v2.html): a screen of the Plegma (components/MediaPlegma.vue) whose web is the network of owners and outlets, with no card, alone on its row; the groups stand from left to right by their stance (critical to supportive); under it the articles of each group by day (75 % of the row).
// The group, the owner and the articles come from the static files, so the table and the shares cover the window of the groups file and there is no period control.
definePageMeta({ backdrop: true })
const { t } = useI18n()
useHead({ title: () => `${t('groups.title')} · ${t('site.name')}` })
const { status, refresh, data, empty, groups, total, treeGroups, media, stacks, volumeTotal } = await useGroups()

const period = computed(() => (data.value ? t('period.text', { from: fmtDate(data.value.window[0]), to: fmtDate(data.value.window[1]) }) : ''))
const hasData = computed(() => !!total.value)

const volumeInfo = computed(() => t('g2.volume.info', { min: fmtInt(GAP), n: fmtInt(volumeTotal.value) }))
const legend = computed(() => treeGroups.value.map(g => ({ key: g.key ?? 'none', label: compactName(g.label, g.key === null, t('media2.groups.none.short')), color: g.color })))

</script>

<template>
  <template v-if="status === 'error'">
    <div class="error-state" role="alert" data-state="error">
      <AppIcon name="exclamation-triangle" />
      <p style="margin: 0">{{ t('state.failed') }}</p>
      <button type="button" class="button" @click="refresh()"><AppIcon name="arrow-path" class="icon icon-sm" />{{ t('state.retry') }}</button>
    </div>
  </template>
  <MediaPlegma v-else variant="groups">
    <template #map="{ active }">
      <ClientOnly>
        <GroupsNetwork v-if="hasData" fill :class="{ 'is-in': active }" :groups="treeGroups" :total="total" />
      </ClientOnly>
    </template>
    <template #side>
      <DashCard :title="t('g2.volume.title')" :info="volumeInfo">
        <template v-if="volumeTotal && media">
          <ul class="legend legend-line"><li v-for="l in legend" :key="l.key"><span class="swatch" :style="{ background: l.color }" />{{ l.label }}</li></ul>
          <GroupLines :dates="media.dates" :stacks="stacks" />
        </template>
        <p v-else class="dcard-empty">{{ t('groups.empty') }}</p>
      </DashCard>
    </template>
  </MediaPlegma>
  <p class="proto-note">{{ t('proto.states') }}</p>
</template>
