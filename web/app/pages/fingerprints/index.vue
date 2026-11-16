<script setup lang="ts">
import type { MmeData } from '~/types/mme'
import type { Series } from '~/types/topics'
import { overall, PERSON_KEYS, personHref, peopleOverview, netPoints, type PeopleOverviewData } from '~/utils/people'

// Πρόσωπα › Επισκόπηση (fingerprints-v2.html): the articles about each person over time (9 columns) and the list of the people (3); under them the tone and the voice of the people in one chart. It needs a log in (layouts/default.vue).
// The people are those of the Greek set of data/mme.json with statements; the whole window of the set, so there is no period control.
const { t } = useI18n()
useHead({ title: () => `${t('fp.title')} · ${t('site.name')}` })
const mme = await useFixture<MmeData, PeopleOverviewData>('mme', { required: ['dates', 'people'], isEmpty: b => b.people.length === 0 }, { as: 'mme-people', transform: peopleOverview })
const netColor = useNetColor()

const data = computed(() => mme.data.value)
const ROLL = 7
const SLOTS = 8
// The 7-day average of the articles about each person, the most written about first (as the lines of Θέματα).
const series = computed<Series[]>(() => (data.value?.people ?? []).filter(p => p.daily.some(v => v > 0)).map(p => ({ p, total: p.daily.reduce((a, v) => a + v, 0) }))
  .sort((a, b) => b.total - a.total).slice(0, SLOTS).map(({ p }, i) => ({
    key: PERSON_KEYS[p.name] ?? String(p.k), name: p.name, color: `var(--cat-${i + 1})`,
    values: p.daily.map((_, j) => { const from = Math.max(0, j - ROLL + 1); const w = p.daily.slice(from, j + 1); return w.reduce((a, v) => a + v, 0) / w.length })
  })))
const list = computed(() => (data.value?.people ?? []).map(p => ({ p, o: overall(p, data.value!.total) })))
const withTone = computed(() => list.value.filter(r => r.o.n >= 5).map(r => ({ name: r.p.name, net: r.o.net, rate: r.o.rate, n: r.o.n })))
</script>

<template>
  <template v-if="mme.status.value === 'error'">
    <div class="error-state" role="alert" data-state="error">
      <AppIcon name="exclamation-triangle" />
      <p style="margin: 0">{{ t('state.failed') }}</p>
      <button type="button" class="button" @click="mme.refresh()"><AppIcon name="arrow-path" class="icon icon-sm" />{{ t('state.retry') }}</button>
    </div>
  </template>
  <div v-else-if="!data" class="dash-grid">
    <DashCard class="c-12" :title="t('fps.title')"><p class="dcard-empty" data-state="empty">{{ t('fp.empty') }}</p></DashCard>
  </div>
  <div v-else class="dash-grid fp-overview">
    <DashCard class="c-9" :title="t('mme.time.title')" :info="`${t('mme.time.title')}. ${t('mme.time.info')}`">
      <LinesChart v-if="series.length" :dates="data.dates" :series="series" :caption="t('mme.time.title')" :href-of="s => personHref(s.key)" />
      <p v-else class="dcard-empty">{{ t('media2.empty.list') }}</p>
    </DashCard>
    <DashCard class="c-3 fp-list-card" :title="t('mme.who.title')" :info="t('mme.who.info')">
      <ul v-if="list.length" class="fp-list">
        <li v-for="r in list" :key="r.p.name" class="fp-person">
          <span class="fp-person-head">
            <strong><EntityLink v-if="PERSON_KEYS[r.p.name]" type="person" :to="personHref(PERSON_KEYS[r.p.name])">{{ r.p.name }}</EntityLink><template v-else>{{ r.p.name }}</template></strong>
            <span v-if="r.o.n >= 5" class="fp-net" :style="netColor(r.o.net)" :title="t('mme.people.cell.tone', { outlet: t('mme.people.total'), person: r.p.name, n: fmtInt(r.o.n), net: netPoints(r.o.net) })">{{ t('mme.who.net', { net: netPoints(r.o.net) }) }}</span>
          </span>
          <span class="muted-text">{{ [[r.p.role, r.p.party].filter(Boolean).join(' · '), t('mme.persons.quotes', { n: fmtInt(r.p.quotes) })].filter(Boolean).join(' · ') }}</span>
        </li>
      </ul>
      <p v-else class="dcard-empty">{{ t('media2.empty.list') }}</p>
    </DashCard>
    <DashCard class="c-6" :title="t('mme.both.title')">
      <p class="dcard-sub fp-what">{{ t('mme.panel.both.what') }}</p>
      <ClientOnly><PeopleTone v-if="withTone.length" :points="withTone" /></ClientOnly>
      <p v-if="!withTone.length" class="dcard-empty">{{ t('mme.panel.none') }}</p>
    </DashCard>
  </div>
  <p class="proto-note">{{ t('proto.states') }}</p>
</template>
