<script setup lang="ts">
import type { StoriesData } from '~/types/stories'
import type { StoryDetailData } from '~/types/story-detail'
import type { GroupsData } from '~/utils/groups'
import type { BarRow } from '~/components/BarList.vue'

// The body of the story page (story-v2.html): the title card, the days, the stance, the groups and outlets, how it was written, the people and the related stories.
const props = defineProps<{ id: number }>()
const { t } = useI18n()
const list = useFixtureLazy<StoriesData>('stories', { required: ['dates', 'issues', 'stories'], isEmpty: b => b.stories.length === 0 })
const detail = useFixtureLazy<StoryDetailData>('storyDetail', { required: ['outlets', 'stories', 'base', 'people'], isEmpty: b => b.stories.length === 0 })
const groupsData = useFixtureLazy<GroupsData>('groups', { required: ['groups'] })
const loading = computed(() => list.status.value === 'loading' || detail.status.value === 'loading')
const problem = computed(() => [list.status.value, detail.status.value].find(s => s !== 'ready'))
const retry = () => { list.refresh(); detail.refresh() }

const STANCES = ['critical', 'neutral', 'supportive'] as const
const PORTRAYAL = ['var(--emph-less)', 'var(--bar-muted)', 'var(--emph-more)']
const colorOfGroup = computed(() => groupColors(groupsData.data.value?.groups ?? []))
const groupName = (g: string | null) => g || t('story.nogroup')
const groupColor = (g: string | null) => (g && colorOfGroup.value.get(g)) || NO_GROUP
const dayLabel = (i: number) => fmtDay(list.data.value!.dates[i]!)

// null when the id has no story (the 404 page).
const model = computed(() => {
  const d = list.data.value
  const dd = detail.data.value
  if (!d || !dd || problem.value) return null
  const story = d.stories.find(s => s.id === props.id)
  const det = dd.stories.find(s => s.id === props.id)
  if (!story || !det) return null
  const r = storyRows(d, dd, det)
  const reach = reachOf(dd, det)
  const people = peopleOf(dd, det)
  const labelled = Array.isArray(det.s)
  return { d, dd, story, det, issue: d.issues[story.issue]!, ...r, people, labelled, echo: reach >= ECHO_MIN ? reach : null }
})

const series = computed(() => {
  const m = model.value
  if (!m) return []
  return m.groups.map(g => ({ name: groupName(g.group), color: groupColor(g.group), values: g.values.slice(m.lo, m.hi + 1) }))
})
const shown = computed(() => (model.value ? model.value.d.dates.slice(model.value.lo, model.value.hi + 1) : []))
const dailyTip = (i: number) => {
  const total = series.value.reduce((a, x) => a + x.values[i]!, 0)
  const parts = series.value.filter(x => x.values[i]! > 0).reverse().map(x => `${x.name} ${fmtInt(x.values[i]!)}`).join(' · ')
  return `${t('story.daily.tip', { date: fmtDate(shown.value[i]!), n: fmtInt(total) })}${parts ? `: ${parts}` : ''}`
}

// The groups and their outlets in one card, as Άρθρα ανά όμιλο of Ιδιοκτησία.
const tree = computed(() => {
  const m = model.value
  if (!m) return []
  const record = new Map((groupsData.data.value?.groups ?? []).map(g => [g.name, g]))
  return m.groups.map((g) => {
    const outs = m.outlets.filter(r => m.dd.outlets[r.outlet]!.group === g.group)
    return {
      key: g.group || null, label: groupName(g.group), color: groupColor(g.group), value: g.n, slug: record.get(g.group ?? '')?.slug,
      outlets: outs.map(r => ({ ...m.dd.outlets[r.outlet]!, value: r.n })), articles: outs
    }
  })
})

// The stance of the story against all articles: a row needs 30 articles with a stance.
const stance = computed(() => {
  const m = model.value
  if (!m?.labelled) return null
  const rows = [{ label: t('entity.stance.story'), color: 'var(--series-news)', counts: m.det.s!.slice(1) }, { label: t('entity.stance.all'), color: NO_GROUP, counts: m.dd.base.s.slice(1) }]
    .map((r) => {
      const n = totalOf(r.counts)
      return { ...r, n, crit: n ? r.counts[0]! / n : 0, neu: n ? r.counts[1]! / n : 0, sup: n ? r.counts[2]! / n : 0 }
    }).filter(r => r.n >= 30)
  const scale = Math.max(...rows.map(r => Math.max(r.crit + r.neu / 2, r.sup + r.neu / 2)))
  return { rows, scale, total: totalOf(m.det.s!.slice(1)) }
})
type StanceRow = BarRow & { row: NonNullable<typeof stance.value>['rows'][number] }
const stanceRows = computed<StanceRow[]>(() => (stance.value?.rows ?? []).map(r => ({ key: r.label, label: '', text: `${fmtPct(r.crit)} · ${fmtPct(r.sup)}`, value: 0, color: '', row: r })))

// How the story was written: for each measure, how far the story is from all articles. The rows share one scale, so the bars compare.
type DiffRow = BarRow & { diff: number, tipText: string }
const diffRow = (r: DiffRowData): DiffRow => {
  const diff = r.value - r.usual
  return {
    key: r.label, label: r.label, text: fmtPct(r.value), value: 0, color: '', diff,
    tipText: t('story.how.tip', { label: r.label, value: fmtPct(r.value), usual: fmtPct(r.usual), diff: `${diff >= 0 ? '+' : '−'}${fmtPct(Math.abs(diff))}` })
  }
}
const how = computed(() => {
  const m = model.value
  if (!m?.labelled) return null
  const { det, dd } = m
  const rowsOf = (key: 'f' | 'c', labels: string[], prefix: string, count: number) =>
    diffRows(det[key]!.map((_, i) => ({ label: t(`story.${prefix}.${labels[i]}`), value: share(det[key]!, i), usual: share(dd.base[key], i) })), count)
  const stanceN = totalOf(det.s!.slice(1))
  const stanceRaw = STANCES.map((code, i) => ({ label: t(`stance.${code}`), value: share(det.s!.slice(1), i, stanceN), usual: share(dd.base.s.slice(1), i, totalOf(dd.base.s.slice(1))) }))
  const [scored, baited] = det.k!
  const clickRaw = scored ? [{ label: t('story.how.clickbait'), value: baited! / scored, usual: dd.base.k[1]! / dd.base.k[0]! }] : []
  const panels = [
    { title: t('story.how.frame'), rows: rowsOf('f', dd.frames, 'frame', 8), note: null as string | null },
    { title: t('story.how.section'), rows: rowsOf('c', dd.sections, 'section', 6), note: null },
    { title: '', rows: stanceN ? stanceRaw : [], note: null },
    { title: t('story.how.clickbait'), rows: clickRaw, note: scored ? t('story.how.clickbait.n', { n: fmtInt(baited!), total: fmtInt(scored) }) : t('story.how.clickbait.none') }
  ]
  const scale = Math.max(0.05, ...panels.flatMap(p => p.rows.map(r => Math.abs(r.value - r.usual))))
  const column = (items: typeof panels) => items.map(p => ({ title: p.title, rows: p.rows.map(diffRow), note: p.note }))
  return { scale, columns: [column([panels[0]!]), column([panels[1]!, panels[3]!])] }
})

const related = computed(() => {
  const m = model.value
  if (!m) return []
  const days = m.last + 1
  return relatedStories(m.d.stories.filter(s => !s.generic), m.story, s => dailyOf(s, days)).map(r => ({ ...r, articles: articlesOf(r.s), values: dailyOf(r.s, days) }))
})
const peopleColumns = computed(() => [
  { key: 'person', label: t('story.people.col.person') },
  { key: 'mentions', label: t('story.people.col.mentions'), num: true },
  { key: 'portrayal', label: t('story.people.col.portrayal'), phone: false }
])
</script>

<template>
  <template v-if="loading" />
  <div v-else-if="problem === 'error'" class="error-state" role="alert" data-state="error">
    <AppIcon name="exclamation-triangle" />
    <p style="margin: 0">{{ t('state.failed') }}</p>
    <button type="button" class="button" @click="retry"><AppIcon name="arrow-path" class="icon icon-sm" />{{ t('state.retry') }}</button>
  </div>
  <div v-else-if="problem" class="dash-grid">
    <section class="dcard c-12"><div class="empty-state" data-state="empty"><AppIcon name="inbox" /><p style="margin: 0">{{ t('topics2.empty') }}</p></div></section>
  </div>
  <ErrorPage v-else-if="!model" :status="404" />
  <div v-else class="dash-grid entity-grid entity-rows">
    <EntityTitle :kind="t('hero.kind.story')" :title="storyName(model.story)">
      <template #meta>
        <span>
          <EntityLink type="topic" :to="topicHref(String(model.story.issue))">{{ topicName(model.issue) }}</EntityLink>
          {{ ` · ${dayLabel(model.start)} → ${fmtDate(model.d.dates[model.end]!)} · ` }}{{ model.end === model.start ? t('story.hero.day.one') : t('entity.fact.days', { n: model.end - model.start + 1 }) }}
        </span>
      </template>
      <EntityFact :label="t('entity.fact.articles')" :value="fmtInt(model.articles)" :sub="t('entity.fact.peak', { date: dayLabel(model.peak), n: fmtInt(model.perDay[model.peak]!) })">
        <template #spark><SparkLine :values="model.perDay" :from="model.lo" :to="model.hi" :label="t('story.daily.title')" :width="56" :height="16" /></template>
      </EntityFact>
      <EntityFact :label="t('entity.fact.outlets')" :value="fmtInt(model.outlets.length)" :sub="t('entity.fact.of', { n: model.dd.outlets.length })" />
      <EntityFact :label="t('entity.fact.groups')" :value="fmtInt(model.groups.filter(g => g.group).length)">
        <template #sub><NuxtLink v-if="model.echo" class="quiet-link" to="/stories">{{ t('entity.fact.echo', { n: model.echo }) }}</NuxtLink><template v-else>{{ t('entity.fact.noecho') }}</template></template>
      </EntityFact>
      <EntityFact v-if="model.people.length" :label="t('entity.fact.people')" :value="fmtInt(model.people.length)" :sub="model.people[0]!.person.name" />
    </EntityTitle>

    <DashCard class="c-8" :title="t('story.daily.title')" :info="t('story.daily.info')">
      <DayBars :dates="shown" :series="series" :height="220" :caption="t('outlet2.daily.aria')" :tip-of="dailyTip" :selectable="false" />
      <ChartLegend :items="series.map(x => ({ label: x.name, color: x.color }))" />
    </DashCard>

    <DashCard v-if="model.labelled && stance" class="c-4" :title="t('entity.stance.title')" :info="t('entity.stance.info')">
      <p v-if="stance.rows.length < 2" class="dcard-empty">{{ t('entity.stance.none') }}</p>
      <template v-else>
        <ChartLegend :items="STANCES.map((nm, i) => ({ label: t(`stance.${nm}`), color: `var(--stance-${nm})` }))" />
        <BarList :rows="stanceRows">
          <template #label="{ row }"><span class="dot" :style="`--dot:${row.row.color}`" aria-hidden="true" />{{ row.row.label }}</template>
          <template #bar="{ row }">
            <DivergingBar
              :left="row.row.crit" :middle="row.row.neu" :right="row.row.sup" :scale="stance.scale"
              :label="t('g2.stance.row', { group: row.row.label, critical: fmtPct(row.row.crit), neutral: fmtPct(row.row.neu), supportive: fmtPct(row.row.sup), n: fmtInt(row.row.n) })"
            />
          </template>
        </BarList>
      </template>
      <p v-if="stance.total" class="dcard-sub">{{ t('story.how.stance.n', { n: fmtInt(stance.total), total: fmtInt(model.articles) }) }}</p>
    </DashCard>

    <DashCard class="c-6" :title="t('entity.groups.title')" :info="t('story.outlets.info')">
      <GroupSunburst :groups="tree" :total="model.articles">
        <template #name="{ group }">
          <EntityLink v-if="group.slug" type="group" :to="groupPageHref(group.slug)">{{ group.key }}</EntityLink>
          <template v-else>{{ group.label }}</template>
        </template>
        <template #sub="{ group }">
          <span><template v-for="(o, k) in group.outlets" :key="o.slug">{{ k ? ' · ' : '' }}<EntityLink type="outlet" :to="outletHref(o.slug)">{{ o.name }}</EntityLink>{{ ` ${fmtInt(o.value)}` }}</template></span>
        </template>
      </GroupSunburst>
    </DashCard>

    <template v-if="model.labelled && how">
      <DashCard class="c-6" :title="t('story.how.title')" :info="t('story.how.info')">
        <div class="how-grid how-grid-2">
          <div v-for="(column, c) in how.columns" :key="c" class="how-panel">
            <template v-for="p in column" :key="p.title">
              <h3 class="rows-caption">{{ p.title }}</h3>
              <BarList v-if="p.rows.length" :rows="p.rows">
                <template #bar="{ row }"><DivergingBar :left="-row.diff" :right="row.diff" :scale="how.scale" :colors="['var(--emph-less)', null, 'var(--emph-more)']" :label="row.tipText" /></template>
              </BarList>
              <p v-if="p.note" class="dcard-sub">{{ p.note }}</p>
            </template>
          </div>
        </div>
        <ChartLegend :items="[{ label: t('story.how.more'), color: 'var(--emph-more)' }, { label: t('story.how.less'), color: 'var(--emph-less)' }]" />
      </DashCard>
      <DashCard class="c-8" :title="t('story.people.title')" :info="t('story.people.info')">
        <DataTable :rows="model.people" :columns="peopleColumns" rank-column :page-size="7" :empty-text="t('story.people.empty')">
          <template #cell-person="{ row }"><div><div>{{ row.person.name }}</div><span class="muted-text">{{ [row.person.role, row.person.party].filter(Boolean).join(' · ') }}</span></div></template>
          <template #cell-mentions="{ row }">{{ fmtInt(totalOf(row.counts)) }}</template>
          <template #cell-portrayal="{ row }"><StackedBar :segments="row.counts.map((n, i) => ({ label: t(`story.portrayal.${model!.dd.portrayals[i]}`), value: n, color: PORTRAYAL[i]! }))" /></template>
        </DataTable>
      </DashCard>
    </template>
    <DashCard v-else class="c-6" :title="t('story.how.title')">
      <p class="dcard-sub">{{ t('story.nolabels', { date: fmtDate(model.dd.dates[model.dd.dates.indexOf(model.dd.volumeFrom) - 1]!) }) }}</p>
    </DashCard>

    <DashCard class="c-4" :title="t('story.related.title')" :info="t('story.related.info')">
      <ul v-if="related.length" class="rows-related">
        <li v-for="r in related" :key="r.s.id">
          <span class="related-main">
            <EntityLink type="story" :to="storyHref(r.s.id)">{{ storyName(r.s) }}</EntityLink>
            <span class="muted-text">{{ r.shared.length ? t('story.related.shared', { words: r.shared.slice(0, 2).join(', ') }) : t('story.related.days') }}</span>
          </span>
          <SparkLine :values="r.values" :from="0" :to="model.last" :label="t('media2.spark.articles')" :width="84" :height="20" />
          <span class="row-value">{{ fmtInt(r.articles) }}</span>
        </li>
      </ul>
      <p v-else class="dcard-empty">{{ t('story.related.empty') }}</p>
    </DashCard>
  </div>
  <p v-if="problem || model" class="proto-note">{{ t('proto.states') }}</p>
</template>
