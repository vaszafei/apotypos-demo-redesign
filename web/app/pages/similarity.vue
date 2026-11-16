<script setup lang="ts">
import { useMounted } from '@vueuse/core'
import type { OriginalityData } from '~/types/originality'
import type { StoriesData } from '~/types/stories'
import type { StoryDetailData } from '~/types/story-detail'
import type { GroupsData } from '~/utils/groups'
import { embed, SIM_MAJOR, similarityOf } from '~/utils/similarity'

// Μέσα › Ομοιότητα (similarity-v2.html): a screen of the Plegma (components/MediaPlegma.vue) whose web is the outlets, close when they write the same stories (components/similarity/SimilarityNetwork.vue),
// and on its right a column of 10 : 2 with the big stories that each outlet did not write (and, with an outlet pointed in the web, which ones), and the originality of the 5 outlets that the API reads.
definePageMeta({ backdrop: true })
const { t } = useI18n()
useHead({ title: () => `${t('nav.media')} · ${t('site.name')}` })
const detail = useFixtureLazy<StoryDetailData>('storyDetail', { required: ['outlets', 'stories'], isEmpty: b => b.stories.length === 0 })
const list = useFixtureLazy<StoriesData>('stories', { required: ['dates', 'issues', 'stories'], isEmpty: b => b.stories.length === 0 })
const groups = await useFixture<GroupsData>('groups', { required: ['groups'] })
const orig = await useFixture<OriginalityData>('originality', { required: ['window', 'outlets'], isEmpty: b => b.outlets.length === 0 })
const problem = computed(() => [detail.status.value, list.status.value].find(s => s !== 'ready' && s !== 'loading'))
const retry = () => { detail.refresh(); list.refresh() }

const colors = computed(() => groupColors(groups.data.value?.groups ?? []))
const colorOf = (g: string | null) => (g ? colors.value.get(g) ?? NO_GROUP : NO_GROUP)
const lit = ref<number | null>(null)

// The similarity of the outlets is computed in the browser from the story rows (a few hundred ms), after the fixtures are in.
const mounted = useMounted()
const sim = computed(() => (mounted.value && detail.data.value ? similarityOf(detail.data.value) : null))
const pos = computed(() => (sim.value ? embed(sim.value.score, sim.value.outlets.map(o => o.articles)) : []))
const title = computed(() => {
  const s = list.data.value
  return (id: number) => { const story = s?.stories.find(x => x.id === id); return story ? storyName(story) : '' }
})
const byId = computed(() => new Map((list.data.value?.stories ?? []).map(s => [s.id, s])))

// The outlets by the share of the big stories that they did not write.
const ranking = computed(() => (sim.value
  ? sim.value.outlets.map((o, i) => ({ i, name: o.name, k: sim.value!.missed[i]!.stories.length, c: sim.value!.missed[i]!.considered })).filter(r => r.c > 0).map(r => ({ ...r, share: r.k / r.c })).sort((a, b) => b.share - a.share)
  : []))
const RANK_ROWS = 14
const pointed = computed(() => (lit.value !== null && sim.value ? { i: lit.value, name: sim.value.outlets[lit.value]!.name, ...sim.value.missed[lit.value]! } : null))
const skipped = computed(() => (pointed.value ? pointed.value.stories.slice(0, 9).map(m => ({ ...m, name: byId.value.get(m.story) ? storyName(byId.value.get(m.story)!) : '' })) : []))
const period = computed(() => (detail.data.value ? t('period.text', { from: fmtDate(detail.data.value.dates[0]!), to: fmtDate(detail.data.value.dates[detail.data.value.dates.length - 1]!) }) : ''))

// Originality of the 5 outlets that the API reads, in its own period; the lag is in minutes (less than 1 day shows in hours).
const lagText = (min: number) => (min < 1440 ? t('originality.lag.h', { n: fmtDec(min / 60) }) : t('originality.lag.d', { n: fmtDec(min / 1440) }))
const originality = computed(() => {
  const d = orig.data.value
  if (!d) return null
  return {
    meta: t('originality.meta', { n: d.outlets.length, from: fmtMonth(d.window[0], { month: 'short', year: 'numeric' }), to: fmtMonth(d.window[1], { month: 'short', year: 'numeric' }) }),
    rows: d.outlets.slice().sort((a, b) => b.pct - a.pct).map(o => ({
      key: o.name, label: o.name, sub: lagText(o.lagMin), value: o.pct, text: fmtPct(o.pct / 100), color: 'var(--series-news)',
      tip: t('originality.share.tip', { name: o.name, originals: fmtInt(o.originals), rewrites: fmtInt(o.rewrites) })
    }))
  }
})
</script>

<template>
  <template v-if="problem === 'error'">
    <div class="error-state" role="alert" data-state="error">
      <AppIcon name="exclamation-triangle" />
      <p style="margin: 0">{{ t('state.failed') }}</p>
      <button type="button" class="button" @click="retry"><AppIcon name="arrow-path" class="icon icon-sm" />{{ t('state.retry') }}</button>
    </div>
  </template>
  <div v-else-if="problem" class="dash-grid">
    <section class="dcard c-12"><div class="empty-state" data-state="empty"><AppIcon name="inbox" /><p style="margin: 0">{{ t('topics2.empty') }}</p></div></section>
  </div>
  <MediaPlegma v-else variant="similarity">
    <template #map="{ active }">
      <span class="info sim-info">
        <button type="button" class="info-btn" :aria-label="t('dash.info')" aria-expanded="false"><AppIcon name="information-circle" /></button>
        <span class="info-pop" role="note">{{ t('sim.web.info') }}</span>
      </span>
      <div class="sim-web">
        <ClientOnly><SimilarityNetwork v-if="sim" v-model:lit="lit" :sim="sim" :pos="pos" :color-of="colorOf" :active="active" /></ClientOnly>
        <p v-if="!sim" class="sim-loading">{{ t('state.loading') }}</p>
      </div>
    </template>
    <template #aside>
      <div class="media-side-card owner-col">
        <DashCard :title="t('sim.missed.title')" :info="`${t('sim.missed.info', { min: SIM_MAJOR })} ${period}`">
          <template v-if="sim">
            <p class="dcard-sub">{{ t('sim.missed.sub', { n: fmtInt(sim.majorTotal), min: SIM_MAJOR }) }}</p>
            <template v-if="pointed">
              <p class="sim-pointed"><strong>{{ pointed.name }}</strong> · {{ t('sim.missed.count', { k: fmtInt(pointed.stories.length), c: fmtInt(pointed.considered) }) }}</p>
              <ul v-if="skipped.length" class="sim-stories">
                <li v-for="s in skipped" :key="s.story"><span class="sim-story">{{ s.name }}</span><span class="sim-story-n">{{ t('sim.missed.media', { n: s.outlets }) }}</span></li>
              </ul>
              <p v-else class="dcard-empty">{{ t('sim.missed.none') }}</p>
            </template>
            <ul v-else class="owner-outlets sim-rank">
              <li v-for="r in ranking.slice(0, RANK_ROWS)" :key="r.i" :title="t('sim.missed.count', { k: fmtInt(r.k), c: fmtInt(r.c) })"><span>{{ r.name }}</span><span>{{ fmtPct0(r.share) }}</span></li>
            </ul>
          </template>
          <p v-else class="dcard-empty">{{ t('state.loading') }}</p>
        </DashCard>
        <DashCard v-if="originality" :title="t('originality.title')" :info="t('originality.info')">
          <p class="dcard-sub">{{ originality.meta }}</p>
          <BarList :rows="originality.rows" :max="100" />
        </DashCard>
      </div>
    </template>
  </MediaPlegma>
  <p class="proto-note">{{ t('proto.states') }}</p>
</template>
