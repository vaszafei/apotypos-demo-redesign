<script setup lang="ts">
// Αναλύσεις › ΟΗΕ › Όλες οι ομιλίες (speeches-v2.html): the 192 speeches of the 81st General Assembly as a screen of the Plegma. The web is the hall: a dot for each country in its seat (components/un/UnHall.vue), the tabs
// rearrange it (the topics, who attacked whom, who named Greece and Cyprus), the region chips under it dim the other regions. The cards of the page stand on its right and follow the tab.
import type { SunLegend, SunRing } from '~/components/charts/Sunburst.vue'
definePageMeta({ backdrop: true })
const { t, te, locale } = useI18n()
useHead({ title: () => `${t('nav.world')} · ${t('site.name')}` })
const { data, status, refresh } = await useFixture<UnData>('speeches', { required: ['rows'], isEmpty: b => b.rows.length === 0 })

const rows = computed(() => data.value?.rows ?? [])
const countries = computed(() => unCountries(rows.value))
const seats = computed(() => unSeats(countries.value))
const tab = ref<UnTab>('hall')
const region = ref<string | null>(null)
const TABS: UnTab[] = ['themes', 'attacks', 'greece']
// A click on the tab that is on, or on its card, goes back to the hall.
const pick = (to: UnTab) => { tab.value = tab.value === to ? 'hall' : to }
const regionCount = (r: string) => countries.value.filter(c => c.region === r).length

const nameOf = (country: string) => (locale.value === 'el' ? UN_COUNTRY_EL[country] ?? country : country)
const topicName = (key: string) => (locale.value === 'el' && te(`un.topic.${key}`) ? t(`un.topic.${key}`) : key)
const targetName = (key: string) => (locale.value === 'el' && te(`un.target.${key}`) ? t(`un.target.${key}`) : key)
const inRegion = (r: UnSpeech) => !region.value || r.region === region.value

// Who received the attacks (the 8 largest targets of the picked region), with the leaders who made them.
const targets = computed(() => {
  const by = new Map<string, { n: number, leaders: number }>()
  for (const r of rows.value.filter(inRegion)) {
    const own = new Map<string, number>()
    for (const [k, n] of r.targets) own.set(targetName(k), (own.get(targetName(k)) ?? 0) + n)
    for (const [k, n] of own) { const e = by.get(k) ?? { n: 0, leaders: 0 }; e.n += n; e.leaders++; by.set(k, e) }
  }
  return [...by].sort((a, b) => b[1].n - a[1].n).slice(0, 8).map(([k, e]) => ({ key: k, label: k, value: e.n, text: t('un.targets.value', { n: fmtInt(e.n), l: fmtInt(e.leaders) }), color: 'var(--stance-critical)' }))
})
// The agenda: the regions inside, the topics outside. The colors come from all the speeches, so a region picked keeps the color of each topic.
const everything = computed(() => unTopicMinutes(rows.value))
const topicColor = computed(() => unTopicColors(everything.value))
const agenda = computed(() => unAgenda(rows.value.filter(inRegion)))
const sun = computed(() => {
  const a = agenda.value
  const regionName = (g: string) => t(`un.region.${g}`)
  const rings: SunRing[] = a.regions.map((x, i) => ({
    label: regionName(x.region), value: x.total, color: UN_REGION_TINTS[i]!, tip: t('un.sun.region', { region: regionName(x.region), h: fmtDec(x.total / 60), n: fmtInt(x.speeches) }),
    children: x.kids.map(k => {
      const label = k.topic ? topicName(k.topic) : t('un.other')
      return { key: k.topic, label, value: k.minutes, color: k.topic ? topicColor.value(k.topic) : 'var(--bar-track)', tip: t('un.sun.tip', { region: regionName(x.region), topic: label, m: fmtInt(Math.round(k.minutes)), p: fmtPct(k.minutes / x.total) }) }
    })
  }))
  const legend: SunLegend[] = [
    ...a.big.map(x => ({ key: x.topic, label: topicName(x.topic), color: topicColor.value(x.topic), text: t('un.agenda.row', { m: fmtInt(Math.round(x.minutes)), p: fmtPct(x.minutes / a.total) }), tip: t('un.agenda.top', { names: x.top.join(', ') }) })),
    { key: '', label: t('un.other'), color: 'var(--bar-track)', text: t('un.agenda.row', { m: fmtInt(Math.round(a.rest)), p: fmtPct(a.rest / a.total) }) }
  ]
  return { rings, legend, num: fmtDec(a.total / 60), regions: a.regions.map((x, i) => ({ label: `${regionName(x.region)} ${fmtDec(x.total / 60)}`, color: UN_REGION_TINTS[i]! })) }
})
const TONES = ['hostile', 'critical', 'neutral', 'conciliatory', 'supportive']
const greek = computed(() => rows.value.filter(inRegion).filter(r => r.greece.n).sort((a, b) => b.greece.n - a.greece.n))
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
        <SegmentedControl :model-value="tab === 'hall' ? '' : tab" class="media-map-tabs" :label="t('un.tabs.label')" :options="TABS.map(k => ({ value: k, label: t(`un.tab.${k}`) }))" @update:model-value="v => pick(v as UnTab)" @again="v => pick(v as UnTab)" />
        <ClientOnly><UnHall :countries="countries" :seats="seats" :tab="tab" :region="region" :active="active" /></ClientOnly>
      </div>
      <div class="un-chips region-pills" role="group" :aria-label="t('un.regions')">
        <button v-for="r in UN_REGIONS" :key="r" type="button" :aria-pressed="region === r" @click="region = region === r ? null : r">
          <i class="un-chip-dot" :style="{ background: unRegionColor(r) }" />{{ t(`un.region.${r}`) }} <span class="muted-text">{{ fmtInt(regionCount(r)) }}</span>
        </button>
      </div>
    </template>
    <template #side>
      <DashCard :title="t('un.table.title')" :info="t('un.table.info')">
        <UnSpeechList :rows="rows.filter(inRegion)" :topic-name="topicName" />
      </DashCard>
    </template>
    <template #aside>
      <DashCard :title="t('un.agenda.title')" :info="t('un.agenda.info')" :class="{ 'is-on': tab === 'themes' }" @click="pick('themes')">
        <Sunburst :rings="sun.rings" :legend="sun.legend" :center="{ num: sun.num, cap: t('un.donut.hours') }" :size="230" />
        <ChartLegend :items="sun.regions" />
      </DashCard>
      <DashCard :title="t('un.targets.title')" :info="t('un.targets.info')" :class="{ 'is-on': tab === 'attacks' }" @click="pick('attacks')">
        <BarList :rows="targets" />
      </DashCard>
      <DashCard :title="t('un.greece.title')" :info="t('un.greece.info')" :class="{ 'is-on': tab === 'greece' }" @click="pick('greece')">
        <ul v-if="greek.length" class="target-list">
          <li v-for="r in greek" :key="r.vid">
            <span><strong>{{ r.speaker }}</strong> <span class="muted-text">{{ r.role }}, {{ nameOf(r.country) }} · {{ t('un.greece.refs', { n: fmtInt(r.greece.n) }) }}</span></span>
            <span class="chips">
              <span v-for="k in TONES.filter(x => r.greece.tones[x])" :key="k" class="target-chip" :class="`tone-${k}`">{{ t(`un.tone.${k}`) }}<strong>{{ fmtInt(r.greece.tones[k]!) }}</strong></span>
              <span v-for="x in r.greece.refers_to" :key="x" class="pill">{{ x }}</span>
            </span>
          </li>
        </ul>
        <p v-else class="dcard-empty">{{ t('un.greece.none') }}</p>
      </DashCard>
    </template>
  </MediaPlegma>
  <p class="proto-note">{{ t('un.note') }}</p>
</template>
