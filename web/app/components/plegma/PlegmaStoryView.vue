<script setup lang="ts">
import PlegmaDaysCard from './PlegmaDaysCard.vue'
import PlegmaHowCard from './PlegmaHowCard.vue'
import PlegmaRelatedCard from './PlegmaRelatedCard.vue'
import PlegmaStanceCard from './PlegmaStanceCard.vue'
import PlegmaPeopleCard from './PlegmaPeopleCard.vue'
import { articlesPerNode } from '~/utils/plegma-articles'

// The story view: the title, under it the other stories of the theme, the free cell for the map and the cards beside it, and the days under that row. The web itself is the stage's (PlegmaStage.vue).
const props = defineProps<{ id: number }>()
const { t } = useI18n()
const plegma = usePlegmaStore()
const view = useStoryView(() => props.id)
const { loading, problem, retry, model: m, dayLabel } = view
// The map draws one node for each article of the story.
watch(view.articles, list => plegma.setArticles(list.length ? list : null), { immediate: true })
watch(view.related, list => plegma.setRelated(list.map(r => r.s.id)), { immediate: true })
const ring = computed({ get: () => plegma.ring, set: (v: string) => plegma.setRing(v === 'stance' || v === 'outlets' ? v : 'groups') })
// The bar at the end of the row is the outlets while the ring is the outlets, and the groups otherwise.
// A part of the bar under the pointer lights its nodes on the map, softly (the outlet on the ring of the outlets, the group otherwise).
const lightPart = (p: { group: string | null, name: string } | null) => plegma.setHighlight(p ? (plegma.ring === 'outlets' ? { group: p.group, outlet: p.name } : { group: p.group }) : null)
const stripParts = computed(() => (plegma.ring === 'outlets' ? view.outletParts.value : view.groupParts.value))
watch(() => (m.value?.labelled ? m.value.det.s!.slice(1) : null), counts => plegma.setStance(counts), { immediate: true })
onBeforeUnmount(() => { plegma.setStance(null); plegma.setRing('groups'); plegma.setArticles(null); plegma.setHighlight(null); plegma.setHoverStory(null); plegma.setRelated([]) })

const BODY = { days: PlegmaDaysCard, how: PlegmaHowCard, related: PlegmaRelatedCard, stance: PlegmaStanceCard, people: PlegmaPeopleCard }
const columns = computed(() => plegmaStoryColumns(!!m.value?.labelled))

// The map region is the free cell of the left column, under the title (composables/usePlegmaRegion.ts).
const orbit = ref<HTMLElement>()
const map = ref<HTMLElement>()
usePlegmaRegion(orbit, map)
// How many articles a node of the map stands for: one while the story is small enough to show each article (utils/plegma-articles.ts).
const perNode = computed(() => (m.value ? articlesPerNode(m.value.articles) : 1))
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
  <ErrorPage v-else-if="!m" :status="404" />
  <div v-else ref="orbit" class="plegma-orbit is-story" :class="{ 'is-in': plegma.landed, 'no-right': !columns.right.length, 'has-strip': columns.right.length }">
    <div class="plegma-title entity-grid">
      <EntityTitle :kind="t('hero.kind.story')" :title="storyName(m.story)">
        <template #meta><EntityLink type="topic" :to="topicHref(String(m.story.issue))">{{ topicName(m.issue) }}</EntityLink></template>
        <EntityFact :label="t('entity.fact.articles')" :value="fmtInt(m.articles)" />
        <EntityFact :label="t('entity.fact.outlets')" :value="fmtInt(m.outlets.length)" :sub="t('entity.fact.of', { n: m.dd.outlets.length })" />
      </EntityTitle>
    </div>
    <div class="orbit-col orbit-left">
      <PlegmaCard v-for="(key, i) in columns.left" :key="key" :at="2" :order="3 + i" :class="`card-${key}`"><component :is="BODY[key]" :view="view" /></PlegmaCard>
    </div>
    <div ref="map" class="orbit-map">
      <SegmentedControl v-if="m.labelled" v-model="ring" class="orbit-ring-tabs" :label="t('story.ring.label')" :options="[{ value: 'outlets', label: t('story.ring.outlets') }, { value: 'groups', label: t('story.groups.title') }, { value: 'stance', label: t('story.ring.stance') }]" />
      <p class="plegma-nodes-note">{{ perNode > 1 ? t('story.nodes.many', { n: fmtInt(perNode) }) : t('story.nodes.one') }}</p></div>
    <div v-if="columns.right.length" class="orbit-col orbit-right">
      <PlegmaCard :at="0" :order="3" class="card-strip"><OutletStack :parts="stripParts" @hover="lightPart" :caption="plegma.ring === 'outlets' ? undefined : t('story.strip.groups', { n: stripParts.length })" /></PlegmaCard>
      <div class="orbit-subs">
        <div v-for="(column, c) in columns.right" :key="c" class="orbit-sub">
          <PlegmaCard v-for="(key, i) in column" :key="key" :at="0" :order="1 + c + i" :class="`card-${key}`"><component :is="BODY[key]" :view="view" /></PlegmaCard>
        </div>
      </div>
    </div>
    <div class="orbit-col orbit-under">
      <PlegmaCard v-for="(key, i) in columns.under" :key="key" :at="4" :order="2 + i" :class="`card-${key}`"><component :is="BODY[key]" :view="view" /></PlegmaCard>
    </div>
  </div>
  <p v-if="problem && problem !== 'loading'" class="proto-note">{{ t('proto.states') }}</p>
</template>
