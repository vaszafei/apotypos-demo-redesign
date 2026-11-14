<script setup lang="ts">
// Αναλύσεις › ΟΗΕ › Ισραήλ–Παλαιστίνη (un-israel-v2.html): the hall of the General Assembly as the Plegma, as on /speeches. The hall is the base state: the dots grow with the minutes of each country on the topic. The one tab,
// «Επιθέσεις στο Ισραήλ», draws who attacked Israel (a curve to its seat); a click on the tab that is on, or on its card, goes back to the hall. The cards: the numbers of the topic, who spoke most, and the table.
definePageMeta({ backdrop: true })
const { t, locale } = useI18n()
useHead({ title: () => `${t('nav.world')} · ${t('site.name')}` })
const { data, status, refresh } = await useFixture<UnData>('speeches', { required: ['rows'], isEmpty: b => b.rows.length === 0 })

const rows = computed(() => data.value?.rows ?? [])
const countries = computed(() => unCountries(rows.value))
const seats = computed(() => unSeats(countries.value))
const page = computed(() => unIsraelPage(rows.value))
const tab = ref<UnTab>('attacks')
const region = ref<string | null>(null)
const pick = (to: UnTab) => { tab.value = tab.value === to ? 'hall' : to }
const regionCount = (r: string) => countries.value.filter(c => c.region === r).length
const inRegion = (r: UnIsraelRow) => !region.value || r.region === region.value
const nameOf = (country: string) => (locale.value === 'el' ? UN_COUNTRY_EL[country] ?? country : country)

const onTopic = computed(() => page.value.onTopic.filter(inRegion))
const leaders = computed(() => onTopic.value.slice(0, 15).map(r => ({ key: r.vid, label: r.speaker, sub: t('unpi.leaders.sub', { country: nameOf(r.country), share: fmtPct(r.share) }), value: r.minutes, text: t('unpi.leaders.value', { m: fmtDec(r.minutes) }), color: 'var(--bar-fill)' })))
const attackers = computed(() => page.value.israel.filter(inRegion).slice(0, 8).map(r => ({ key: r.vid, label: r.speaker, sub: nameOf(r.country), value: r.israel, text: t('unpi.attacks.value', { n: fmtInt(r.israel) }), color: 'var(--stance-critical)' })))
const columns = computed(() => [
  { key: 'speaker', label: t('un.col.leader') },
  { key: 'minutes', label: t('unpi.col.minutes'), num: true },
  { key: 'share', label: t('unpi.col.share'), num: true }
])
</script>

<template>
  <template v-if="status === 'error'">
    <div class="error-state" role="alert" data-state="error">
      <AppIcon name="exclamation-triangle" />
      <p style="margin: 0">{{ t('state.failed') }}</p>
      <button type="button" class="button" @click="refresh()"><AppIcon name="arrow-path" class="icon icon-sm" />{{ t('state.retry') }}</button>
    </div>
  </template>
  <div v-else-if="status !== 'ready'" class="dash-grid">
    <section class="dcard c-12"><div class="empty-state" data-state="empty"><AppIcon name="inbox" /><p style="margin: 0">{{ t('topics2.empty') }}</p></div></section>
  </div>
  <MediaPlegma v-else variant="un">
    <template #map="{ active }">
      <div class="media-map-web un-web">
        <SegmentedControl :model-value="tab === 'hall' ? '' : tab" class="media-map-tabs" :label="t('un.tabs.label')" :options="[{ value: 'attacks', label: t('un.tab.attacksIl') }]" @update:model-value="v => pick(v as UnTab)" @again="v => pick(v as UnTab)" />
        <ClientOnly><UnHall :countries="countries" :seats="seats" :tab="tab" :region="region" :active="active" israel /></ClientOnly>
      </div>
      <div class="un-chips region-pills" role="group" :aria-label="t('un.regions')">
        <button v-for="r in UN_REGIONS" :key="r" type="button" :aria-pressed="region === r" @click="region = region === r ? null : r">
          <i class="un-chip-dot" :style="{ background: unRegionColor(r) }" />{{ t(`un.region.${r}`) }} <span class="muted-text">{{ fmtInt(regionCount(r)) }}</span>
        </button>
      </div>
    </template>
    <template #side>
      <DashCard :title="t('unpi.leaders.title')" :info="t('unpi.leaders.info')">
        <div class="un-scroll"><BarList :rows="leaders" /></div>
      </DashCard>
      <DashCard :title="t('unpi.table.title')" :info="t('unpi.table.info.short')">
        <DataTable :columns="columns" :rows="onTopic" rank-column :page-size="10" :empty-text="t('topics2.empty')">
          <template #cell-speaker="{ row }"><span class="leader-cell"><a class="quiet-link" :href="row.url || `https://www.youtube.com/watch?v=${row.vid}`" target="_blank" rel="noopener">{{ row.speaker }}</a><span class="row-sub">{{ nameOf(row.country) }} · {{ row.role }}</span></span></template>
          <template #cell-minutes="{ row }">{{ fmtDec(row.minutes) }}</template>
          <template #cell-share="{ row }">{{ fmtPct(row.share) }}</template>
        </DataTable>
      </DashCard>
    </template>
    <template #aside>
      <div class="stats-2x2">
        <StatCard :label="t('unpi.stat.minutes')" :value="fmtInt(Math.round(page.minutes))" :sub="t('unpi.stat.minutes.sub', { n: fmtInt(page.speeches) })" />
        <StatCard :label="t('unpi.stat.rank')" :value="t('unpi.stat.rank.value', { n: page.rank })" :sub="t('unpi.stat.rank.sub', { n: fmtInt(page.topics) })" />
        <StatCard :label="t('unpi.stat.israel')" :value="fmtInt(page.israelAttacks)" :sub="t('unpi.stat.israel.sub', { n: fmtInt(page.israel.length) })" />
        <StatCard :label="t('unpi.stat.hamas')" :value="fmtInt(page.hamasAttacks)" :sub="t('unpi.stat.hamas.sub', { n: fmtInt(page.hamas.length) })" />
      </div>
      <DashCard :title="t('unpi.attacks.title')" :info="t('unpi.attacks.info')" :class="{ 'is-on': tab === 'attacks' }" @click="pick('attacks')">
        <BarList :rows="attackers" />
      </DashCard>
    </template>
  </MediaPlegma>
  <p class="proto-note">{{ t('unpi.note', { n: fmtInt(page.onTopic.length) }) }}</p>
</template>
