<script setup lang="ts">
import type { StoriesData } from '~/types/stories'
import type { StoryDetailData } from '~/types/story-detail'
import type { GroupOutlet, GroupsData, MediaDaily } from '~/utils/groups'

// The body of the group page (group-v2.html): the title card, the daily columns, the stance, the outlets, how the group writes, its topics and its stories.
const props = defineProps<{ slug: string }>()
const { t } = useI18n()
const media = useFixtureLazy<MediaDaily>('media', { required: ['dates', 'outlets', 'outletDaily'], isEmpty: b => b.outlets.length === 0 })
const list = useFixtureLazy<StoriesData>('stories', { required: ['issues', 'stories'], isEmpty: b => b.stories.length === 0 })
const detail = useFixtureLazy<StoryDetailData>('storyDetail', { required: ['outlets', 'stories'], isEmpty: b => b.stories.length === 0 })
const groupsData = useFixtureLazy<GroupsData>('groups', { required: ['groups', 'issues', 'topicsAll'], isEmpty: b => b.groups.length === 0 })
const fixtures = [media, list, detail, groupsData]
const loading = computed(() => fixtures.some(f => f.status.value === 'loading'))
const problem = computed(() => fixtures.map(f => f.status.value).find(s => s !== 'ready'))
const retry = () => fixtures.forEach(f => f.refresh())

const diffKey = computed(() => [{ label: t('story.how.more'), color: 'var(--emph-more)' }, { label: t('story.how.less'), color: 'var(--emph-less)' }])
const group = computed(() => groupsData.data.value?.groups.find(g => g.slug === props.slug) ?? null)
const colorOfGroup = computed(() => groupColors(groupsData.data.value?.groups ?? []))
const STANCES = ['critical', 'neutral', 'supportive'] as const

// null when the slug is not one of the groups (the 404 page).
const model = computed(() => {
  const m = media.data.value
  const d = list.data.value
  const dd = detail.data.value
  const g = groupsData.data.value
  const grp = group.value
  if (!m || !d || !dd || !g || !grp || problem.value) return null
  const last = m.dates.length - 1
  const daily = groupDaily(m, grp)
  const found = groupTopics(g, grp)
  const topics = { ...found, rows: found.rows.map(r => ({ ...r, label: topicName(r.issue) })) }
  const writes = groupWrites(g, grp)
  const rows = [writes.news && { key: 'news', label: t('outlet2.how.news'), ...writes.news }, writes.click && { key: 'click', label: t('outlet2.how.clickbait'), ...writes.click }].filter((r): r is NonNullable<typeof r> => !!r)
  return {
    m, d, g, grp, last, daily, topics, writes, howRows: rows, color: colorOfGroup.value.get(grp.name)!,
    ...groupWindow(daily, m.dates, g.window[1]),
    ...storiesOfGroup(d, dd, grp, last),
    topicScale: diffScale(topics.rows),
    howScale: diffScale(rows)
  }
})

const named = computed(() => group.value?.name ?? null)
provideDetailTitle(() => named.value)
useHead({ title: () => (named.value ? `${named.value} · ${t('site.name')}` : undefined) })

const columns = computed(() => [
  { key: 'outlet', label: t('group.col.outlet') },
  { key: 'collected', label: t('group.col.collected'), num: true },
  { key: 'bar', label: '', phone: false },
  { key: 'news', label: t('group.col.news'), num: true },
  { key: 'stance', label: t('group.col.stance'), phone: false },
  { key: 'clickbait', label: t('group.col.clickbait'), num: true }
])
const miniStance = (o: GroupOutlet) => STANCES.map((nm, i) => ({ label: t(`stance.${nm}`), value: o.stance[i]!, color: `var(--stance-${nm})` }))
const miniLabel = (o: GroupOutlet) => `${miniStance(o).map(s => `${s.label} ${fmtPct(totalOf(o.stance) ? s.value / totalOf(o.stance) : 0)}`).join(', ')} · n = ${fmtInt(totalOf(o.stance))}`
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
    <EntityTitle :kind="t('hero.kind.group')">
      <template #title><span class="group-cell"><span class="dot" :style="`--dot:${model.color}`" aria-hidden="true" />{{ model.grp.name }}</span></template>
      <template #meta>{{ `${t('period.text', { from: fmtDate(model.g.window[0]), to: fmtDate(model.g.window[1]) })} · ${t('entity.fact.days', { n: model.end - model.start + 1 })}` }}</template>
      <EntityFact :label="t('entity.fact.owner')" :value="model.grp.owner" />
      <EntityFact :label="t('entity.fact.lean')" :value="model.grp.lean || t('groups.lean.none')" />
      <EntityFact :label="t('entity.fact.outlets')" :value="fmtInt(model.grp.outlets.length)" />
      <EntityFact :label="t('entity.fact.articles')" :value="fmtInt(model.grp.collected)" :sub="t('group2.chip.share', { n: fmtPct(model.grp.collected / model.g.totalCollected) })" />
    </EntityTitle>

    <DailyCard class="c-8" :dates="model.m.dates" :daily="model.daily" :topic-days="model.topicDays" :issues="model.d.issues" :info="t('group2.daily.info')" />

    <StanceCard
      class="c-4"
      :rows="[{ label: t('entity.stance.group'), color: model.color, counts: model.writes.stanceMine }, { label: t('entity.stance.all'), color: NO_GROUP, counts: model.writes.stanceAll }]"
      :foot="model.writes.stanceN >= 30 ? t('outlet2.how.stance.n', { n: fmtInt(model.writes.stanceN) }) : null"
    />

    <DashCard class="c-8" :title="t('group2.outlets.title')" :info="t('group2.outlets.info')">
      <DataTable :rows="model.grp.outlets" :columns="columns" rank-column :page-size="10" :empty-text="t('group.empty')">
        <template #cell-outlet="{ row }"><EntityLink type="outlet" :to="outletHref(row.slug)">{{ row.name }}</EntityLink></template>
        <template #cell-collected="{ row }">{{ fmtInt(row.collected) }}</template>
        <template #cell-bar="{ row }"><HBar :value="row.collected / model.grp.collected" :max="1" /></template>
        <template #cell-news="{ row }">{{ row.analysed ? fmtPct(row.news / row.analysed) : '' }}</template>
        <template #cell-stance="{ row }"><StackedBar :segments="miniStance(row)" :min-n="30" :label="miniLabel(row)" /></template>
        <template #cell-clickbait="{ row }"><template v-if="row.cbKnown">{{ fmtPct(row.cbYes / row.cbKnown) }}</template><span v-else class="mini-empty">{{ t('group.clickbait.none') }}</span></template>
      </DataTable>
    </DashCard>

    <DashCard class="c-4" :title="t('group2.how.title')" :info="t('group2.how.info')">
      <DiffList v-if="model.howRows.length" :rows="model.howRows" :scale="model.howScale" tip-key="group2.how.tip" />
      <p class="dcard-sub">{{ t('outlet2.how.news.n', { n: fmtInt(model.writes.analysed) }) }}</p>
      <p class="dcard-sub">{{ model.writes.click ? t('outlet2.how.clickbait.n', { baited: fmtInt(model.writes.baited), scored: fmtInt(model.writes.scored) }) : t('outlet2.how.clickbait.none') }}</p>
      <ChartLegend :items="diffKey" />
    </DashCard>

    <DashCard class="c-8" :title="t('group2.topics.title')" :info="t('group2.topics.info')">
      <template #tools><ChartLegend :items="diffKey" /></template>
      <template v-if="model.topics.rows.length">
        <div class="how-grid how-grid-2">
          <div class="how-panel"><DiffList :rows="model.topics.rows.slice(0, 5)" :scale="model.topicScale" tip-key="group2.how.tip" /></div>
          <div class="how-panel"><DiffList :rows="model.topics.rows.slice(5)" :scale="model.topicScale" tip-key="group2.how.tip" /></div>
        </div>
        <p class="dcard-sub">{{ t('group2.topics.sub', { n: fmtInt(model.topics.nGroup) }) }}</p>
      </template>
      <p v-else class="dcard-empty">{{ t('outlet2.topics.empty') }}</p>
    </DashCard>

    <DashCard class="c-4" :title="t('group2.stories.title')" :info="t('group2.stories.info')">
      <template v-if="model.mine.length">
        <p v-if="model.withOthers" class="dcard-sub">{{ t('group2.stories.alone', { n: fmtInt(model.alone), total: fmtInt(model.withOthers) }) }}</p>
        <ul class="rows-related">
          <li v-for="r in model.mine.filter(x => x.story).slice(0, GROUP_STORIES)" :key="r.story!.id">
            <span class="related-main">
              <EntityLink type="story" :to="storyHref(r.story!.id)">{{ storyName(r.story!) }}</EntityLink>
              <span class="muted-text">{{ topicName(model.d.issues[r.story!.issue]!) }}</span>
            </span>
            <SparkLine :values="r.days" :from="0" :to="model.last" :label="t('media2.spark.articles')" :width="84" :height="20" />
            <span class="row-value">{{ fmtInt(r.n) }}</span>
          </li>
        </ul>
      </template>
      <p v-else class="dcard-empty">{{ t('outlet2.stories.empty') }}</p>
    </DashCard>
  </div>
  <p v-if="problem || model" class="proto-note">{{ t('proto.states') }}</p>
</template>
