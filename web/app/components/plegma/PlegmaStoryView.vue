<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import PlegmaDaysCard from './PlegmaDaysCard.vue'
import PlegmaOutletsCard from './PlegmaOutletsCard.vue'
import PlegmaHowCard from './PlegmaHowCard.vue'
import PlegmaRelatedCard from './PlegmaRelatedCard.vue'
import PlegmaStanceCard from './PlegmaStanceCard.vue'
import PlegmaPeopleCard from './PlegmaPeopleCard.vue'
import type { PlegmaStoryCard } from '~/utils/plegma-story'

// The story view: the title, four headline cards in the slots around the map region, and the rest behind chips. The web itself is the stage's (PlegmaStage.vue).
const props = defineProps<{ id: number }>()
const { t } = useI18n()
const plegma = usePlegmaStore()
const view = useStoryView(() => props.id)
const { loading, problem, retry, model: m, dayLabel } = view

const BODY = { days: PlegmaDaysCard, outlets: PlegmaOutletsCard, how: PlegmaHowCard, related: PlegmaRelatedCard, stance: PlegmaStanceCard, people: PlegmaPeopleCard }
const TITLE: Partial<Record<PlegmaStoryCard, string>> = { stance: 'entity.stance.title', people: 'story.people.title' }
const cards = computed(() => plegmaStoryCards(!!m.value?.labelled))
const dock = computed(() => cards.value.dock.map(key => ({ key, label: t(TITLE[key]!) })))
const open = ref<PlegmaStoryCard | null>(null)
const toggle = (key: PlegmaStoryCard) => { open.value = open.value === key ? null : key }

// The map region is what the title and the cards leave free: the middle row of the left column, in its left part (a story's web sits at the left). The camera frames it.
const orbit = ref<HTMLElement>()
const map = ref<HTMLElement>()
const measure = () => {
  const o = orbit.value
  const m = map.value
  if (!o || !m || !window.matchMedia('(min-width: 1024px)').matches) { plegma.setRegion(null); return }
  const stage = o.getBoundingClientRect()
  const box = m.getBoundingClientRect()
  if (!stage.width || !stage.height || box.height < 40) return
  const x1 = Math.min(box.right, stage.width * REGION_MAX_X)
  plegma.setRegion({ x0: box.left / stage.width, y0: (box.top - stage.top) / stage.height, x1: Math.max(x1, box.left + 80) / stage.width, y1: (box.bottom - stage.top) / stage.height })
}
const REGION_MAX_X = 0.4
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
const slots = computed(() => cards.value.headline.map((key, i) => ({ key, at: i })))
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
    <div class="orbit-left">
      <div class="plegma-title entity-grid">
        <EntityTitle :kind="t('hero.kind.story')" :title="storyName(m.story)">
          <template #meta>
            <span>
              <EntityLink type="topic" :to="topicHref(String(m.story.issue))">{{ topicName(m.issue) }}</EntityLink>
              {{ ` · ${dayLabel(m.start)} → ${fmtDate(m.d.dates[m.end]!)} · ` }}{{ m.end === m.start ? t('story.hero.day.one') : t('entity.fact.days', { n: m.end - m.start + 1 }) }}
            </span>
          </template>
          <EntityFact :label="t('entity.fact.articles')" :value="fmtInt(m.articles)" :sub="t('entity.fact.peak', { date: dayLabel(m.peak), n: fmtInt(m.perDay[m.peak]!) })">
            <template #spark><SparkLine :values="m.perDay" :from="m.lo" :to="m.hi" :label="t('story.daily.title')" :width="56" :height="16" /></template>
          </EntityFact>
          <EntityFact :label="t('entity.fact.outlets')" :value="fmtInt(m.outlets.length)" :sub="t('entity.fact.of', { n: m.dd.outlets.length })" />
          <EntityFact :label="t('entity.fact.groups')" :value="fmtInt(m.groups.filter(g => g.group).length)">
            <template #sub><NuxtLink v-if="m.echo" class="quiet-link" to="/stories">{{ t('entity.fact.echo', { n: m.echo }) }}</NuxtLink><template v-else>{{ t('entity.fact.noecho') }}</template></template>
          </EntityFact>
          <EntityFact v-if="m.people.length" :label="t('entity.fact.people')" :value="fmtInt(m.people.length)" :sub="m.people[0]!.person.name" />
        </EntityTitle>
      </div>
      <div ref="map" class="orbit-map"><PlegmaDock v-if="dock.length" :items="dock" :open="open" @toggle="toggle" /></div>
      <PlegmaCard v-for="s in slots.filter(x => x.at >= 2)" :key="s.key" :at="s.at" :order="s.at">
        <component :is="BODY[s.key]" :view="view" />
      </PlegmaCard>
      <PlegmaCard v-if="open" :key="open" :at="3" :order="0" class="is-open">
        <component :is="BODY[open]" :view="view" />
      </PlegmaCard>
    </div>
    <div class="orbit-right">
      <PlegmaCard v-for="s in slots.filter(x => x.at < 2)" :key="s.key" :at="s.at" :order="s.at">
        <component :is="BODY[s.key]" :view="view" />
      </PlegmaCard>
    </div>
  </div>
  <p v-if="problem" class="proto-note">{{ t('proto.states') }}</p>
</template>
