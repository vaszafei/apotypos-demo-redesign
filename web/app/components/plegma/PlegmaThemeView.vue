<script setup lang="ts">
import { useWindowSize } from '@vueuse/core'
import { PLEGMA_THEME_OUTLETS, PLEGMA_THEME_STORIES } from '~/utils/plegma-theme'
import type { StoriesData } from '~/types/stories'
import type { StoryDetailData } from '~/types/story-detail'
import type { TopicsData } from '~/types/topics'
import type { GroupsData } from '~/utils/groups'
import { themeSlots } from '~/utils/plegma-world'

// The theme view: the theme on the Plegma (a web with the theme at the center, its largest stories around it and the outlets that wrote each story around the story, and under
// it the articles of the theme for each day: the stage draws both in the free cell) with the cards of the topic page around the map: its stories, the stance, the outlets and
// groups that write it more or less than usual, how it is written, the themes like it.
const props = defineProps<{ index: number }>()
const { t } = useI18n()
const plegma = usePlegmaStore()
const home = useFixtureLazy<TopicsData>('home', { required: ['dates', 'issues', 'issueDaily'], isEmpty: b => b.issueDaily.length === 0 })
const list = useFixtureLazy<StoriesData>('stories', { required: ['issues', 'stories'], isEmpty: b => b.stories.length === 0 })
const detail = useFixtureLazy<StoryDetailData>('storyDetail', { required: ['outlets', 'stories', 'base'], isEmpty: b => b.stories.length === 0 })
const groupsData = useFixtureLazy<GroupsData>('groups', { required: ['groups', 'topicsAll'], isEmpty: b => b.groups.length === 0 })
const fixtures = [home, list, detail, groupsData]
const loading = computed(() => fixtures.some(f => f.status.value === 'loading'))
const problem = computed(() => fixtures.map(f => f.status.value).find(s => s !== 'ready'))
const retry = () => fixtures.forEach(f => f.refresh())

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
    howScale: diffScale([...frames, ...sections, ...(stanceN ? stanceRows : []), ...click])
  }
})

// The name of the topic is in the trail and the title of the document as soon as the topics are there, also when another card has no data (the static title()).
const named = computed(() => { const issue = home.data.value?.issues[props.index]; return issue ? topicName(issue) : null })
provideDetailTitle(() => named.value)
useHead({ title: () => (named.value ? `${named.value} · ${t('site.name')}` : undefined) })

const dayLabel = (i: number) => fmtDay(home.data.value!.dates[i]!)

// The stories the web shows are the largest of the theme: the card lists the same ones, so a row is the name of a sector of the web.
const listed = computed(() => (model.value ? model.value.mine.slice(0, PLEGMA_THEME_STORIES) : []))
// For the map: each of those stories with the outlets that wrote it most and the articles of each (storyDetail.json has them for each outlet and day).
const themeStories = computed(() => {
  const m = model.value
  if (!m) return null
  const rows = new Map(m.dd.stories.map(r => [r.id, r]))
  return listed.value.map((s) => {
    const count = new Map<number, number>()
    const t = rows.get(s.id)?.t ?? []
    for (let i = 0; i + 2 < t.length; i += 3) count.set(t[i]!, (count.get(t[i]!) ?? 0) + t[i + 2]!)
    const outlets = [...count].map(([o, n]) => {
      const outlet = m.dd.outlets[o]!
      return { name: outlet.name, group: outlet.group, slot: slotOfColor((outlet.group && colorOfGroup.value.get(outlet.group)) || NO_GROUP), n }
    })
    return { id: s.id, name: storyName(s), n: s.articles, media: outlets.length, outlets: outlets.sort((a, b) => b.n - a.n).slice(0, PLEGMA_THEME_OUTLETS) }
  })
})
watch(themeStories, list => plegma.setThemeStories(list), { immediate: true })
// The stance card gives no row under 30 rated articles (StanceCard), so the ring has no stance under it either.
const STANCE_MIN = 30
// The ring of the web: an arc for each group that wrote the theme (as wide as its articles in all the stories of the theme), or the arcs of the stance; the tabs turn it.
const ring = computed({ get: () => plegma.ring, set: (v: string) => plegma.setRing(v === 'stance' ? 'stance' : 'groups') })
const themeGroups = computed(() => {
  const m = model.value
  if (!m) return null
  const rows = new Map(m.dd.stories.map(r => [r.id, r]))
  const count = new Map<string | null, number>()
  for (const s of m.mine) {
    const t = rows.get(s.id)?.t ?? []
    for (let i = 0; i + 2 < t.length; i += 3) {
      const group = m.dd.outlets[t[i]!]!.group ?? null
      count.set(group, (count.get(group) ?? 0) + t[i + 2]!)
    }
  }
  return [...count].filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1])
    .map(([group, n]) => ({ name: group ?? t('story.nogroup'), slot: slotOfColor((group && colorOfGroup.value.get(group)) || NO_GROUP), n }))
})
watch(themeGroups, list => plegma.setThemeGroups(list), { immediate: true })
watch(() => (model.value && model.value.stanceN >= STANCE_MIN ? model.value.det.s.slice(1) : null), counts => plegma.setStance(counts), { immediate: true })
onBeforeUnmount(() => { plegma.setHoverStory(null); plegma.setThemeStories(null); plegma.setThemeGroups(null); plegma.setStance(null); plegma.setRing('groups') })

// The map region is the free cell between the stories and the cards, under the title: the same square as the story view has, so the two webs are the same size.
const orbit = ref<HTMLElement>()
const map = ref<HTMLElement>()
usePlegmaRegion(orbit, map)

// The theme over time, as the story view has its days (PlegmaDaysCard): the line of the theme, and under it a line for each story the web shows. The axis is the square
// root, so the stories are not flat next to the theme.
const { height: windowHeight } = useWindowSize()
const tall = computed(() => Math.round(Math.min(300, Math.max(110, windowHeight.value * 0.12))))
const timeLines = computed(() => {
  const m = model.value
  if (!m) return null
  const slot = themeSlots(m.hd).get(props.index) ?? 0
  const to = m.last + 1
  const others = [1, 2, 3, 4, 5, 6, 7, 8].filter(c => c !== slot)
  const stories = listed.value.map((s, i) => ({ key: `s${s.id}`, name: storyName(s), color: `var(--cat-${others[i % others.length]})`, values: s.values.slice(0, to) }))
  const theme = { key: 'topic', name: topicName(m.issue), color: slot ? `var(--cat-${slot})` : 'var(--ink)', values: m.daily.slice(0, to).map(v => v ?? 0) }
  return { dates: m.hd.dates.slice(0, to), series: [theme, ...stories] }
})
const lineHref = (key: string) => (key === 'topic' ? topicHref(String(props.index)) : storyHref(Number(key.slice(1))))
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
  <div v-else ref="orbit" class="plegma-orbit is-theme" :class="{ 'is-in': plegma.landed }">
    <div class="plegma-title entity-grid">
      <EntityTitle :kind="t('hero.kind.topic')" :title="topicName(model.issue)">
        <template #meta>{{ `${dayLabel(0)} → ${fmtDate(model.hd.dates[model.last]!)} · ${t('entity.fact.days', { n: model.last + 1 })}` }}</template>
        <EntityFact :label="t('entity.fact.articles')" :value="fmtInt(model.total)" />
        <EntityFact :label="t('entity.fact.stories')" :value="fmtInt(model.mine.length)" />
        <EntityFact :label="t('entity.fact.share')" :value="fmtPct(model.share)" :sub="t('entity.fact.rank', { n: model.rank, total: model.hd.issues.length })" />
        <EntityFact v-if="model.change !== null && !model.issue.catchAll" :label="t('entity.fact.change')" :value="`${model.change > 0 ? '▲' : '▼'} ${fmtSigned(model.change * 100)}%`" :sub="t('entity.fact.change.sub')" />
      </EntityTitle>
    </div>

    <div class="orbit-col orbit-left">
      <PlegmaCard :at="2" :order="3" class="card-stories">
        <DashCard :title="t('topic2.stories.title')" :info="t('topic2.stories.info')">
          <ul v-if="listed.length" class="rows-related">
            <li v-for="s in listed" :key="s.id" @pointerenter="plegma.setHoverStory(s.id)" @pointerleave="plegma.setHoverStory(null)" @focusin="plegma.setHoverStory(s.id)" @focusout="plegma.setHoverStory(null)">
              <span class="related-main">
                <EntityLink type="story" :to="storyHref(s.id)">{{ storyName(s) }}</EntityLink>
                <span class="muted-text">{{ `${dayLabel(s.days[0]!)} · ${t('topic2.stories.outlets', { n: s.outlets })}` }}</span>
              </span>
              <span class="row-value">{{ fmtInt(s.articles) }}</span>
            </li>
          </ul>
          <p v-else class="dcard-empty">{{ t('topic2.stories.empty') }}</p>
        </DashCard>
      </PlegmaCard>
    </div>

    <div ref="map" class="orbit-map">
      <SegmentedControl v-if="model.stanceN >= STANCE_MIN" v-model="ring" class="orbit-ring-tabs" :label="t('story.ring.label')" :options="[{ value: 'groups', label: t('story.groups.title') }, { value: 'stance', label: t('story.ring.stance') }]" />
      <p class="plegma-nodes-note">{{ t('topic.map.note') }}</p>
    </div>

    <div class="orbit-col orbit-right">
      <div class="orbit-subs">
        <div class="orbit-sub">
          <PlegmaCard :at="0" :order="1" class="card-stance">
            <StanceCard
              :rows="[{ label: t('entity.stance.topic'), color: 'var(--series-news)', counts: model.det.s.slice(1) }, { label: t('entity.stance.all'), color: NO_GROUP, counts: model.dd.base.s.slice(1) }]"
              :foot="model.stanceN ? t('topic2.how.stance.n', { n: fmtInt(model.stanceN) }) : null"
            />
          </PlegmaCard>
          <PlegmaCard :at="4" :order="2" class="card-outlets-diff">
            <DashCard :title="t('topic2.outlets.title')" :info="t('topic2.outlets.info')">
              <template v-if="model.outlets.rows.length">
                <div class="how-grid how-grid-2">
                  <div v-for="side in ['more', 'less'] as const" :key="side" class="how-panel">
                    <h3 class="rows-caption">{{ t(`topic2.outlets.${side}`) }}</h3>
                    <DiffList :rows="model.outlets[side]" :scale="model.outletScale" tip-key="topic2.how.tip">
                      <template #label="{ row }"><EntityLink type="outlet" :to="outletHref(row.o.slug)">{{ row.label }}</EntityLink></template>
                    </DiffList>
                  </div>
                </div>
                <div class="theme-foot"><p class="dcard-sub">{{ t('topic2.outlets.n', { n: fmtInt(model.rowsTopic), total: fmtInt(model.rowsAll) }) }}</p><ChartLegend :items="diffKey" /></div>
              </template>
              <p v-else class="dcard-empty">{{ t('topic2.empty') }}</p>
            </DashCard>
          </PlegmaCard>
        </div>
        <div class="orbit-sub">
          <PlegmaCard :at="4" :order="3" class="card-groups-diff">
            <DashCard :title="t('topic2.groups.title')" :info="t('topic2.groups.info')">
              <div class="how-panel">
                <DiffList :rows="model.groups" :scale="model.outletScale" tip-key="topic2.how.tip">
                  <template #label="{ row }"><span class="group-cell"><span class="dot" :style="`--dot:${colorOfGroup.get(row.label)}`" /><span class="group-name">{{ row.label }}</span></span></template>
                </DiffList>
              </div>
              <ChartLegend :items="diffKey" />
            </DashCard>
          </PlegmaCard>
          <PlegmaCard :at="0" :order="3" class="card-how">
            <DashCard :title="t('topic2.how.title')" :info="t('topic2.how.info')">
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
            </DashCard>
          </PlegmaCard>
        </div>
      </div>
    </div>

    <div class="orbit-col orbit-under">
      <PlegmaCard :at="4" :order="2" class="card-days">
        <DashCard :title="t('topic2.time.title')" :info="t('topic2.time.info')">
          <LinesChart v-if="timeLines" :dates="timeLines.dates" :series="timeLines.series" plain sparse sqrt :opacity="0.9" :tall="tall" :caption="t('topic2.time.title')" :href-of="s => lineHref(s.key)" />
        </DashCard>
      </PlegmaCard>
    </div>
  </div>
  <p v-if="problem" class="proto-note">{{ t('proto.states') }}</p>
</template>
