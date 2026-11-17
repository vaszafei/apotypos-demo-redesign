<script setup lang="ts">
import { useWindowSize } from '@vueuse/core'
import type { MmeData } from '~/types/mme'
import type { StoriesData } from '~/types/stories'
import type { StoryDetailData } from '~/types/story-detail'
import type { GroupsData, MediaDaily } from '~/utils/groups'
import { PLEGMA_THEME_OUTLETS, PLEGMA_THEME_STORIES } from '~/utils/plegma/plegma-theme'
import { themeSlots } from '~/utils/plegma/plegma-world'

// The outlet on the Plegma, laid out as the story and the theme pages are: the title card with the facts of the outlet, its stories in a narrow column on the left, the web in the free
// cell (the outlet at the center, its largest stories around it in the color of their theme, and for each story the days the outlet wrote it: the stage draws it), the cards of the
// profile in two columns, and under them the stories of the outlet over time with its latest articles beside it.
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


// The cards of the profile in the two columns of the right. The cards of the profile are for the outlets of ΜΜΕ & πρόσωπα only.
// The tabs beside the title turn the cards of the columns: Στάση has the three cards of the stance (towards the government, by topic, towards people), Θέματα what the outlet stresses
// and how it covers the stories against the others, Πρόσωπα the people it mentions. An outlet without the profile has the stance card and what it stresses, and no tabs.
type CardId = 'stance' | 'stanceTopic' | 'portrayal' | 'emphasis' | 'coverage' | 'voices'
const COLUMNS: Record<'gov' | 'topics' | 'people', CardId[][]> = {
  gov: [['stance', 'stanceTopic'], ['portrayal']],
  topics: [['emphasis'], ['coverage']],
  people: [['voices'], []]
}
const tab = ref<'gov' | 'topics' | 'people'>('gov')
const columns = computed(() => (live.value ? COLUMNS[tab.value] : [['stance'], ['emphasis']] as CardId[][]))
const tabs = computed(() => (live.value ? [{ value: 'gov', label: t('mme.o.tab.gov') }, { value: 'topics', label: t('mme.o.tab.topics') }, { value: 'people', label: t('mme.o.tab.people') }] : []))

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

// The map region is the free cell between the stories and the cards, under the title, as on the story and theme pages (composables/usePlegmaRegion.ts): the biggest circle that touches no card.
const orbit = ref<HTMLElement>()
const map = ref<HTMLElement>()
usePlegmaRegion(orbit, map, { side: 440, top: -32, bottom: 28, lean: 0.62, clear: true, ringPerSide: 0.45 })

// The outlet over time: its articles each day, as bars.
const { height: windowHeight } = useWindowSize()
const tall = computed(() => Math.round(Math.min(300, Math.max(110, windowHeight.value * 0.2))))
const bars = computed(() => {
  const m = model.value
  if (!m) return null
  const to = m.last + 1
  return { dates: m.m.dates.slice(0, to), series: [{ name: m.outlet.name, color: m.group ? groupColor(m.group) : 'var(--ink)', values: m.collected.slice(0, to) as (number | null)[] }] }
})
const barTip = (i: number) => t('story.daily.tip', { date: fmtDate(bars.value!.dates[i]!), n: fmtInt(bars.value!.series[0]!.values[i] ?? 0) })
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
        <template #meta><EntityLink v-if="model.group && model.record?.slug" type="group" :to="groupPageHref(model.record.slug)">{{ model.group }}</EntityLink><template v-else>{{ model.group ?? t('story.nogroup') }}</template></template>
        <EntityFact :label="t('entity.fact.articles')" :value="fmtInt(model.collectedTotal)" />
        <EntityFact :label="t('entity.fact.stories')" :value="fmtInt(model.mine.length)" />
        <EntityFact v-if="model.outlet.owner" :label="t('entity.fact.owner')" :value="model.outlet.owner" />
      </EntityTitle>
      <SegmentedControl v-if="tabs.length" v-model="tab" class="orbit-ring-tabs" :label="t('mme.o.tab.label')" :options="tabs" />
    </div>

    <div class="orbit-col orbit-left">
      <PlegmaCard :at="2" :order="3" class="card-stories">
        <DashCard
          :title="t('outlet2.stories.title')"
          :info="`${t('outlet2.stories.first', { n: fmtInt(model.firsts), total: fmtInt(model.mine.length) })}. ${t('outlet2.stories.info')}`"
        >
          <ul v-if="model.latest.length" class="rows-related latest-stories">
            <li v-for="r in model.latest" :key="r.story!.id" @pointerenter="plegma.setHoverStory(r.story!.id)" @pointerleave="plegma.setHoverStory(null)" @focusin="plegma.setHoverStory(r.story!.id)" @focusout="plegma.setHoverStory(null)">
              <span class="related-main"><span class="story-line" :title="`${storyName(r.story!)} / ${topicName(model.l.issues[r.story!.issue]!)}`"><EntityLink type="story" :to="storyHref(r.story!.id)">{{ storyName(r.story!) }}</EntityLink><span class="muted-text">{{ ` / ${topicName(model.l.issues[r.story!.issue]!)}` }}</span></span></span>
              <span class="row-value">{{ fmtDay(model.m.dates[r.first]!) }}</span>
            </li>
          </ul>
          <p v-else class="dcard-empty">{{ t('outlet2.stories.empty') }}</p>
        </DashCard>
      </PlegmaCard>
    </div>

    <div ref="map" class="orbit-map">
      <p class="plegma-nodes-note">{{ t('outlet.map.note') }}</p>
    </div>

    <div class="orbit-col orbit-right">
      <div class="orbit-subs">
        <div v-for="(ids, c) in columns" :key="c" class="orbit-sub">
          <PlegmaCard v-for="(id, r) in ids" :key="`${tab}-${id}`" :at="0" :order="r + 1" :class="`card-${id}`">
            <StanceCard
              v-if="id === 'stance'" class="c-12"
              :rows="[{ label: t('entity.stance.outlet'), color: groupColor(model.group), counts: model.writes.stanceMine }, { label: t('entity.stance.all'), color: NO_GROUP, counts: model.writes.stanceAll }]"
              :foot="model.writes.stanceN >= 30 ? t('outlet2.how.stance.n', { n: fmtInt(model.writes.stanceN) }) : null"
            />
            <OutletStanceByTopic v-else-if="id === 'stanceTopic'" :P="live!.P" :k="live!.k" :limit="OUTLET_STANCE_LIMIT" />
            <OutletPortrayal v-else-if="id === 'portrayal'" :P="live!.P" :k="live!.k" />
            <OutletEmphasis v-else-if="id === 'emphasis'" :P="live?.P ?? null" :k="mk" :topics="model.topics" :topic-n="model.mineTotal" />
            <OutletCoverage v-else-if="id === 'coverage'" :P="live!.P" :k="live!.k" />
            <OutletVoices v-else-if="id === 'voices'" :P="live!.P" :k="live!.k" :title="t('mme.o.people.title')" />
          </PlegmaCard>
        </div>
      </div>
    </div>

    <div class="orbit-col orbit-under">
      <PlegmaCard :at="4" :order="2" class="card-days">
        <DashCard :title="t('outlet2.time.title')" :info="t('outlet2.time.info')">
          <DayBars v-if="bars" :dates="bars.dates" :series="bars.series" :height="tall" :caption="t('outlet2.time.title')" :tip-of="barTip" :selectable="false" />
        </DashCard>
      </PlegmaCard>
      <PlegmaCard :at="4" :order="3" class="card-latest">
        <DashCard class="outlet-latest" :title="t('outlet2.latest.title')" :info="liveHeadlines.length ? t('mme.o.headlines.info') : t('outlet2.headlines.info')">
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
      </PlegmaCard>
    </div>
  </div>
  <p v-if="problem && problem !== 'loading'" class="proto-note">{{ t('proto.states') }}</p>
</template>
