<script setup lang="ts">
import type { StoriesData } from '~/types/stories'
import type { StoryDetailData } from '~/types/story-detail'
import type { TopicsData } from '~/types/topics'
import type { GroupsData } from '~/utils/groups'

// The body of the topic page (topic-v2.html): the title card, the daily columns, the stance, the outlets, the stories, the groups and how the topic is written.
const props = defineProps<{ index: number }>()
const { t } = useI18n()
const home = useFixtureLazy<TopicsData>('home', { required: ['dates', 'issues', 'issueDaily'], isEmpty: b => b.issueDaily.length === 0 })
const list = useFixtureLazy<StoriesData>('stories', { required: ['issues', 'stories'], isEmpty: b => b.stories.length === 0 })
const detail = useFixtureLazy<StoryDetailData>('storyDetail', { required: ['outlets', 'stories', 'base'], isEmpty: b => b.stories.length === 0 })
const groupsData = useFixtureLazy<GroupsData>('groups', { required: ['groups', 'topicsAll'], isEmpty: b => b.groups.length === 0 })
const fixtures = [home, list, detail, groupsData]
const loading = computed(() => fixtures.some(f => f.status.value === 'loading'))
const problem = computed(() => fixtures.map(f => f.status.value).find(s => s !== 'ready'))
const retry = () => fixtures.forEach(f => f.refresh())

const twoDecimals = new Intl.NumberFormat('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const diffKey = computed(() => [{ label: t('story.how.more'), color: 'var(--emph-more)' }, { label: t('story.how.less'), color: 'var(--emph-less)' }])
const colorOfGroup = computed(() => groupColors(groupsData.data.value?.groups ?? []))
const part = (arr: number[], i: number, s = totalOf(arr)) => (s ? arr[i]! / s : 0)

// null when the index is not one of the topics (the 404 page).
const model = computed(() => {
  const hd = home.data.value
  const d = list.data.value
  const dd = detail.data.value
  const gd = groupsData.data.value
  if (!hd || !d || !dd || !gd || problem.value) return null
  if (!Number.isInteger(props.index) || props.index < 0 || props.index >= hd.issues.length) return null
  const index = props.index
  const issue = hd.issues[index]!
  const stats = topicStats(hd, index)
  const mine = storiesOfTopic(d, index)
  const articles = topicArticles(d, dd, index)
  const outlets = outletDiffs(dd, articles)
  const { det } = articles

  const usualTopic = totalOf(gd.topicsAll) ? gd.topicsAll[index]! / totalOf(gd.topicsAll) : 0
  const groups = gd.groups.map((g) => {
    const total = totalOf(g.topics)
    return { key: g.name, label: g.name, value: total ? g.topics[index]! / total : 0, usual: usualTopic }
  }).sort((a, b) => (b.value - b.usual) - (a.value - a.usual))

  // How the topic is written: the frame, the section, the stance and the clickbait, each against all articles. The rows share one scale.
  const framed = (key: 'f' | 'c', labels: string[], prefix: string, count: number) =>
    det[key].map((_, i) => ({ key: `${key}${i}`, label: t(`story.${prefix}.${labels[i]}`), value: part(det[key], i), usual: part(dd.base[key], i) }))
      .filter(r => r.value > 0).sort((a, b) => b.value - a.value).slice(0, count)
  const stanceN = totalOf(det.s.slice(1))
  const stanceRows = (['critical', 'neutral', 'supportive'] as const).map((code, i) => ({ key: code, label: t(`stance.${code}`), value: part(det.s.slice(1), i, stanceN), usual: part(dd.base.s.slice(1), i, totalOf(dd.base.s.slice(1))) }))
  const [scored, baited] = det.k as [number, number]
  const click = scored ? [{ key: 'clickbait', label: t('story.how.clickbait'), value: baited / scored, usual: dd.base.k[1]! / dd.base.k[0]! }] : []
  const frames = framed('f', dd.frames, 'frame', 8)
  const sections = framed('c', dd.sections, 'section', 6)

  return {
    hd, d, dd, issue, ...stats, mine, ...articles, outlets, groups, stanceN, scored, baited, frames, sections, click,
    outletScale: diffScale([...outlets.more, ...outlets.less, ...groups]),
    howScale: diffScale([...frames, ...sections, ...(stanceN ? stanceRows : []), ...click]),
    similar: similarTopics(hd, index),
    storiesPerDay: hd.dates.map((_, i) => mine.filter(x => x.values[i]! > 0).length)
  }
})

// The name of the topic is in the trail and the title of the document as soon as the topics are there, also when another card has no data (the static title()).
const named = computed(() => { const issue = home.data.value?.issues[props.index]; return issue ? topicName(issue) : null })
provideDetailTitle(() => named.value)
useHead({ title: () => (named.value ? `${named.value} · ${t('site.name')}` : undefined) })

const dayLabel = (i: number) => fmtDay(home.data.value!.dates[i]!)
// A day after the coded days has no count (null): the tooltip shows a dash.
const dailyTip = (i: number) => {
  const m = model.value!
  const v = m.daily[i]
  return `${t('story.daily.tip', { date: fmtDate(m.hd.dates[i]!), n: v === null || v === undefined ? '–' : fmtInt(v) })}${v ? `: ${topicName(m.issue)} ${fmtInt(v)}` : ''}`
}
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
    <EntityTitle :kind="t('hero.kind.topic')" :title="topicName(model.issue)">
      <template #meta>{{ `${dayLabel(0)} → ${fmtDate(model.hd.dates[model.last]!)} · ${t('entity.fact.days', { n: model.last + 1 })}` }}</template>
      <EntityFact :label="t('entity.fact.articles')" :value="fmtInt(model.total)" :sub="t('entity.fact.peak', { date: dayLabel(model.peak), n: fmtInt(model.daily[model.peak] ?? 0) })">
        <template #spark><SparkLine :values="model.daily.map(v => v ?? 0)" :from="0" :to="model.last" :label="t('topic2.daily.title')" :width="56" :height="16" /></template>
      </EntityFact>
      <EntityFact :label="t('entity.fact.stories')" :value="fmtInt(model.mine.length)">
        <template #spark><SparkLine :values="model.storiesPerDay" :from="0" :to="model.hd.dates.length - 1" :label="t('entity.fact.stories')" :width="56" :height="16" /></template>
      </EntityFact>
      <EntityFact :label="t('entity.fact.share')" :value="fmtPct(model.share)" :sub="t('entity.fact.rank', { n: model.rank, total: model.hd.issues.length })" />
      <EntityFact v-if="model.change !== null && !model.issue.catchAll" :label="t('entity.fact.change')" :value="`${model.change > 0 ? '▲' : '▼'} ${fmtSigned(model.change * 100)}%`" :sub="t('entity.fact.change.sub')" />
    </EntityTitle>

    <DashCard class="c-8" :title="t('topic2.daily.title')" :info="t('topic2.daily.info')">
      <DayBars :dates="model.hd.dates" :series="[{ name: topicName(model.issue), color: 'var(--series-news)', values: model.daily.map(v => v ?? 0) }]" :height="300" :caption="t('outlet2.daily.aria')" :tip-of="dailyTip" :selectable="false" />
    </DashCard>

    <div class="entity-stack c-4">
      <StanceCard
        class="c-4"
        :rows="[{ label: t('entity.stance.topic'), color: 'var(--series-news)', counts: model.det.s.slice(1) }, { label: t('entity.stance.all'), color: NO_GROUP, counts: model.dd.base.s.slice(1) }]"
        :foot="model.stanceN ? t('topic2.how.stance.n', { n: fmtInt(model.stanceN) }) : null"
      />
      <DashCard :title="t('topic2.similar.title')" :info="t('topic2.similar.info')">
        <BarList v-if="model.similar.length" :rows="model.similar.map(r => ({ key: r.k, label: topicName(r.issue), to: topicHref(r.k), text: twoDecimals.format(r.r), value: r.r, color: '' }))" :max="1">
          <template #label="{ row }"><EntityLink type="topic" :to="row.to!">{{ row.label }}</EntityLink></template>
        </BarList>
        <p v-else class="dcard-empty">{{ t('topic2.similar.empty') }}</p>
      </DashCard>
    </div>

    <DashCard class="c-8" :title="t('topic2.outlets.title')" :info="t('topic2.outlets.info')">
      <template #tools><ChartLegend :items="diffKey" /></template>
      <template v-if="model.outlets.rows.length">
        <div class="how-grid how-grid-2">
          <div v-for="side in ['more', 'less'] as const" :key="side" class="how-panel">
            <h3 class="rows-caption">{{ t(`topic2.outlets.${side}`) }}</h3>
            <DiffList :rows="model.outlets[side]" :scale="model.outletScale" tip-key="topic2.how.tip">
              <template #label="{ row }"><EntityLink type="outlet" :to="outletHref(row.o.slug)">{{ row.label }}</EntityLink></template>
            </DiffList>
          </div>
        </div>
        <p class="dcard-sub">{{ t('topic2.outlets.n', { n: fmtInt(model.rowsTopic), total: fmtInt(model.rowsAll) }) }}</p>
      </template>
      <p v-else class="dcard-empty">{{ t('topic2.empty') }}</p>
    </DashCard>

    <DashCard class="c-4" :title="t('topic2.stories.title')" :info="t('topic2.stories.info')">
      <ul v-if="model.mine.length" class="rows-related">
        <li v-for="s in model.mine.slice(0, TOPIC_STORIES)" :key="s.id">
          <span class="related-main">
            <EntityLink type="story" :to="storyHref(s.id)">{{ storyName(s) }}</EntityLink>
            <span class="muted-text">{{ t('topic2.stories.outlets', { n: s.outlets }) }}</span>
          </span>
          <SparkLine :values="s.values" :from="0" :to="model.d.dates.length - 1" :label="t('media2.spark.articles')" :width="84" :height="20" />
          <span class="row-value">{{ fmtInt(s.articles) }}</span>
        </li>
      </ul>
      <p v-else class="dcard-empty">{{ t('topic2.stories.empty') }}</p>
    </DashCard>

    <DashCard class="c-6" :title="t('topic2.groups.title')" :info="t('topic2.groups.info')">
      <DiffList :rows="model.groups" :scale="model.outletScale" tip-key="topic2.how.tip">
        <template #label="{ row }"><span class="group-cell"><span class="dot" :style="`--dot:${colorOfGroup.get(row.label)}`" />{{ row.label }}</span></template>
      </DiffList>
      <ChartLegend :items="diffKey" />
    </DashCard>

    <DashCard class="c-6" :title="t('topic2.how.title')" :info="t('topic2.how.info')">
      <div class="how-grid how-grid-2">
        <div class="how-panel">
          <h3 class="rows-caption">{{ t('story.how.frame') }}</h3>
          <DiffList v-if="model.frames.length" :rows="model.frames" :scale="model.howScale" tip-key="topic2.how.tip" />
        </div>
        <div>
          <div class="how-panel">
            <h3 class="rows-caption">{{ t('story.how.section') }}</h3>
            <DiffList v-if="model.sections.length" :rows="model.sections" :scale="model.howScale" tip-key="topic2.how.tip" />
          </div>
          <div class="how-panel">
            <h3 class="rows-caption">{{ t('story.how.clickbait') }}</h3>
            <DiffList v-if="model.click.length" :rows="model.click" :scale="model.howScale" tip-key="topic2.how.tip" />
            <p class="dcard-sub">{{ model.scored ? t('story.how.clickbait.n', { n: fmtInt(model.baited), total: fmtInt(model.scored) }) : t('story.how.clickbait.none') }}</p>
          </div>
        </div>
      </div>
      <ChartLegend :items="diffKey" />
    </DashCard>
  </div>
  <p v-if="problem || model" class="proto-note">{{ t('proto.states') }}</p>
</template>
