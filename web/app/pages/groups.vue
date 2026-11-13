<script setup lang="ts">
// Ιδιοκτησία (groups-v2.html): a screen of the Plegma (components/MediaPlegma.vue) whose web is the network of owners and outlets, with no card, and under it the articles of each group by day (the whole column); on the right a column of 10 : 2 with the groups and the outlets that they own, and under them the independent outlets (without a group).
// The control «Στάση» above the web moves the groups and the outlets without a group to their place from left to right by their stance (critical to supportive), with three zones behind them.
// The group, the owner and the articles come from the static files, so the table and the shares cover the window of the groups file and there is no period control.
definePageMeta({ backdrop: true })
const { t } = useI18n()
useHead({ title: () => `${t('groups.title')} · ${t('site.name')}` })
const { status, refresh, data, empty, groups, total, treeGroups, media, stacks, volumeTotal } = await useGroups()

const period = computed(() => (data.value ? t('period.text', { from: fmtDate(data.value.window[0]), to: fmtDate(data.value.window[1]) }) : ''))
const hasData = computed(() => !!total.value)
const stance = ref(false)
const named = computed(() => treeGroups.value.filter(g => g.key !== null))
const independent = computed(() => treeGroups.value.find(g => g.key === null)?.outlets ?? [])

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
      <div v-if="hasData" class="groups-tools">
        <div class="media-map-tabs segmented" role="group" :aria-label="t('story.ring.label')">
          <button type="button" :aria-pressed="stance" @click="stance = !stance">{{ t('story.ring.stance') }}</button>
        </div>
      </div>
      <div class="groups-web">
        <ClientOnly>
          <GroupsNetwork v-if="hasData" fill :stance="stance" :class="{ 'is-in': active }" :groups="treeGroups" :total="total" />
        </ClientOnly>
      </div>
    </template>
    <template #aside>
      <div class="media-side-card owner-col">
        <DashCard :title="t('story.groups.title')">
          <template v-if="hasData">
            <section v-for="g in named" :key="g.key!" class="owner" :style="{ '--g': g.color }">
              <header class="owner-head"><span class="owner-name">{{ shortName(g.label) }}</span><span class="owner-share">{{ fmtPct(g.value / total) }}</span></header>
              <ul class="owner-outlets"><li v-for="o in g.outlets" :key="o.slug"><span>{{ o.name }}</span><span>{{ fmtPct(o.value / total) }}</span></li></ul>
            </section>
          </template>
          <p v-else class="dcard-empty">{{ t('groups.empty') }}</p>
        </DashCard>
        <DashCard v-if="independent.length" :title="t('groups.independent.title')">
          <ul class="owner-outlets"><li v-for="o in independent" :key="o.slug"><span>{{ o.name }}</span><span>{{ fmtPct(o.value / total) }}</span></li></ul>
        </DashCard>
      </div>
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
