<script setup lang="ts">
import type { MmeData } from '~/types/mme'
import type { StoriesData } from '~/types/stories'
import type { StoryDetailData } from '~/types/story-detail'
import type { GroupsData, MediaDaily } from '~/utils/groups'

// The body of the outlet page (outlet-v2.html): the card of the outlet and its daily articles, then the cards of one of four tabs.
// The outlets of ΜΜΕ & πρόσωπα (the Greek set) also have the profile cards of that page; the others have the cards of the groups file.
interface OutletSample { name: string, slug: string, headlines: { title: string, url: string }[] }
interface HomeOutlets { outlets: { name: string, daily: number[] }[] }
const props = defineProps<{ slug: string }>()
const { t } = useI18n()
const route = useRoute()
const media = useFixtureLazy<MediaDaily>('media', { required: ['dates', 'outlets', 'outletDaily', 'issues'], isEmpty: b => b.outlets.length === 0 })
const home = useFixtureLazy<HomeOutlets>('home', { required: ['outlets'], isEmpty: b => b.outlets.length === 0 })
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
const diffKey = computed(() => [{ label: t('story.how.more'), color: 'var(--emph-more)' }, { label: t('story.how.less'), color: 'var(--emph-less)' }])
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
  // Collected articles per day. The first day with articles is the start of the collection.
  const collected = h.outlets.find(o => o.name === outlet.name)!.daily
  const start = collected.findIndex(v => v > 0)
  const end = collected.length - 1 - [...collected].reverse().findIndex(v => v > 0)
  const stories = outletStories(l, dd, kd, last)
  const group = outlet.group
  const record = group ? g.groups.find(x => x.name === group) ?? null : null
  const writes = outletWrites(g, m, k, props.slug)
  const rows = [writes.news && { key: 'news', label: t('outlet2.how.news'), ...writes.news }, writes.click && { key: 'click', label: t('outlet2.how.clickbait'), ...writes.click }].filter((r): r is NonNullable<typeof r> => !!r)
  const topics = stories.topicShares.map(r => ({ ...r, label: topicName(r.issue) }))
  return {
    m, l, dd, g, k, kd, last, outlet, group, record, collected, start, end, collectedTotal: sum(collected), writes, howRows: rows, howScale: diffScale(rows), topics,
    ...stories, ...relatedOutlets(dd, kd, props.slug, group, record)
  }
})
const groupSlugs = computed(() => new Map((groupsData.data.value?.groups ?? []).map(g => [g.name, g.slug])))

// The profile of ΜΜΕ & πρόσωπα, for an outlet of its Greek set. The sums are for its whole window.
const mset = computed(() => mme.data.value?.sets.gr ?? null)
const mk = computed(() => mset.value?.outlets.findIndex(o => o.slug === props.slug) ?? -1)
const P = computed(() => (mset.value && mk.value >= 0 ? mmeProfile(mset.value) : null))
const live = computed(() => (P.value ? { set: mset.value!, P: P.value, k: mk.value } : null))
const liveHeadlines = computed(() => (live.value ? headlinesOf(live.value.set, mk.value) : []))
const sampleHeadlines = computed(() => (sample.data.value?.slug === props.slug ? sample.data.value.headlines : []))


const facts = computed(() => {
  const mdl = model.value
  if (!mdl) return []
  const file = mdl.writes.file
  if (P.value) {
    const f = outletFacts(P.value, mk.value)
    const rank = (r: { rank: number, n: number } | null) => (r ? t('mme.o.rank', { rank: r.rank, n: r.n }) : '')
    return [
      { label: t('mme.o.news'), value: fmtPct0(f.news.share), sub: rank(f.news.rank) },
      { label: t('mme.o.clickbait'), value: f.clickbait.known ? fmtPct0(f.clickbait.share!) : '—', sub: f.clickbait.known ? (f.clickbait.rank ? rank(f.clickbait.rank) : t('mme.n', { n: fmtInt(f.clickbait.known) })) : t('mme.o.none') }
    ]
  }
  // An outlet that is not in ΜΜΕ & πρόσωπα gets the numbers of the groups file, with no rank.
  return [
    file && file.analysed ? { label: t('outlet2.how.news'), value: fmtPct(file.news / file.analysed), sub: '' } : null,
    file && file.cbKnown ? { label: t('outlet2.how.clickbait'), value: fmtPct(file.cbYes / file.cbKnown), sub: '' } : null
  ].filter((x): x is NonNullable<typeof x> => !!x)
})

// The tabs: each card has one tab. A tab is rows of one, two or three columns (spans of 12). The tabs with no cards are not shown
// (the live cards are for the outlets of ΜΜΕ & πρόσωπα only).
type CardId = 'related' | 'latest' | 'weekly' | 'emphasis' | 'stories' | 'coverage' | 'stance' | 'how' | 'stanceTopic' | 'portrayal' | 'voices'
const LAYOUTS: Record<string, [number, CardId[]][][]> = {
  overview: [[[6, ['related']], [6, ['latest']]]],
  topics: [[[12, ['weekly']]], [[12, ['emphasis']]]],
  stories: [[[7, ['stories']], [5, ['coverage']]]],
  people: [[[6, ['stance', 'how', 'stanceTopic']], [6, ['portrayal', 'voices']]]]
}
const LIVE_ONLY: CardId[] = ['weekly', 'coverage', 'stanceTopic', 'portrayal', 'voices']
// A row keeps its columns with cards. One column alone shares the 12 columns.
const columnsOf = (key: string) => LAYOUTS[key]!.map(row => row.map(([span, ids]) => [span, ids.filter(id => live.value || !LIVE_ONLY.includes(id))] as [number, CardId[]]).filter(([, ids]) => ids.length))
  .filter(row => row.length).map(row => (row.length === 1 ? [[12, row[0]![1]] as [number, CardId[]]] : row)).flat()
const tabKeys = computed(() => Object.keys(LAYOUTS).filter(key => columnsOf(key).length))
const tab = computed(() => (tabKeys.value.includes(String(route.query.tab)) ? String(route.query.tab) : 'overview'))
const columns = computed(() => columnsOf(tab.value))
const tabTo = (key: string) => ({ path: route.path, query: { ...route.query, slug: props.slug, tab: key === 'overview' ? undefined : key } })
watch(tab, () => window.scrollTo(0, 0))

// A slug that is not an outlet has the name of the section, as the static page.
const named = computed(() => (model.value ? model.value.outlet.name : !loading.value && !problem.value ? t('nav.media') : null))
provideDetailTitle(() => named.value)
useHead({ title: () => (named.value ? `${named.value} · ${t('site.name')}` : undefined) })

// Side by side, the daily chart takes the height that the four numbers leave, so the cards of the row end level.
const daily = ref<{ $el: HTMLElement } | null>(null)
const dailyHeight = ref<number | undefined>()
const fitDaily = () => requestAnimationFrame(() => requestAnimationFrame(() => {
  const card = daily.value?.$el
  if (!card?.isConnected || !window.matchMedia('(min-width: 1280px)').matches) return
  const body = card.lastElementChild!
  const slack = card.getBoundingClientRect().bottom - parseFloat(getComputedStyle(card).paddingBottom) - body.getBoundingClientRect().bottom
  if (slack > 4) dailyHeight.value = 220 + Math.floor(slack)
}))
watch(() => (!loading.value && model.value && tab.value === 'overview' ? props.slug : null), (shown) => {
  dailyHeight.value = undefined
  if (shown) fitDaily()
}, { immediate: true, flush: 'post' })
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
  <template v-else>
    <header class="page-head">
      <div class="page-head-row"><div class="page-head-titles"><h1 class="page-head-title">{{ model.outlet.name }}</h1></div></div>
      <div class="page-tabs">
        <nav class="section-tabs" :aria-label="model.outlet.name">
          <ul><li v-for="key in tabKeys" :key="key"><NuxtLink :to="tabTo(key)" :aria-current="key === tab ? 'page' : undefined">{{ t(`outlet2.tab.${key}`) }}</NuxtLink></li></ul>
        </nav>
      </div>
    </header>

    <div v-if="tab === 'overview'" class="dash-grid">
      <DashCard class="c-3 outlet-card" :title="model.outlet.name" :info="`${fmtDay(model.m.dates[model.start]!)} → ${fmtDate(model.m.dates[model.end]!)} · ${t('entity.fact.days', { n: model.end - model.start + 1 })}`">
        <div class="stats-2x2 outlet-stats">
          <DashStat class="is-wide" :label="t('entity.fact.group')" text :sub="model.outlet.owner ? `${t('entity.fact.owner')}: ${model.outlet.owner}` : ''">
            <template #value><EntityLink v-if="model.record" type="group" :to="groupPageHref(model.record.slug)">{{ model.group }}</EntityLink><template v-else>{{ t('story.nogroup') }}</template></template>
          </DashStat>
          <DashStat :label="t('entity.fact.articles')" :value="fmtInt(model.collectedTotal)" sub="">
            <template #viz><SparkLine :values="model.collected" :from="model.start" :to="model.end" :label="t('outlet2.daily.title')" :width="56" :height="16" /></template>
          </DashStat>
          <DashStat :label="t('entity.fact.stories')" :value="fmtInt(model.mine.length)" sub="" />
          <DashStat v-for="f in facts" :key="f.label" :label="f.label" :value="f.value" :sub="f.sub" />
        </div>
      </DashCard>
      <DailyCard ref="daily" class="c-9" :dates="model.m.dates" :daily="model.m.outletDaily[model.k] as [number | null, number | null][]" :topic-days="model.topicDays" :issues="model.l.issues" :info="t('outlet2.daily.info')" :topics="false" :height="dailyHeight" />
    </div>

    <div class="dash-grid story-grid entity-grid entity-rows">
      <div v-for="(col, c) in columns" :key="`${tab}-${c}`" :class="`card-col card-col-fill c-${col[0]} story-col`">
        <template v-for="id in col[1]" :key="id">
          <OutletRelated v-if="id === 'related'" :slices="model.slices" :unscored="model.unscored" :empty="model.related.length === 0" :color-of="groupColor" :group-slugs="groupSlugs" />
          <DashCard v-else-if="id === 'latest'" class="c-6 outlet-latest" :title="t('outlet2.latest.title')" :info="liveHeadlines.length ? t('mme.o.headlines.info') : t('outlet2.headlines.info')">
            <div v-if="liveHeadlines.length" class="latest-scroll">
              <ul class="plain-list">
                <li v-for="(x, i) in liveHeadlines" :key="i" class="mme-headline">
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
          <OutletWeekly v-else-if="id === 'weekly'" :set="live!.set" :k="live!.k" />
          <OutletEmphasis v-else-if="id === 'emphasis'" :P="live?.P ?? null" :k="mk" :topics="model.topics" :topic-n="model.mineTotal" />
          <DashCard
            v-else-if="id === 'stories'" class="c-7" :title="t('outlet2.stories.title')"
            :info="`${t('outlet2.stories.first', { n: fmtInt(model.firsts), total: fmtInt(model.mine.length) })}. ${t('outlet2.stories.info')}`"
          >
            <ul v-if="model.latest.length" class="rows-related latest-stories">
              <li v-for="r in model.latest" :key="r.story!.id">
                <span class="related-main"><span class="story-line" :title="`${storyName(r.story!)} / ${topicName(model.l.issues[r.story!.issue]!)}`"><EntityLink type="story" :to="storyHref(r.story!.id)">{{ storyName(r.story!) }}</EntityLink><span class="muted-text">{{ ` / ${topicName(model.l.issues[r.story!.issue]!)}` }}</span></span></span>
                <span class="row-value">{{ fmtDay(model.m.dates[r.first]!) }}</span>
                <span class="row-value">{{ t('outlet2.stories.reach', { n: fmtInt(r.reach) }) }}</span>
                <span class="row-value">{{ fmtInt(r.n) }}</span>
              </li>
            </ul>
            <p v-else class="dcard-empty">{{ t('outlet2.stories.empty') }}</p>
          </DashCard>
          <OutletCoverage v-else-if="id === 'coverage'" :P="live!.P" :k="live!.k" />
          <StanceCard
            v-else-if="id === 'stance'" class="c-12"
            :rows="[{ label: t('entity.stance.outlet'), color: groupColor(model.group), counts: model.writes.stanceMine }, { label: t('entity.stance.all'), color: NO_GROUP, counts: model.writes.stanceAll }]"
            :foot="model.writes.stanceN >= 30 ? t('outlet2.how.stance.n', { n: fmtInt(model.writes.stanceN) }) : null"
          />
          <DashCard v-else-if="id === 'how'" class="c-12" :title="t('outlet2.how.title')" :info="t('outlet2.how.info')">
            <template #tools><ChartLegend :items="diffKey" /></template>
            <div class="how-panel">
              <DiffList v-if="model.howRows.length" :rows="model.howRows" :scale="model.howScale" tip-key="outlet2.how.tip" />
              <p class="dcard-sub">{{ t('outlet2.how.news.n', { n: fmtInt(model.writes.file ? model.writes.file.analysed : 0) }) }}</p>
              <p class="dcard-sub">{{ model.writes.click && model.writes.file ? t('outlet2.how.clickbait.n', { baited: fmtInt(model.writes.file.cbYes), scored: fmtInt(model.writes.file.cbKnown) }) : t('outlet2.how.clickbait.none') }}</p>
            </div>
          </DashCard>
          <OutletStanceByTopic v-else-if="id === 'stanceTopic'" :P="live!.P" :k="live!.k" :limit="OUTLET_STANCE_LIMIT" />
          <OutletPortrayal v-else-if="id === 'portrayal'" :P="live!.P" :k="live!.k" />
          <OutletVoices v-else-if="id === 'voices'" :P="live!.P" :k="live!.k" />
        </template>
      </div>
    </div>
  </template>
  <p v-if="problem || model" class="proto-note">{{ t('proto.states') }}</p>
</template>
