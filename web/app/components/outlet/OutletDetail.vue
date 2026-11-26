<script setup lang="ts">
import { useWindowSize } from '@vueuse/core'
import type { MmeData } from '~/types/mme'
import type { StoriesData } from '~/types/stories'
import type { StoryDetailData } from '~/types/story-detail'
import type { Series } from '~/types/topics'
import type { GroupsData, MediaDaily } from '~/utils/groups'
import { PERSON_KEYS, personHref } from '~/utils/people'
import { themeSlots } from '~/utils/plegma/plegma-world'
import { arriveOutletTravel, offerOutletTravel, withdrawOutletTravel } from '~/utils/plegma/outlet-travel'
import type { PeerTravel, TravelPoint } from '~/utils/plegma/outlet-travel'
import type { PlegmaDayTheme } from '~/utils/plegma/plegma-day'
import type { DayOutlet, DayRing } from '~/components/plegma/PlegmaDayWeb.vue'

// The outlet on the Plegma: the title card with the facts of the outlet and the tabs, under it the web first (the outlet at the center, its largest stories around it in the color of
// their theme, and for each story the days the outlet wrote it: the stage draws it), then the cards of the tab, and in the last column the latest list of the tab (articles, topics or
// stories; Πρόσωπα has none). Επισκόπηση and Πρόσωπα have a chart under the web and the cards.
// The outlets of ΜΜΕ & πρόσωπα (the Greek set) also have the profile cards of outlet-v2.html; the others have the cards of the groups file.
interface OutletSample { name: string, slug: string, headlines: { title: string, url: string }[] }
interface HomeOutlets { outlets: { name: string, daily: number[] }[], issues: StoriesData['issues'], issueDaily: (number | null)[][] }
const props = defineProps<{ slug: string }>()
const { t } = useI18n()
const plegma = usePlegmaStore()
const media = useFixtureLazy<MediaDaily>('media', { required: ['dates', 'outlets', 'outletDaily', 'issues'], isEmpty: b => b.outlets.length === 0 })
const home = useFixtureLazy<HomeOutlets>('home', { required: ['outlets', 'issues', 'issueDaily'], isEmpty: b => b.outlets.length === 0 })
const list = useFixtureLazy<StoriesData>('stories', { required: ['issues', 'stories'], isEmpty: b => b.stories.length === 0 })
const detail = useFixtureLazy<StoryDetailData>('storyDetail', { required: ['outlets', 'stories'], isEmpty: b => b.stories.length === 0 })
const groupsData = useFixtureLazy<GroupsData>('groups', { required: ['groups'], isEmpty: b => b.groups.length === 0 })
// The profile cards and the sample headlines are extras: the page is drawn without them when they fail, as the static page.
const mme = useFixtureLazy<MmeData>('mme', { required: ['sets'], isEmpty: b => Object.keys(b.sets).length === 0 })
const sample = useFixtureLazy<OutletSample>('outlet', { required: ['rows'] })
const fixtures = [media, home, list, detail, groupsData]
const loading = computed(() => [...fixtures, mme, sample].some(f => f.status.value === 'loading'))
const problem = computed(() => fixtures.map(f => f.status.value).find(s => s !== 'ready'))
const retry = () => fixtures.forEach(f => f.refresh())

const colorOfGroup = computed(() => groupColors(groupsData.data.value?.groups ?? []))
const groupColor = (g: string | null) => (g && colorOfGroup.value.get(g)) || NO_GROUP
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0)

// null when the slug is not one of the outlets (the 404 page).
const model = computed(() => {
  const m = media.data.value
  const l = list.data.value
  const dd = detail.data.value
  const g = groupsData.data.value
  const h = home.data.value
  if (!m || !l || !dd || !g || !h || problem.value) return null
  const k = m.outlets.findIndex(o => o.slug === props.slug)
  if (k < 0) return null
  const outlet = m.outlets[k]!
  const kd = dd.outlets.findIndex(o => o.slug === props.slug)
  const last = m.dates.length - 1
  // Collected articles per day.
  const collected = h.outlets.find(o => o.name === outlet.name)!.daily
  const stories = outletStories(l, dd, kd, last)
  const group = outlet.group
  const record = group ? g.groups.find(x => x.name === group) ?? null : null
  const writes = outletWrites(g, m, k, props.slug)
  const topics = stories.topicShares.map(r => ({ ...r, label: topicName(r.issue) }))
  return {
    m, l, dd, g, k, kd, last, outlet, group, record, collected, collectedTotal: sum(collected), writes, topics,
    ...stories
  }
})

// The profile of ΜΜΕ & πρόσωπα, for an outlet of its Greek set. The sums are for its whole window.
const mset = computed(() => mme.data.value?.sets.gr ?? null)
const mk = computed(() => mset.value?.outlets.findIndex(o => o.slug === props.slug) ?? -1)
const P = computed(() => (mset.value && mk.value >= 0 ? mmeProfile(mset.value) : null))
const live = computed(() => (P.value ? { set: mset.value!, P: P.value, k: mk.value } : null))
const liveHeadlines = computed(() => (live.value ? headlinesOf(live.value.set, mk.value) : []))
const sampleHeadlines = computed(() => (sample.data.value?.slug === props.slug ? sample.data.value.headlines : []))


// The cards of the tab in up to two columns, the latest list in the last column and the chart under them (null: none). The cards of the profile are for the outlets of ΜΜΕ & πρόσωπα only (live).
// The card under the web is the outlet over time and turns with the tab: the articles per day as bars (Επισκόπηση), the lines of its topics (Θέματα), the lines of its stories (Ιστορίες), the
// mentions of each person (Πρόσωπα). Επισκόπηση: the stance towards the government, the similarity with the other outlets of its group, the latest articles. Θέματα: the stance by topic, the latest topics.
// Ιστορίες: the big stories it did not run and the ones it pushes, its latest stories. Πρόσωπα: the people it mentions and how it portrays them.
// An outlet without the profile has no Πρόσωπα, and in Θέματα and Ιστορίες only what the stories file can give.
type CardId = 'stance' | 'similar' | 'stanceTopic' | 'portrayal' | 'skip' | 'push' | 'voices'
type TabId = 'overview' | 'topics' | 'stories' | 'people'
type LatestId = 'articles' | 'topics' | 'stories'
interface TabSpec { columns: CardId[][], latest: LatestId | null, under: 'bars' | 'topics' | 'stories' | 'mentions' }
const SPECS: Record<TabId, { live: TabSpec, plain: TabSpec }> = {
  overview: analysedShown
    ? { live: { columns: [['stance', 'similar']], latest: 'articles', under: 'bars' }, plain: { columns: [['stance', 'similar']], latest: 'articles', under: 'bars' } }
    // Without the Aug–Sep set only the similarity is of the window; the latest articles are a sample of Aug–Sep.
    : { live: { columns: [['similar']], latest: null, under: 'bars' }, plain: { columns: [['similar']], latest: null, under: 'bars' } },
  topics: { live: { columns: [['stanceTopic']], latest: 'topics', under: 'topics' }, plain: { columns: [], latest: 'topics', under: 'topics' } },
  stories: { live: { columns: [['skip'], ['push']], latest: 'stories', under: 'stories' }, plain: { columns: [], latest: 'stories', under: 'stories' } },
  people: { live: { columns: [['voices'], ['portrayal']], latest: null, under: 'mentions' }, plain: { columns: [], latest: null, under: 'bars' } }
}
const tab = ref<TabId>('overview')
const spec = computed(() => SPECS[tab.value][live.value ? 'live' : 'plain'])
const tabs = computed(() => (['overview', ...(topicsShown ? ['topics'] : []), 'stories'] as TabId[]).map(value => ({ value, label: t(`mme.o.tab.${value}`) })))

// A slug that is not an outlet has the name of the section, as the static page.
const named = computed(() => (model.value ? model.value.outlet.name : !loading.value && !problem.value ? t('nav.media') : null))
provideDetailTitle(() => named.value)
useHead({ title: () => (named.value ? `${named.value} · ${t('site.name')}` : undefined) })

// The period of the page: the days with articles of the outlet (the picker has no other days, and «all», the default, is from its first to its last), or the period that was picked. Everything that is
// told by day (the web, the latest lists and the charts) follows it; the cards of the profile are for the whole window of ΜΜΕ & πρόσωπα.
const spanDays = computed(() => {
  const c = model.value?.collected ?? []
  return { a: Math.max(0, c.findIndex(v => v > 0)), b: Math.max(0, c.reduce((at, v, i) => (v > 0 ? i : at), -1)) }
})
const allDates = computed(() => (model.value ? model.value.m.dates.slice(spanDays.value.a, spanDays.value.b + 1) : []))
const picked = ref<{ from: string, to: string } | null>(null)
watch(() => props.slug, () => { picked.value = null })
const view = computed(() => {
  const d = allDates.value
  const p = picked.value
  const ok = p && d.includes(p.from) && d.includes(p.to)
  return { from: ok ? p.from : d[0] ?? '', to: ok ? p.to : d[d.length - 1] ?? '' }
})
const i0 = computed(() => Math.max(0, model.value?.m.dates.indexOf(view.value.from) ?? 0))
const i1 = computed(() => Math.max(i0.value, model.value?.m.dates.indexOf(view.value.to) ?? 0))
const inPeriod = (days: number[]) => sum(days.slice(i0.value, i1.value + 1))
// The other outlets of its group with the similarity (the stories they share over the stories of either), for the whole window.
const hoverPeer = ref<string | null>(null)
// The move to another outlet of the group goes along the line to its row (utils/plegma/outlet-travel.ts): this page offers the line while the web of Επισκόπηση is shown, and its own web arrives along
// the line when the move came here.
const peerLinks = ref<{ lineOf: (i: number) => { c: TravelPoint, q: TravelPoint, e: TravelPoint } | null }>()
const mapWeb = ref<HTMLElement>()
const offerLine = (slug: string): PeerTravel | null => {
  const i = groupSimilar.value.findIndex(r => r.slug === slug)
  const line = i >= 0 && tab.value === 'overview' ? peerLinks.value?.lineOf(i) : null
  const canvas = mapWeb.value?.querySelector<HTMLCanvasElement>('.outlet-article-web canvas')
  return line && canvas && model.value ? { ...line, canvas, color: groupColor(model.value.group) } : null
}
onMounted(() => offerOutletTravel(offerLine))
onBeforeUnmount(() => withdrawOutletTravel(offerLine))
const stopArrive = watch(mapWeb, (el) => { if (!el) return; arriveOutletTravel(props.slug, el); stopArrive() })
// When the card of the similarity arrives (its order in its column, as the template gives it): the lines to its rows come in with it.
const similarOrder = computed(() => { for (const ids of spec.value.columns) { const r = ids.indexOf('similar'); if (r >= 0) return r + 1 } return 0 })
const orbit = ref<HTMLElement>()
const groupSimilar = computed(() => (model.value ? relatedOutlets(model.value.dd, model.value.kd, props.slug, model.value.group, model.value.record).related.filter(r => r.same) : []))
const startedHere = computed(() => (model.value ? model.value.mine.filter(r => r.story && r.first >= i0.value && r.first <= i1.value) : []))
const latestStories = computed(() => (model.value ? latestStoriesOf(model.value.mine, i0.value, i1.value) : []))
const latestRows = computed(() => latestStories.value.map(r => ({ id: r.story!.id, name: storyName(r.story!), value: fmtInt(r.n), issue: r.story!.issue, theme: topicName(model.value!.l.issues[r.story!.issue]!) })))

// The stage is only the dim world behind the page. The web of each tab is drawn in the map cell, as the pages of Μέσα do: Επισκόπηση the articles of the outlet with the ring of its stance, Θέματα and
// Ιστορίες the web of Μέσα › Θέματα and Μέσα › Ιστορίες (PlegmaDayWeb) with the stories of this outlet, Πρόσωπα the people it quotes.
const slots = computed(() => (home.data.value ? themeSlots(home.data.value) : new Map<number, number>()))
onMounted(() => plegma.setHomeDim(true))
onBeforeUnmount(() => { plegma.setHomeDim(false); plegma.setHoverStory(null) })
const groupSlot = computed(() => (model.value ? slotOfColor(groupColor(model.value.group)) : 0))
const themeOptions = computed(() => ({
  groupSlot: groupSlot.value, slotOf: (issue: number) => slots.value.get(issue) ?? 0, nameOf: (issue: number) => topicName(model.value!.l.issues[issue]!), storyName
}))
const periodArticles = computed(() => (model.value ? inPeriod(model.value.collected) : 0))
const webThemes = computed(() => (model.value ? outletThemes(model.value.mine, model.value.l.issues, i0.value, i1.value, { ...themeOptions.value, maxThemes: 8, perTheme: 3, skipCatchAll: true }) : []))
const themeRing = computed<DayRing[]>(() => webThemes.value.map(th => ({ issue: th.issue, name: th.name, slot: th.slot, n: th.n })))
const webStoryThemes = computed(() => (model.value ? outletThemes(model.value.mine, model.value.l.issues, i0.value, i1.value, { ...themeOptions.value, maxThemes: 8, maxStories: 14 }) : []))
// The ring of the web of the stories: an arc for each theme of the stories shown (the stories are the outlet's own, so the ring is not the outlets).
const storyRing = computed<DayOutlet[]>(() => webStoryThemes.value.map(th => ({ name: th.name, slot: th.slot, n: th.n, group: null })))
// The people the outlet quotes in the period: the days of the set of ΜΜΕ & πρόσωπα are its own (mmeRange).
const mmeRange = computed(() => {
  const l = live.value
  if (!l) return null
  const lo = l.set.dates.findIndex(d => d >= view.value.from)
  const hi = l.set.dates.reduce((at, d, i) => (d <= view.value.to ? i : at), -1)
  return lo >= 0 && hi >= lo ? { lo, hi } : null
})
const personRows = computed(() => {
  const l = live.value
  const r = mmeRange.value
  if (!l || !r) return []
  return mentionsOf(l.set, l.k).map(x => ({ ...x, n: sum(x.values.slice(r.lo, r.hi + 1)) })).filter(x => x.n > 0).sort((a, b) => b.n - a.n)
})
const personThemes = computed<PlegmaDayTheme[]>(() => {
  const most = Math.max(1, ...personRows.value.map(r => r.n))
  return personRows.value.map((r, i) => ({ issue: r.j, name: r.p.name, slot: i < 8 ? i + 1 : 0, n: r.n, stories: [], rest: Math.max(1, Math.round(14 * Math.sqrt(r.n / most))) }))
})
const personRing = computed<DayRing[]>(() => personThemes.value.map(th => ({ issue: th.issue, name: th.name, slot: th.slot, n: th.n })))
const openPerson = (j: number) => {
  const key = PERSON_KEYS[personRows.value.find(r => r.j === j)?.p.name ?? '']
  if (key) navigateTo(personHref(key))
}
const mapNote = computed(() => {
  if (tab.value === 'overview') {
    const n = Math.ceil(periodArticles.value / Math.max(1, Math.min(periodArticles.value, 250)))
    const key = analysedShown ? 'overview' : 'overviewBare'
    return n > 1 ? t(`outlet.web.note.${key}`, { n: fmtInt(n) }) : t(`outlet.web.note.${key}1`)
  }
  return t(`outlet.web.note.${tab.value}`)
})

// The outlet over time: its articles each day as bars, its largest topics or stories as lines (OutletTimeLines), and the quotes of each person each day (Πρόσωπα).
const { height: windowHeight } = useWindowSize()
const tall = computed(() => Math.round(Math.min(300, Math.max(110, windowHeight.value * 0.2))))
const bars = computed(() => {
  const m = model.value
  if (!m) return null
  return { dates: m.m.dates.slice(i0.value, i1.value + 1), series: [{ name: m.outlet.name, color: m.group ? groupColor(m.group) : 'var(--ink)', values: m.collected.slice(i0.value, i1.value + 1) as (number | null)[] }] }
})
const barTip = (i: number) => t('story.daily.tip', { date: fmtDate(bars.value!.dates[i]!), n: fmtInt(bars.value!.series[0]!.values[i] ?? 0) })
const latestTopicRows = computed(() => (model.value ? latestTopics(model.value.topicDays, model.value.l.issues, i0.value, i1.value) : []))
// The quotes of each person in the period (the set of ΜΜΕ & πρόσωπα has its own days), from the first day with a quote to the last.
const mentions = computed(() => {
  const l = live.value
  const r = mmeRange.value
  if (!l || !r) return { dates: [] as string[], series: [] as Series[] }
  const rows = personRows.value.map(x => ({ ...x, values: x.values.slice(r.lo, r.hi + 1) })).slice(0, OUTLET_LINES)
  const span = dataSpan(rows)
  if (!span) return { dates: [] as string[], series: [] as Series[] }
  return {
    dates: l.set.dates.slice(r.lo, r.hi + 1).slice(span[0], span[1] + 1),
    series: rows.map((x, i) => ({ key: PERSON_KEYS[x.p.name] ?? String(x.j), name: x.p.name, color: `var(--cat-${i + 1})`, values: x.values.slice(span[0], span[1] + 1) })) as Series[]
  }
})
const headlinesShown = computed(() => liveHeadlines.value.filter(x => String(x[0]) >= view.value.from && String(x[0]) <= view.value.to))
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
  <div v-else ref="orbit" class="plegma-orbit is-outlet" :class="[`tab-${tab}`, `cols-${spec.columns.length}`, spec.latest ? 'has-latest' : 'no-latest', { 'is-in': plegma.landed, 'is-leaving': plegma.leaving }]">
    <OutletPeerLinks
      v-if="tab === 'overview'" ref="peerLinks" :root="orbit" :count="groupSimilar.length" :hover="groupSimilar.findIndex(r => r.slug === hoverPeer)" :color="groupColor(model.group)" :order="similarOrder"
      @hover="i => (hoverPeer = i === null ? null : groupSimilar[i]?.slug ?? null)" @open="i => navigateTo(outletHref(groupSimilar[i]!.slug))"
    />
    <div class="plegma-title entity-grid">
      <EntityTitle :kind="t('hero.kind.outlet')" :title="model.outlet.name">
        <template #meta>{{ t('entity.fact.group') }}: <EntityLink v-if="model.group && model.record?.slug" type="group" :to="groupPageHref(model.record.slug)">{{ model.group }}</EntityLink><template v-else>{{ model.group ?? t('story.nogroup') }}</template></template>
      </EntityTitle>
    </div>
    <SegmentedControl v-model="tab" class="orbit-ring-tabs" :label="t('mme.o.tab.label')" :options="tabs" />
    <div v-if="allDates.length" class="outlet-period"><DateRange plain :dates="allDates" :from="view.from" :to="view.to" @change="r => (picked = r)" /></div>

    <div class="orbit-map">
      <ClientOnly><div ref="mapWeb" class="outlet-map-web">
        <OutletArticleWeb v-if="tab === 'overview'" key="overview" :days="bars?.series[0]?.values.map(v => v ?? 0) ?? []" :color-slot="groupSlot" :stance="analysedShown ? model.writes.stanceMine : []" :label="t('outlet.web.label')" :name="model.outlet.name" :leaving="plegma.leaving" />
        <PlegmaDayWeb
          :ring-start="0.5"
          v-else-if="tab === 'topics'" key="topics" :themes="webThemes" :ring="themeRing" :outlets="[]" mode="themes" :date="fmtInt(periodArticles)" :sub="model.outlet.name" :lit="null" :picked="null" active
          :labels="8" grow shares :zoom="1.12" :leaving="plegma.leaving" :label="t('outlet.web.label')" @pick="id => navigateTo(storyHref(id))" @pick-theme="k => navigateTo(topicHref(k))"
        />
        <PlegmaDayWeb
          :ring-start="0.5"
          v-else-if="tab === 'stories'" key="stories" :themes="webStoryThemes" :ring="[]" :outlets="storyRing" mode="stories" :date="fmtInt(periodArticles)" :sub="model.outlet.name" :lit="null" :picked="null" active
          :hover-story="plegma.hoverStory" ellipse :grouped="topicsShown" spread fill titles grow :zoom="0.82" :leaving="plegma.leaving" :label="t('outlet.web.label')" @pick="id => navigateTo(storyHref(id))" @pick-theme="k => navigateTo(topicHref(k))"
        />
        <PlegmaDayWeb
          :ring-start="0.5"
          v-else key="people" :themes="personThemes" :ring="personRing" :outlets="[]" mode="themes" :date="model.outlet.name" :sub="t('outlet.web.quotesN', { n: fmtInt(personRows.reduce((a, r) => a + r.n, 0)) })" :lit="null" :picked="null" active
          :labels="8" grow spread shares :zoom="1.12" :leaving="plegma.leaving" :label="t('outlet.web.label')" @pick-theme="openPerson"
        />
      </div></ClientOnly>
      <p class="plegma-nodes-note">{{ mapNote }}</p>
    </div>

    <div class="orbit-col orbit-right">
      <div class="orbit-subs">
        <div v-for="(ids, c) in spec.columns" :key="`${tab}-${c}`" class="orbit-sub">
          <PlegmaCard v-for="(id, r) in ids" :key="`${tab}-${id}`" :at="0" :order="r + 1" :class="`card-${id}`">
            <StanceCard
              v-if="id === 'stance'" class="c-12"
              :rows="[{ label: t('entity.stance.outlet'), color: groupColor(model.group), counts: model.writes.stanceMine }, { label: t('entity.stance.all'), color: NO_GROUP, counts: model.writes.stanceAll }]"
              :foot="model.writes.stanceN >= 30 ? t('outlet2.how.stance.n', { n: fmtInt(model.writes.stanceN) }) : null"
            />
            <OutletGroupSimilarity v-else-if="id === 'similar'" :rows="groupSimilar" :color="groupColor(model.group)" :group="model.group" @hover="hoverPeer = $event" />
            <OutletStanceByTopic v-else-if="id === 'stanceTopic'" :P="live!.P" :k="live!.k" :limit="OUTLET_STANCE_LIMIT" />
            <OutletPortrayal v-else-if="id === 'portrayal'" :P="live!.P" :k="live!.k" />
            <OutletCoverage v-else-if="id === 'skip' || id === 'push'" :P="live!.P" :k="live!.k" :part="id" />
            <OutletVoices v-else-if="id === 'voices'" :P="live!.P" :k="live!.k" :title="t('mme.o.people.title')" />
          </PlegmaCard>
        </div>
      </div>

      <PlegmaCard v-if="spec.latest" :key="`${tab}-latest`" :at="3" :order="2" class="card-latest">
        <OutletTopicsLatest v-if="spec.latest === 'topics'" :rows="latestTopicRows" :issues="model.l.issues" :dates="model.m.dates" />
        <DashCard v-else-if="spec.latest === 'stories'" :title="t('outlet2.stories.title')" :info="`${t('outlet2.stories.first', { n: fmtInt(startedHere.filter(r => r.first === r.storyStart).length), total: fmtInt(startedHere.length) })}. ${t('outlet2.stories.info')}`">
          <div v-if="latestStories.length" class="latest-scroll">
            <StoryRows :rows="latestRows" @hover="plegma.setHoverStory($event)" />
          </div>
          <p v-else class="dcard-empty">{{ t('outlet2.stories.empty') }}</p>
        </DashCard>
        <DashCard v-else class="outlet-latest" :title="t('outlet2.latest.title')" :info="liveHeadlines.length ? t('mme.o.headlines.info') : t('outlet2.headlines.info')">
          <div v-if="liveHeadlines.length" class="latest-scroll">
            <ul class="plain-list">
              <li v-for="(x, i) in headlinesShown" :key="i" class="mme-headline">
                <a v-if="safeUrl(x[2])" :href="safeUrl(x[2])!" rel="noopener" target="_blank">{{ x[1] }}</a><span v-else>{{ x[1] }}</span>
                <span class="muted-text">{{ [fmtDay(x[0]), x[4] >= 0 ? t(`frame.${live!.set.frames[x[4]]}`) : null, x[5] || null].filter(Boolean).join(' · ') }}</span>
                <span v-if="x[3]" class="mme-angle">{{ x[3] }}</span>
              </li>
            </ul>
          </div>
          <div v-else-if="sampleHeadlines.length" class="latest-scroll">
            <ul class="plain-list">
              <li v-for="(x, i) in sampleHeadlines" :key="i"><a v-if="safeUrl(x.url)" :href="safeUrl(x.url)!" rel="noopener" target="_blank">{{ x.title }}</a><template v-else>{{ x.title }}</template></li>
            </ul>
          </div>
          <p v-else class="dcard-empty">{{ t('outlet2.headlines.empty') }}</p>
        </DashCard>
      </PlegmaCard>
    </div>

    <div class="orbit-col orbit-under">
      <PlegmaCard :key="`${tab}-under`" :at="4" :order="2" class="card-days">
        <DashCard v-if="spec.under === 'bars'" :title="t('outlet2.time.title')" :info="t('outlet2.time.info')">
          <DayBars v-if="bars" :dates="bars.dates" :series="bars.series" :height="tall" :caption="t('outlet2.time.title')" :tip-of="barTip" :selectable="false" />
        </DashCard>
        <OutletTimeLines v-else-if="spec.under === 'topics' || spec.under === 'stories'" :dates="model.m.dates" :i0="i0" :i1="i1" :topic-days="model.topicDays" :mine="model.mine" :issues="model.l.issues" :mode="spec.under" />
        <DashCard v-else :title="t('outlet2.mentions.title')" :info="t('outlet2.mentions.info')">
          <LinesChart v-if="mentions.series.length" :key="`${i0}-${i1}`" :dates="mentions.dates" :series="mentions.series" :tall="tall" :caption="t('outlet2.mentions.title')" :href-of="s => personHref(s.key)" />
          <p v-else class="dcard-empty">{{ t('media2.empty.list') }}</p>
        </DashCard>
      </PlegmaCard>
    </div>
  </div>
  <p v-if="problem && problem !== 'loading'" class="proto-note">{{ t('proto.states') }}</p>
</template>
