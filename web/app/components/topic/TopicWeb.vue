<script setup lang="ts">
import type { TopicRow } from '~/types/topics'
import type { PlegmaDayTheme } from '~/utils/plegma/plegma-day'
import type { DayRing } from '~/components/plegma/PlegmaDayWeb.vue'

// The topics of a period as a web of the Plegma (components/PlegmaDayWeb.vue): the count at the center, a node for each topic and a thin ring of their shares. With `themes` (Θέματα)
// each topic has its largest stories, each a small web of dots in the colors of the groups that ran it; without (Επισκόπηση) the topics are alone, each with faint dots as many as its
// share, spread round the center. `lit` is the topic pointed at, here or in the list beside it (TopicList). A click opens the page of a topic or of a story.
const props = defineProps<{ rows: TopicRow[], total: number, colorOf: Map<number, string>, center?: string, caption?: string, themes?: PlegmaDayTheme[], active: boolean, zoom?: number }>()
const lit = defineModel<number | null>('lit', { default: null })
const { t } = useI18n()

const slotOf = (k: number) => Number(/--cat-(\d+)/.exec(props.colorOf.get(k) ?? '')?.[1] ?? 0)
const ring = computed<DayRing[]>(() => props.rows.map(r => ({ issue: r.k, name: topicName(r.issue), slot: slotOf(r.k), n: r.count })))
// With stories a topic is as large as its articles in all, not only in the stories shown: the size of its node is its share of the ring.
const sized = computed(() => props.themes?.map(th => ({ ...th, n: props.rows.find(r => r.k === th.issue)?.count ?? th.n })))
const alone = computed<PlegmaDayTheme[]>(() => {
  const most = Math.max(1, ...props.rows.map(r => r.count))
  return props.rows.map(r => ({ issue: r.k, name: topicName(r.issue), slot: slotOf(r.k), n: r.count, stories: [], rest: Math.max(1, Math.round(14 * Math.sqrt(r.count / most))) }))
})
</script>

<template>
  <PlegmaDayWeb
    v-model:lit="lit" :themes="sized ?? alone" :ring="ring" :outlets="[]" mode="themes" :date="fmtInt(total)" :sub="center ?? t('topics2.all.center')"
    :picked="null" :active="active" :labels="8" grow :spread="!themes" :shares="!!themes" :zoom="zoom ?? 1" :label="caption ?? t('topics2.all.title')"
    @pick="id => navigateTo(storyHref(id))" @pick-theme="k => navigateTo(topicHref(k))"
  />
</template>
