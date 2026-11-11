<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import PlegmaDaysCard from './PlegmaDaysCard.vue'
import PlegmaOutletsCard from './PlegmaOutletsCard.vue'
import PlegmaHowCard from './PlegmaHowCard.vue'
import PlegmaRelatedCard from './PlegmaRelatedCard.vue'
import PlegmaStanceCard from './PlegmaStanceCard.vue'
import PlegmaPeopleCard from './PlegmaPeopleCard.vue'
import { articlesPerNode } from '~/utils/plegma-articles'

// The story view: three columns of cards with the title and the free cell for the map at the top left. The web itself is the stage's (PlegmaStage.vue).
const props = defineProps<{ id: number }>()
const { t } = useI18n()
const plegma = usePlegmaStore()
const view = useStoryView(() => props.id)
const { loading, problem, retry, model: m, dayLabel } = view
// The map draws one node for each article of the story.
watch(view.articles, list => plegma.setArticles(list.length ? list : null), { immediate: true })
onBeforeUnmount(() => plegma.setArticles(null))

const BODY = { days: PlegmaDaysCard, outlets: PlegmaOutletsCard, how: PlegmaHowCard, related: PlegmaRelatedCard, stance: PlegmaStanceCard, people: PlegmaPeopleCard }
const columns = computed(() => plegmaStoryColumns(!!m.value?.labelled))

// The map region is the free cell of the left column, under the title: a square in the middle of it (a story's web sits there). The camera frames it.
const orbit = ref<HTMLElement>()
const map = ref<HTMLElement>()
const REGION_SIDE = 380
const measure = () => {
  const o = orbit.value
  const cell = map.value
  if (!o || !cell || !window.matchMedia('(min-width: 1024px)').matches) { plegma.setRegion(null); return }
  const stage = o.getBoundingClientRect()
  const box = cell.getBoundingClientRect()
  if (!stage.width || !stage.height || box.height < 40) return
  const side = Math.min(box.width, box.height, REGION_SIDE)
  const x = box.left + (box.width - side) / 2
  const y = box.top - stage.top + (box.height - side) / 2
  plegma.setRegion({ x0: x / stage.width, y0: y / stage.height, x1: (x + side) / stage.width, y1: (y + side) / stage.height })
}
let watcher: ResizeObserver | null = null
watch(map, (el) => {
  watcher?.disconnect()
  if (!el) return
  watcher = new ResizeObserver(measure)
  watcher.observe(el)
  measure()
}, { flush: 'post' })
useEventListener(window, 'resize', measure)
onBeforeUnmount(() => watcher?.disconnect())
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
  <div v-else ref="orbit" class="plegma-orbit" :class="{ 'is-in': plegma.landed }">
    <div class="orbit-col orbit-left">
      <div class="plegma-title entity-grid">
        <EntityTitle :kind="t('hero.kind.story')" :title="storyName(m.story)">
          <template #meta>
            <span>
              <EntityLink type="topic" :to="topicHref(String(m.story.issue))">{{ topicName(m.issue) }}</EntityLink>
              {{ ` · ${dayLabel(m.start)} → ${fmtDate(m.d.dates[m.end]!)} · ` }}{{ m.end === m.start ? t('story.hero.day.one') : t('entity.fact.days', { n: m.end - m.start + 1 }) }}
            </span>
          </template>
          <EntityFact :label="t('entity.fact.articles')" :value="fmtInt(m.articles)" />
          <EntityFact :label="t('entity.fact.outlets')" :value="fmtInt(m.outlets.length)" :sub="t('entity.fact.of', { n: m.dd.outlets.length })" />
          <EntityFact v-if="m.people.length" :label="t('entity.fact.people')" :value="fmtInt(m.people.length)" :sub="m.people[0]!.person.name" />
        </EntityTitle>
      </div>
      <div ref="map" class="orbit-map"><p class="plegma-nodes-note">{{ perNode > 1 ? t('story.nodes.many', { n: fmtInt(perNode) }) : t('story.nodes.one') }}</p></div>
      <PlegmaCard v-for="(key, i) in columns.left" :key="key" :at="2" :order="3 + i" :class="`card-${key}`"><component :is="BODY[key]" :view="view" /></PlegmaCard>
    </div>
    <div class="orbit-col orbit-middle">
      <PlegmaCard v-for="(key, i) in columns.middle" :key="key" :at="4" :order="2 + i" :class="`card-${key}`"><component :is="BODY[key]" :view="view" /></PlegmaCard>
    </div>
    <div class="orbit-col orbit-right">
      <PlegmaCard v-for="(key, i) in columns.right" :key="key" :at="0" :order="i" :class="`card-${key}`"><component :is="BODY[key]" :view="view" /></PlegmaCard>
    </div>
  </div>
  <p v-if="problem" class="proto-note">{{ t('proto.states') }}</p>
</template>
