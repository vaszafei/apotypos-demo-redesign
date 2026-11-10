<script setup lang="ts">
import type { MmeData } from '~/types/mme'
import type { OriginalityData } from '~/types/originality'
import type { GroupsData } from '~/utils/groups'

// Μέσα › Ομοιότητα και πρωτοτυπία (similarity-v2.html): who writes the stories that other outlets also write. Originality reads the API in its own period (Sep 2025 to Jan 2026),
// so its cards state that period; the clickbait map uses the whole period of the Μέσα data (this page has no period picker).
const { t } = useI18n()
useHead({ title: () => `${t('nav.media')} · ${t('site.name')}` })
const mme = await useFixture<MmeData>('mme', { required: ['sets'], isEmpty: b => Object.keys(b.sets).length === 0 })
const orig = await useFixture<OriginalityData>('originality', { required: ['window', 'outlets'], isEmpty: b => b.outlets.length === 0 })
const groupsData = await useFixture<GroupsData>('groups', { required: ['groups'] })
const problem = computed(() => [orig.status.value, mme.status.value].find(s => s !== 'ready'))
const retry = () => { orig.refresh(); mme.refresh() }

const colorOf = computed(() => groupColors(groupsData.data.value?.groups ?? []))
const colorOfGroup = (g: string | null | undefined) => (g ? colorOf.value.get(g) ?? NO_GROUP : NO_GROUP)
// The lag is in minutes. Less than 1 day shows in hours, the rest in days.
const lagText = (min: number) => (min < 1440 ? t('originality.lag.h', { n: fmtDec(min / 60) }) : t('originality.lag.d', { n: fmtDec(min / 1440) }))
const pct = (v: number) => fmtPct(v / 100)

// Originality: the share of original articles of each outlet. The bar is 100 percent of the scored articles and the tick is the average of the outlets.
const originality = computed(() => {
  const d = orig.data.value
  const set = mme.data.value?.sets.gr
  if (!d || !set) return null
  const rows = d.outlets.slice().sort((a, b) => b.pct - a.pct)
  const scored = rows.reduce((sum, r) => sum + r.scored, 0)
  const average = rows.reduce((sum, r) => sum + r.originals, 0) / scored
  const groupOfName = new Map(set.outlets.map(o => [o.name, o.group]))
  return {
    rows, average,
    period: t('originality.meta', { n: rows.length, from: fmtMonth(d.window[0], { month: 'short', year: 'numeric' }), to: fmtMonth(d.window[1], { month: 'short', year: 'numeric' }) }),
    points: rows.map(r => ({ name: r.name, x: r.pct / 100, y: r.anonPct / 100, n: r.scored, lag: r.lagMin, color: colorOfGroup(groupOfName.get(r.name)) })),
    avg: { x: average, y: rows.reduce((sum, r) => sum + r.anonPct * r.scored, 0) / scored / 100 }
  }
})
const columns = computed(() => [
  { key: 'name', label: t('media.col.outlet') },
  { key: 'scored', label: t('originality.col.scored'), num: true, phone: false },
  { key: 'pct', label: t('originality.col.pct') },
  { key: 'lag', label: t('originality.col.lag'), num: true, phone: false }
])

// News and clickbait of each outlet, for the whole period of the Μέσα data.
const scatter = computed(() => {
  const set = mme.data.value?.sets.gr
  if (!set) return null
  const S = mmeSummary(set, 0, set.dates.length - 1)
  const cb = S.active.filter(o => o.cbKnown >= 100)
  return {
    S, from: set.dates[0]!, to: set.dates[set.dates.length - 1]!,
    points: cb.map(o => ({ name: o.name, x: o.news / o.n, y: o.cbYes / o.cbKnown, n: o.n, color: colorOfGroup(o.group) })),
    avg: { x: S.active.reduce((sum, o) => sum + o.news, 0) / (S.total || 1), y: cb.reduce((sum, o) => sum + o.cbYes, 0) / (cb.reduce((sum, o) => sum + o.cbKnown, 0) || 1) }
  }
})
</script>

<template>
  <template v-if="problem === 'error'">
    <div class="error-state" role="alert" data-state="error">
      <AppIcon name="exclamation-triangle" />
      <p style="margin: 0">{{ t('state.failed') }}</p>
      <button type="button" class="button" @click="retry"><AppIcon name="arrow-path" class="icon icon-sm" />{{ t('state.retry') }}</button>
    </div>
  </template>
  <div v-else-if="problem" class="dash-grid">
    <section class="dcard c-12"><div class="empty-state" data-state="empty"><AppIcon name="inbox" /><p style="margin: 0">{{ t('topics2.empty') }}</p></div></section>
  </div>
  <div v-else-if="originality && scatter" class="dash-grid">
    <DashCard class="c-6" :title="t('originality.title')" :info="t('originality.info')">
      <template #tools>
        <ChartLegend :items="[{ label: t('originality.key.original'), color: 'var(--series-news)' }, { label: t('originality.key.rewrite'), color: 'var(--bar-muted)' }, { label: t('originality.key.avg', { pct: fmtPct(originality.average) }), tick: true }]" />
      </template>
      <p class="dcard-sub">{{ originality.period }}</p>
      <DataTable :rows="originality.rows" :columns="columns" rank-column :empty-text="t('media.empty')">
        <template #cell-name="{ row }"><span class="entity-text">{{ row.name }}</span></template>
        <template #cell-scored="{ row }">{{ fmtInt(row.scored) }}</template>
        <template #cell-pct="{ row }">
          <div class="orig-cell">
            <strong>{{ pct(row.pct) }}</strong>
            <StackedBar
              :segments="[{ label: t('originality.key.original'), value: row.originals, color: 'var(--series-news)' }, { label: t('originality.key.rewrite'), value: row.rewrites, color: 'var(--bar-muted)' }]"
              :marker="originality.average" :label="t('originality.share.tip', { name: row.name, originals: fmtInt(row.originals), rewrites: fmtInt(row.rewrites) })"
            />
          </div>
        </template>
        <template #cell-lag="{ row }">{{ lagText(row.lagMin) }}</template>
      </DataTable>
    </DashCard>

    <DashCard class="c-6" :title="t('originality.map.title')" :info="t('originality.map.info')">
      <p class="dcard-sub">{{ originality.period }}</p>
      <DotMap
        :points="originality.points" :avg="originality.avg" :x-title="t('originality.map.x')" :y-title="t('originality.map.y')"
        :avg-x="t('sim.map.avg', { v: fmtPct0(originality.avg.x) })" :avg-y="t('sim.map.avg', { v: fmtPct0(originality.avg.y) })" :caption="t('originality.map.title')"
        :text="p => t('originality.map.point', { name: p.name, orig: fmtPct(p.x), anon: fmtPct(p.y), n: fmtInt(p.n), lag: lagText(p.lag) })"
      />
    </DashCard>

    <DashCard class="c-6" :title="t('media2.scatter.title')" :info="t('media2.scatter.info', { n: fmtInt(scatter.points.length), total: fmtInt(scatter.S.active.length) })">
      <p class="dcard-sub">{{ t('media2.scatter.period', { from: fmtDate(scatter.from), to: fmtDate(scatter.to) }) }}</p>
      <DotMap
        v-if="scatter.points.length > 1"
        :points="scatter.points" :avg="scatter.avg" :x-title="t('media2.scatter.x')" :y-title="t('media2.scatter.y')"
        :avg-x="t('sim.map.avg', { v: fmtPct0(scatter.avg.x) })" :avg-y="t('sim.map.avg', { v: fmtPct0(scatter.avg.y) })" :caption="t('media2.scatter.title')"
        :text="p => t('media2.scatter.point', { name: p.name, news: fmtPct(p.x), cb: fmtPct(p.y), n: fmtInt(p.n) })"
      />
      <p v-else class="dcard-empty">{{ t('media2.empty.list') }}</p>
    </DashCard>
  </div>
  <p class="proto-note">{{ t('proto.states') }}</p>
</template>
