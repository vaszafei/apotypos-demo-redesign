<script setup lang="ts">
import { useWindowSize } from '@vueuse/core'
import type { StoriesData } from '~/types/stories'
import type { StoryDetailData } from '~/types/story-detail'
import type { Series } from '~/types/topics'
import type { GroupsData, MediaDaily } from '~/utils/groups'
import { PLEGMA_THEME_STORIES } from '~/utils/plegma/plegma-theme'

// The group on the Plegma, laid out as the story and the theme pages are: the title card, its outlets (the table) in the narrow column on the left, the web in the free cell (the group at the
// center and its outlets around it; the ring is an arc for each outlet as wide as its articles, and the tabs turn it to the stance), the cards of the stance, how the group writes and its topics
// in two columns, and under them the analysed articles per day, a line for each outlet.
const props = defineProps<{ slug: string }>()
const { t } = useI18n()
const media = useFixtureLazy<MediaDaily>('media', { required: ['dates', 'outlets', 'outletDaily'], isEmpty: b => b.outlets.length === 0 })
const list = useFixtureLazy<StoriesData>('stories', { required: ['issues', 'stories'], isEmpty: b => b.stories.length === 0 })
const detail = useFixtureLazy<StoryDetailData>('storyDetail', { required: ['outlets', 'stories'], isEmpty: b => b.stories.length === 0 })
const groupsData = useFixtureLazy<GroupsData>('groups', { required: ['groups', 'issues', 'topicsAll'], isEmpty: b => b.groups.length === 0 })
const plegma = usePlegmaStore()
const fixtures = [media, list, detail, groupsData]
const loading = computed(() => fixtures.some(f => f.status.value === 'loading'))
const problem = computed(() => fixtures.map(f => f.status.value).find(s => s !== 'ready'))
const retry = () => fixtures.forEach(f => f.refresh())

const diffKey = computed(() => [{ label: t('story.how.more'), color: 'var(--emph-more)' }, { label: t('story.how.less'), color: 'var(--emph-less)' }])
const group = computed(() => groupsData.data.value?.groups.find(g => g.slug === props.slug) ?? null)
const colorOfGroup = computed(() => groupColors(groupsData.data.value?.groups ?? []))

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

// The column on the left is narrow (2 of 12 parts): the share of the group's articles is the arc of the ring and the stance is its other tab, and the news share and the stance are in the cards, so the table keeps the outlet and its articles.
const columns = computed(() => [
  { key: 'outlet', label: t('group.col.outlet') },
  { key: 'collected', label: t('home.field.articles'), num: true }
])

// A line for each outlet of the group: its analysed articles each day, from the first day to the last that any outlet has.
const lines = computed(() => {
  const m = model.value
  if (!m) return null
  const members = new Set(m.grp.outlets.map(o => o.slug))
  const rows = m.m.outlets
    .map((o, k) => ({ o, k }))
    .filter(({ o }) => members.has(o.slug))
    .map(({ o, k }) => ({ key: o.slug, name: o.name, values: m.m.dates.map((_, i) => (m.m.outletDaily[k]![i] as [number | null, number | null])[0] ?? 0) }))
    .map(r => ({ ...r, total: r.values.reduce((a, v) => a + v, 0) }))
    .filter(r => r.total > 0)
    .sort((a, b) => b.total - a.total)
  const span = dataSpan(rows)
  if (!span) return null
  return { dates: m.m.dates.slice(span[0], span[1] + 1), series: rows.map((r, i) => ({ key: r.key, name: r.name, color: `var(--cat-${i + 1})`, values: r.values.slice(span[0], span[1] + 1) })) as Series[] }
})

// The web: the group at the center and the outlets that belong to it around it, each as large as its articles; a click on one opens the outlet. An outlet with no group is in no web.
const webStories = computed(() => {
  const m = model.value
  if (!m) return null
  return m.grp.outlets.filter(o => o.collected > 0).slice(0, PLEGMA_THEME_STORIES).map((o, i) => ({ id: i + 1, name: o.name, n: o.collected, media: 0, outlets: [], href: outletHref(o.slug) }))
})
watch(webStories, list => plegma.setThemeStories(list?.length ? list : null), { immediate: true })
watch(() => (model.value ? slotOfColor(model.value.color) : 0), slot => plegma.setOutletSlot(slot), { immediate: true })

// The ring: an arc for each outlet of the group, as wide as its articles (the share of the outlets), or the arcs of the stance of the group. The stance card gives no row under 30 rated articles,
// so the ring has no stance under it either, and then there are no tabs.
const STANCE_MIN = 30
const ring = computed({ get: () => (plegma.ring === 'stance' ? 'stance' : 'groups'), set: (v: string) => plegma.setRing(v === 'stance' ? 'stance' : 'groups') })
const ringArcs = computed(() => {
  const m = model.value
  if (!m) return null
  const slot = slotOfColor(m.color)
  const arcs = m.grp.outlets.filter(o => o.collected > 0).sort((a, b) => b.collected - a.collected).map(o => ({ name: o.name, slot, n: o.collected }))
  return arcs.length ? arcs : null
})
const stanceOfGroup = computed(() => (analysedShown && model.value && model.value.writes.stanceN >= STANCE_MIN ? model.value.writes.stanceMine : null))
watch(ringArcs, list => plegma.setThemeGroups(list), { immediate: true })
watch(stanceOfGroup, counts => { plegma.setStance(counts); if (!counts && plegma.ring === 'stance') plegma.setRing('groups') }, { immediate: true })
onBeforeUnmount(() => { plegma.setThemeStories(null); plegma.setThemeGroups(null); plegma.setStance(null); plegma.setOutletSlot(0) })

// The map region is the free cell under the title beside the cards, under the title, as on the story, theme and outlet pages.
const orbit = ref<HTMLElement>()
const map = ref<HTMLElement>()
usePlegmaRegion(orbit, map, { side: 440, top: -32, bottom: 28, lean: 0.15, clear: true, ringPerSide: 0.45 })
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
  <div v-else ref="orbit" class="plegma-orbit is-group" :class="{ 'is-in': plegma.landed, 'is-leaving': plegma.leaving, 'no-right': !(analysedShown || topicsShown) }">
    <div class="plegma-title entity-grid">
      <EntityTitle :kind="t('hero.kind.group')">
        <template #title><span class="group-cell"><span class="dot" :style="`--dot:${model.color}`" aria-hidden="true" />{{ model.grp.name }}</span></template>
        <EntityFact :label="t('entity.fact.outlets')" :value="fmtInt(model.grp.outlets.length)" />
        <EntityFact :label="t('entity.fact.articles')" :value="fmtInt(model.grp.collected)" :sub="t('group2.chip.share', { n: fmtPct(model.grp.collected / model.g.totalCollected) })" />
      </EntityTitle>
    </div>

    <SegmentedControl v-if="stanceOfGroup" v-model="ring" class="orbit-ring-tabs" :label="t('group.ring.label')" :options="[{ value: 'groups', label: t('group.ring.outlets') }, { value: 'stance', label: t('story.ring.stance') }]" />

    <div class="orbit-col orbit-left">
      <PlegmaCard :at="0" :order="1" class="card-members">
        <DashCard :title="t('group2.outlets.title')" :info="t('group2.outlets.info')">
          <DataTable :rows="model.grp.outlets" :columns="columns" :page-size="100" :empty-text="t('group.empty')">
            <template #cell-outlet="{ row }"><EntityLink type="outlet" :to="outletHref(row.slug)">{{ row.name }}</EntityLink></template>
            <template #cell-collected="{ row }">{{ fmtInt(row.collected) }}</template>
          </DataTable>
        </DashCard>
      </PlegmaCard>
    </div>

    <div ref="map" class="orbit-map">
      <p class="plegma-nodes-note">{{ t('group.map.note') }}</p>
    </div>

    <div v-if="analysedShown || topicsShown" class="orbit-col orbit-right">
      <div class="orbit-subs">
        <div v-if="analysedShown" class="orbit-sub">
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
        <div v-if="topicsShown" class="orbit-sub">
          <PlegmaCard :at="0" :order="3" class="card-topics">
            <DashCard :title="t('group2.topics.title')" :info="t('group2.topics.info')">
              <template v-if="model.topics.rows.length">
                <DiffList :rows="model.topics.rows" :scale="model.topicScale" tip-key="group2.how.tip" />
                <p class="dcard-sub">{{ t('group2.topics.sub', { n: fmtInt(model.topics.nGroup) }) }}</p>
                <ChartLegend :items="diffKey" />
              </template>
              <p v-else class="dcard-empty">{{ t('outlet2.topics.empty') }}</p>
            </DashCard>
          </PlegmaCard>
        </div>
      </div>
    </div>

    <div class="orbit-col orbit-under">
      <PlegmaCard :at="4" :order="2" class="card-days">
        <DashCard :title="t('group.daily.title')" :info="t('group.daily.info')">
          <LinesChart v-if="lines" :dates="lines.dates" :series="lines.series" :tall="tall" :caption="t('group.daily.title')" :href-of="s => outletHref(s.key)" />
          <p v-else class="dcard-empty">{{ t('outlet2.topics.empty') }}</p>
        </DashCard>
      </PlegmaCard>
    </div>
  </div>
  <p v-if="problem && problem !== 'loading'" class="proto-note">{{ t('proto.states') }}</p>
</template>
