<script setup lang="ts">
import type { TopicRow } from '~/types/topics'

// The list of the topics of a period beside their web (TopicWeb): every topic with its share, the largest first; it scrolls. A row pointed at lights its topic on the web, and a topic
// pointed at on the web lights its row. With `pickable` a click on a name picks the topic (the page shows its cards) instead of opening its page.
const props = defineProps<{ rows: TopicRow[], total: number, colorOf: Map<number, string>, pickable?: boolean }>()
const emit = defineEmits<{ pick: [k: number] }>()
const lit = defineModel<number | null>('lit', { default: null })
const { t } = useI18n()
const tooltip = useTooltipStore()
const tip = (r: TopicRow) => t('media2.topic.tip', { topic: topicName(r.issue), n: fmtInt(r.count), share: fmtPct(r.count / props.total) })
const point = (r: TopicRow | null, e?: PointerEvent) => {
  lit.value = r ? r.k : null
  if (r && e) tooltip.show({ title: tip(r) }, e)
  else tooltip.hide()
}
</script>

<template>
  <ul class="rows rows-groups rows-owners mme-topic-list topic-list" @pointerleave="point(null)">
    <li v-for="r in rows" :key="r.k" :class="{ 'is-lit': lit === r.k }" @pointerenter="point(r, $event)" @pointermove="point(r, $event)">
      <span class="dot" :style="`--dot:${colorOf.get(r.k) ?? 'var(--bar-muted)'}`" aria-hidden="true" />
      <span class="row-name">
        <button v-if="pickable" type="button" class="topic-pick" @click="emit('pick', r.k)">{{ topicName(r.issue) }}</button>
        <EntityLink v-else type="topic" :to="topicHref(r.k)">{{ topicName(r.issue) }}</EntityLink>
      </span>
      <span class="row-value">{{ fmtPct(r.count / total) }}</span>
    </li>
  </ul>
</template>
