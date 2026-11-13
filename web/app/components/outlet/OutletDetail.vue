<script setup lang="ts">
import { useWindowSize } from '@vueuse/core'
import type { MmeData } from '~/types/mme'
import type { StoriesData } from '~/types/stories'
import type { StoryDetailData } from '~/types/story-detail'
import type { GroupsData, MediaDaily } from '~/utils/groups'
import { PLEGMA_THEME_OUTLETS, PLEGMA_THEME_STORIES } from '~/utils/plegma/plegma-theme'
import { themeSlots } from '~/utils/plegma/plegma-world'

// The outlet on the Plegma: the title card with the facts of the outlet, the web in the free cell (the outlet at the center, its largest stories around it in the color of their theme,
// and for each story the days the outlet wrote it: the stage draws it), the cards of the old four tabs in two columns, and the articles of the outlet over time under them.
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

// The cards of the old four tabs, now all on the page: the stories and the headlines beside the web, then how it writes. The cards of the profile
// are for the outlets of ΜΜΕ & πρόσωπα only.
type CardId = 'latest' | 'weekly' | 'emphasis' | 'stories' | 'coverage' | 'stance' | 'how' | 'stanceTopic' | 'portrayal' | 'voices'
const COLUMNS: CardId[][] = [['stories', 'latest', 'coverage'], ['stance', 'how', 'emphasis', 'weekly', 'stanceTopic', 'portrayal', 'voices']]
const LIVE_ONLY: CardId[] = ['weekly', 'coverage', 'stanceTopic', 'portrayal', 'voices']
const columns = computed(() => COLUMNS.map(ids => ids.filter(id => live.value || !LIVE_ONLY.includes(id))))

// A slug that is not an outlet has the name of the section, as the static page.
const named = computed(() => (model.value ? model.value.outlet.name : !loading.value && !problem.value ? t('nav.media') : null))
provideDetailTitle(() => named.value)
useHead({ title: () => (named.value ? `${named.value} · ${t('site.name')}` : undefined) })

// The web: the largest stories of the outlet, each with the days the outlet wrote it (the stage reads them from the store).
const slots = computed(() => (home.data.value ? themeSlots(home.data.value) : new Map<number, number>()))
const webStories = computed(() => {
  const m = model.value
  if (!m) return null
  return m.mine.filter(r => r.story).slice(0, PLEGMA_THEME_STORIES).map((r) => {
    const story = r.story!
    const slot = slots.value.get(story.issue) ?? 0
    const days = r.days.map((n, d) => ({ d, n })).filter(x => x.n > 0).sort((a, b) => b.n - a.n).slice(0, PLEGMA_THEME_OUTLETS)
    return { id: story.id, name: storyName(story), n: r.n, media: r.reach, slot, theme: topicName(m.l.issues[story.issue]!), outlets: days.map(x => ({ name: fmtDay(m.m.dates[x.d]!), group: null, slot, n: x.n })) }
  })
})
watch(webStories, list => plegma.setThemeStories(list?.length ? list : null), { immediate: true })
watch(() => (model.value ? slotOfColor(groupColor(model.value.group)) : 0), slot => plegma.setOutletSlot(slot), { immediate: true })
onBeforeUnmount(() => { plegma.setThemeStories(null); plegma.setOutletSlot(0); plegma.setHoverStory(null) })

// The map region is the free cell of the first column, under the title (composables/usePlegmaRegion.ts).
const orbit = ref<HTMLElement>()
const map = ref<HTMLElement>()
usePlegmaRegion(orbit, map)

// The outlet over time: its articles each day, and under it a line for each story the web shows. The axis is the square root, so the stories are not flat next to the outlet.
const { height: windowHeight } = useWindowSize()
const tall = computed(() => Math.round(Math.min(300, Math.max(110, windowHeight.value * 0.12))))
const timeLines = computed(() => {
  const m = model.value
  const stories = webStories.value
  if (!m || !stories) return null
  const to = m.last + 1
  const outlet = { key: 'outlet', name: m.outlet.name, color: m.group ? groupColor(m.group) : 'var(--ink)', values: m.collected.slice(0, to) }
  const rows = m.mine.filter(r => r.story).slice(0, PLEGMA_THEME_STORIES).map((r, i) => ({ key: `s${r.story!.id}`, name: stories[i]!.name, color: stories[i]!.slot ? `var(--cat-${stories[i]!.slot})` : NO_GROUP, values: r.days.slice(0, to) }))
  return { dates: m.m.dates.slice(0, to), series: [outlet, ...rows] }
})
const lineHref = (key: string) => (key === 'outlet' ? outletHref(props.slug) : storyHref(Number(key.slice(1))))
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
  <div v-else ref="orbit" class="plegma-orbit is-outlet" :class="{ 'is-in': plegma.landed }">
    <div class="plegma-title entity-grid">
      <EntityTitle :kind="t('hero.kind.outlet')" :title="model.outlet.name">
        <template #meta>{{ `${fmtDay(model.m.dates[model.start]!)} → ${fmtDate(model.m.dates[model.end]!)} · ${t('entity.fact.days', { n: model.end - model.start + 1 })}` }}</template>
        <EntityFact :label="t('entity.fact.group')" :value="model.group ?? t('story.nogroup')" :sub="model.outlet.owner ? `${t('entity.fact.owner')}: ${model.outlet.owner}` : ''" />
        <EntityFact :label="t('entity.fact.articles')" :value="fmtInt(model.collectedTotal)" />
        <EntityFact :label="t('entity.fact.stories')" :value="fmtInt(model.mine.length)" />
        <EntityFact v-for="f in facts" :key="f.label" :label="f.label" :value="f.value" :sub="f.sub" />
      </EntityTitle>
    </div>

    <div ref="map" class="orbit-map">
      <p class="plegma-nodes-note">{{ t('outlet.map.note') }}</p>
    </div>

    <div class="orbit-col orbit-right">
      <div class="orbit-subs">
        <div v-for="(ids, c) in columns" :key="c" class="orbit-sub">
          <PlegmaCard v-for="(id, r) in ids" :key="id" :at="c === 0 ? 2 : 0" :order="r + 1" :class="`card-${id}`">
            <DashCard v-if="id === 'latest'" class="c-6 outlet-latest" :title="t('outlet2.latest.title')" :info="liveHeadlines.length ? t('mme.o.headlines.info') : t('outlet2.headlines.info')">
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
          </PlegmaCard>
        </div>
      </div>
    </div>

    <div class="orbit-col orbit-under">
      <PlegmaCard :at="4" :order="2" class="card-days">
        <DashCard :title="t('outlet2.time.title')" :info="t('outlet2.time.info')">
          <LinesChart v-if="timeLines" :dates="timeLines.dates" :series="timeLines.series" plain sparse sqrt :opacity="0.9" :tall="tall" :caption="t('outlet2.time.title')" :href-of="s => lineHref(s.key)" />
        </DashCard>
      </PlegmaCard>
    </div>
  </div>
  <p v-if="problem && problem !== 'loading'" class="proto-note">{{ t('proto.states') }}</p>
</template>
