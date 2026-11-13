<script setup lang="ts">
import type { TopicRow } from '~/types/topics'

const props = defineProps<{ rows: TopicRow[] }>()
const widest = computed(() => Math.max(...props.rows.map(r => Math.abs(r.change ?? 0)), 0))
const bars = computed(() => props.rows.map(r => ({
  key: r.k, label: topicName(r.issue), to: topicHref(r.k), value: Math.abs(r.change ?? 0),
  color: (r.change ?? 0) > 0 ? 'var(--emph-more)' : 'var(--emph-less)', arrow: (r.change ?? 0) > 0 ? 'up' as const : 'down' as const,
  text: `${fmtSigned((r.change ?? 0) * 100)}%`
})))
</script>

<template>
  <BarList :rows="bars" :max="widest" />
</template>
