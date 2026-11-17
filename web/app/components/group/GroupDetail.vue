<script setup lang="ts">
import { useWindowSize } from '@vueuse/core'
import type { StoriesData } from '~/types/stories'
import type { StoryDetailData } from '~/types/story-detail'
import type { GroupOutlet, GroupsData, MediaDaily } from '~/utils/groups'
import { PLEGMA_THEME_OUTLETS, PLEGMA_THEME_STORIES } from '~/utils/plegma/plegma-theme'
import { themeSlots } from '~/utils/plegma/plegma-world'

// The group on the Plegma, laid out as the outlet page is: the title card, its stories in a narrow column on the left, the web in the free cell (the group at the center, its largest stories
// around it in the color of their theme, and around each story the outlets of the group that wrote it: the stage draws it), the cards of the stance, how the group writes and its topics in two columns,
// and under them the daily articles with the outlets of the group beside them.
interface HomeThemes { issues: StoriesData['issues'], issueDaily: (number | null)[][] }
const props = defineProps<{ slug: string }>()
const { t } = useI18n()
const media = useFixtureLazy<MediaDaily>('media', { required: ['dates', 'outlets', 'outletDaily'], isEmpty: b => b.outlets.length === 0 })
const list = useFixtureLazy<StoriesData>('stories', { required: ['issues', 'stories'], isEmpty: b => b.stories.length === 0 })
const detail = useFixtureLazy<StoryDetailData>('storyDetail', { required: ['outlets', 'stories'], isEmpty: b => b.stories.length === 0 })
const groupsData = useFixtureLazy<GroupsData>('groups', { required: ['groups', 'issues', 'topicsAll'], isEmpty: b => b.groups.length === 0 })
const home = useFixtureLazy<HomeThemes>('home', { required: ['issues', 'issueDaily'], isEmpty: b => b.issues.length === 0 })
const plegma = usePlegmaStore()
const fixtures = [media, list, detail, groupsData, home]
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

// The web: the largest stories of the group, each with the outlets of the group that wrote it (the stage reads them from the store).
const slots = computed(() => (home.data.value ? themeSlots(home.data.value) : new Map<number, number>()))
const webStories = computed(() => {
  const m = model.value
  const dd = detail.data.value
  if (!m || !dd) return null
  return m.mine.filter(r => r.story).slice(0, PLEGMA_THEME_STORIES).map((r) => {
    const story = r.story!
    const slot = slots.value.get(story.issue) ?? 0
    const outlets = groupOutletsOfStory(dd, m.grp, story.id)
    return { id: story.id, name: storyName(story), n: r.n, media: outlets.length, slot, theme: topicName(m.d.issues[story.issue]!), outlets: outlets.slice(0, PLEGMA_THEME_OUTLETS).map(o => ({ name: o.name, group: null, slot, n: o.n })) }
  })
})
watch(webStories, list => plegma.setThemeStories(list?.length ? list : null), { immediate: true })
watch(() => (model.value ? slotOfColor(model.value.color) : 0), slot => plegma.setOutletSlot(slot), { immediate: true })
onBeforeUnmount(() => { plegma.setThemeStories(null); plegma.setOutletSlot(0); plegma.setHoverStory(null) })

// The map region is the free cell between the stories and the cards, under the title, as on the story, theme and outlet pages.
const orbit = ref<HTMLElement>()
const map = ref<HTMLElement>()
usePlegmaRegion(orbit, map, { side: 440, top: -32, bottom: 28, lean: 0.62, clear: true, ringPerSide: 0.45 })
const { height: windowHeight } = useWindowSize()
const tall = computed(() => Math.round(Math.min(300, Math.max(110, windowHeight.value * 0.2))))
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
  <div v-else ref="orbit" class="plegma-orbit is-outlet is-group" :class="{ 'is-in': plegma.landed }">
    <div class="plegma-title entity-grid">
      <EntityTitle :kind="t('hero.kind.group')">
        <template #title><span class="group-cell"><span class="dot" :style="`--dot:${model.color}`" aria-hidden="true" />{{ model.grp.name }}</span></template>
        <template #meta>{{ t('entity.fact.owner') }}: {{ model.grp.owner }}</template>
        <EntityFact :label="t('entity.fact.lean')" :value="model.grp.lean || t('groups.lean.none')" />
        <EntityFact :label="t('entity.fact.outlets')" :value="fmtInt(model.grp.outlets.length)" />
        <EntityFact :label="t('entity.fact.articles')" :value="fmtInt(model.grp.collected)" :sub="t('group2.chip.share', { n: fmtPct(model.grp.collected / model.g.totalCollected) })" />
      </EntityTitle>
    </div>

    <div class="orbit-col orbit-left">
      <PlegmaCard :at="2" :order="3" class="card-stories">
        <DashCard :title="t('group2.stories.title')" :info="t('group2.stories.info')">
          <template v-if="model.mine.length">
            <p v-if="model.withOthers" class="dcard-sub">{{ t('group2.stories.alone', { n: fmtInt(model.alone), total: fmtInt(model.withOthers) }) }}</p>
            <ul class="rows-related">
              <li v-for="r in model.mine.filter(x => x.story).slice(0, PLEGMA_THEME_STORIES)" :key="r.story!.id" @pointerenter="plegma.setHoverStory(r.story!.id)" @pointerleave="plegma.setHoverStory(null)" @focusin="plegma.setHoverStory(r.story!.id)" @focusout="plegma.setHoverStory(null)">
                <span class="related-main">
                  <EntityLink type="story" :to="storyHref(r.story!.id)">{{ storyName(r.story!) }}</EntityLink>
                  <span class="muted-text">{{ topicName(model.d.issues[r.story!.issue]!) }}</span>
                </span>
                <span class="row-value">{{ fmtInt(r.n) }}</span>
              </li>
            </ul>
          </template>
          <p v-else class="dcard-empty">{{ t('outlet2.stories.empty') }}</p>
        </DashCard>
      </PlegmaCard>
    </div>

    <div ref="map" class="orbit-map">
      <p class="plegma-nodes-note">{{ t('group.map.note') }}</p>
    </div>

    <div class="orbit-col orbit-right">
      <div class="orbit-subs">
        <div class="orbit-sub">
          <PlegmaCard :at="0" :order="1" class="card-stance">
            <StanceCard
              :rows="[{ label: t('entity.stance.group'), color: model.color, counts: model.writes.stanceMine }, { label: t('entity.stance.all'), color: NO_GROUP, counts: model.writes.stanceAll }]"
              :foot="model.writes.stanceN >= 30 ? t('outlet2.how.stance.n', { n: fmtInt(model.writes.stanceN) }) : null"
            />
          </PlegmaCard>
          <PlegmaCard :at="0" :order="2" class="card-how">
            <DashCard :title="t('group2.how.title')" :info="t('group2.how.info')">
              <DiffList v-if="model.howRows.length" :rows="model.howRows" :scale="model.howScale" tip-key="group2.how.tip" />
              <p class="dcard-sub">{{ t('outlet2.how.news.n', { n: fmtInt(model.writes.analysed) }) }}</p>
              <p class="dcard-sub">{{ model.writes.click ? t('outlet2.how.clickbait.n', { baited: fmtInt(model.writes.baited), scored: fmtInt(model.writes.scored) }) : t('outlet2.how.clickbait.none') }}</p>
              <ChartLegend :items="diffKey" />
            </DashCard>
          </PlegmaCard>
        </div>
        <div class="orbit-sub">
          <PlegmaCard :at="0" :order="3" class="card-topics">
            <DashCard :title="t('group2.topics.title')" :info="t('group2.topics.info')">
              <template #tools><ChartLegend :items="diffKey" /></template>
              <template v-if="model.topics.rows.length">
                <DiffList :rows="model.topics.rows" :scale="model.topicScale" tip-key="group2.how.tip" />
                <p class="dcard-sub">{{ t('group2.topics.sub', { n: fmtInt(model.topics.nGroup) }) }}</p>
              </template>
              <p v-else class="dcard-empty">{{ t('outlet2.topics.empty') }}</p>
            </DashCard>
          </PlegmaCard>
        </div>
      </div>
    </div>

    <div class="orbit-col orbit-under">
      <PlegmaCard :at="4" :order="2" class="card-days">
        <DailyCard :dates="model.m.dates" :daily="model.daily" :topic-days="model.topicDays" :issues="model.d.issues" :info="t('group2.daily.info')" :height="tall" />
      </PlegmaCard>
      <PlegmaCard :at="4" :order="3" class="card-latest">
        <DashCard :title="t('group2.outlets.title')" :info="t('group2.outlets.info')">
          <DataTable :rows="model.grp.outlets" :columns="columns" rank-column :page-size="100" :empty-text="t('group.empty')">
            <template #cell-outlet="{ row }"><EntityLink type="outlet" :to="outletHref(row.slug)">{{ row.name }}</EntityLink></template>
            <template #cell-collected="{ row }">{{ fmtInt(row.collected) }}</template>
            <template #cell-bar="{ row }"><HBar :value="row.collected / model.grp.collected" :max="1" /></template>
            <template #cell-news="{ row }">{{ row.analysed ? fmtPct(row.news / row.analysed) : '' }}</template>
            <template #cell-stance="{ row }"><StackedBar :segments="miniStance(row)" :min-n="30" :label="miniLabel(row)" /></template>
            <template #cell-clickbait="{ row }"><template v-if="row.cbKnown">{{ fmtPct(row.cbYes / row.cbKnown) }}</template><span v-else class="mini-empty">{{ t('group.clickbait.none') }}</span></template>
          </DataTable>
        </DashCard>
      </PlegmaCard>
    </div>
  </div>
  <p v-if="problem && problem !== 'loading'" class="proto-note">{{ t('proto.states') }}</p>
</template>
