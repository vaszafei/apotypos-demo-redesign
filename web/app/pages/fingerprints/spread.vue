<script setup lang="ts">
import { netText, NAME_MIN, stancePeople, type StanceRatingsData } from '~/utils/people'

// Πρόσωπα › Στάση (fingerprints-v2.html?tab=spread, #62): the 15 persons of the API and their stance in each outlet. A list of the most supportive cells, a table with a row for each person
// and a scatter of the persons the press disagrees on. It needs a log in (layouts/default.vue).
const { t } = useI18n()
useHead({ title: () => `${t('fp.title')} · ${t('site.name')}` })
const ratings = await useFixture<StanceRatingsData>('stanceRatings', { required: ['persons', 'days', 'referenceDate'], isEmpty: b => b.persons.length === 0 })

const people = computed(() => (ratings.data.value ? stancePeople(ratings.data.value) : []))
const cells = computed(() => people.value.flatMap(p => p.rated.map(x => ({ ...x, person: p.name }))).filter(c => c.v > 0).sort((a, b) => b.v - a.v).slice(0, 12))
const cellTip = (c: { outlet: string, person: string, v: number, n: number }) => t('fp.cell.stance', { outlet: c.outlet, person: c.person, net: netText(c.v), n: fmtInt(c.n) })
const heads = computed(() => ['', t('fps.col.mean'), t('fps.col.positive'), t('fps.col.negative')])
</script>

<template>
  <template v-if="ratings.status.value === 'error'">
    <div class="error-state" role="alert" data-state="error">
      <AppIcon name="exclamation-triangle" />
      <p style="margin: 0">{{ t('state.failed') }}</p>
      <button type="button" class="button" @click="ratings.refresh()"><AppIcon name="arrow-path" class="icon icon-sm" />{{ t('state.retry') }}</button>
    </div>
  </template>
  <div v-else-if="!people.length || !ratings.data.value" class="dash-grid">
    <DashCard class="c-12" :title="t('fps.title')"><p class="dcard-empty" data-state="empty">{{ t('fp.empty') }}</p></DashCard>
  </div>
  <div v-else class="fps-layout">
    <DashCard class="card-side" :title="t('f2.top.stance')">
      <BarList
        v-if="cells.length"
        :max="Math.max(...cells.map(c => c.v))"
        :rows="cells.map(c => ({ key: `${c.outlet}-${c.person}`, label: c.outlet, sub: c.person, text: netText(c.v), value: c.v, color: 'var(--stance-supportive)', tip: cellTip(c) }))"
      />
      <p v-else class="dcard-empty">{{ t('f2.empty') }}</p>
    </DashCard>
    <DashCard class="fps-main" :title="t('fps.title.stance')" :info="t('fps.info.stance')">
      <div class="fps-table" role="table" :aria-label="t('fps.title')">
        <div class="fps-row fps-head" role="row"><span v-for="(x, i) in heads" :key="i" role="columnheader">{{ x }}</span></div>
        <div v-for="p in people" :key="p.name" class="fps-row" role="row">
          <strong class="fps-name" role="rowheader">{{ p.name }}</strong>
          <span class="fps-meter">
            <span class="fps-track fps-track-center"><span :class="`fps-fill ${p.mean < 0 ? 'fps-fill-low' : 'fps-fill-high'}`" :style="{ width: `${Math.abs(p.mean) * 50}%` }" /></span>
            <span class="fps-num">{{ netText(p.mean) }}</span>
          </span>
          <span class="fps-outlets" :data-label="heads[2]">
            <template v-if="p.rated.some(x => x.v > 0)"><span v-for="x in p.rated.filter(x => x.v > 0).slice(0, 2)" :key="x.outlet" class="fps-outlet" :title="cellTip({ ...x, person: p.name })">{{ x.outlet }} <strong>{{ netText(x.v) }}</strong></span></template>
            <span v-else class="muted-text">–</span>
          </span>
          <span class="fps-outlets" :data-label="heads[3]">
            <template v-if="p.rated.some(x => x.v < 0)"><span v-for="x in p.rated.filter(x => x.v < 0).slice(-2).reverse()" :key="x.outlet" class="fps-outlet" :title="cellTip({ ...x, person: p.name })">{{ x.outlet }} <strong>{{ netText(x.v) }}</strong></span></template>
            <span v-else class="muted-text">–</span>
          </span>
        </div>
      </div>
      <p class="dcard-sub">{{ t('fp.note.extended.stance', { days: ratings.data.value.days, date: fmtDate(ratings.data.value.referenceDate), min: NAME_MIN }) }}</p>
    </DashCard>
    <DashCard class="fps-scatter" :title="t('fps.scatter.title')" :info="t('fps.scatter.info')">
      <p class="dcard-sub fp-what">{{ t('fps.scatter.what') }}</p>
      <ClientOnly><PeopleSpread :people="people" /></ClientOnly>
    </DashCard>
  </div>
  <p class="proto-note">{{ t('proto.states') }}</p>
</template>
