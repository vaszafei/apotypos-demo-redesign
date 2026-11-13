<script setup lang="ts">
// Ιδιοκτησία (groups-v2.html): a screen of the Plegma (components/MediaPlegma.vue) whose web is the network of owners and outlets, with no card, and under it the articles of each group by day (75 % of the width of the column); on the left a column of 2 : 10 with the list of the groups.
// The web has two views (the control over it): the groups (default) or the groups standing from left to right by their stance (critical to supportive).
// The group, the owner and the articles come from the static files, so the table and the shares cover the window of the groups file and there is no period control.
definePageMeta({ backdrop: true })
const { t } = useI18n()
useHead({ title: () => `${t('groups.title')} · ${t('site.name')}` })
const { status, refresh, data, empty, groups, total, treeGroups, media, stacks, volumeTotal } = await useGroups()

const period = computed(() => (data.value ? t('period.text', { from: fmtDate(data.value.window[0]), to: fmtDate(data.value.window[1]) }) : ''))
const hasData = computed(() => !!total.value)
const view = ref<'groups' | 'stance'>('groups')
const named = computed(() => treeGroups.value.filter(g => g.key !== null))

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
        <SegmentedControl v-if="hasData" v-model="view" class="media-map-tabs" :label="t('story.ring.label')" :options="[{ value: 'groups', label: t('story.groups.title') }, { value: 'stance', label: t('story.ring.stance') }]" />
        <GroupsNetwork v-if="hasData" fill :stance="view === 'stance'" :class="{ 'is-in': active }" :groups="treeGroups" :total="total" />
      </ClientOnly>
    </template>
    <template #aside>
      <DashCard :title="t('story.groups.title')">
        <ul v-if="hasData" class="bar-list">
          <li v-for="g in named" :key="g.key!">
            <span class="row-name"><span class="dot" :style="`--dot:${g.color}`" aria-hidden="true" />{{ g.label }}</span>
            <span class="row-value">{{ fmtPct(g.value / total) }}</span>
          </li>
        </ul>
        <p v-else class="dcard-empty">{{ t('groups.empty') }}</p>
      </DashCard>
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
