<script setup lang="ts">
import { useWindowSize } from '@vueuse/core'
import type { StoriesData } from '~/types/stories'
import type { Series } from '~/types/topics'
import type { OutletStory } from '~/utils/outlet-detail'

// The outlet over time as lines: the articles of its largest topics or of its largest stories each day (the tab of the page picks which).
const props = defineProps<{ dates: string[], i0: number, i1: number, topicDays: Map<number, number[]>, mine: OutletStory[], issues: StoriesData['issues'], mode: 'topics' | 'stories' }>()
const { t } = useI18n()
const { height } = useWindowSize()
const tall = computed(() => Math.round(Math.min(300, Math.max(110, height.value * 0.2))))
const part = (values: number[]) => values.slice(props.i0, props.i1 + 1)

// The lines of the period with the most articles, over the days from the first to the last that have any.
const lines = computed(() => {
  const rows = props.mode === 'topics'
    ? [...props.topicDays].filter(([issue]) => !props.issues[issue]!.catchAll).map(([issue, values]) => ({ key: String(issue), name: topicName(props.issues[issue]!), values: part(values) }))
    : props.mine.filter(r => r.story).map(r => ({ key: String(r.story!.id), name: storyName(r.story!), values: part(r.days) }))
  const top = rows.map(r => ({ ...r, total: r.values.reduce((a, v) => a + v, 0) })).filter(r => r.total > 0).sort((a, b) => b.total - a.total).slice(0, OUTLET_LINES)
  const span = dataSpan(top)
  if (!span) return { dates: [] as string[], series: [] as Series[] }
  return { dates: props.dates.slice(props.i0, props.i1 + 1).slice(span[0], span[1] + 1), series: top.map((r, i) => ({ key: r.key, name: r.name, color: `var(--cat-${i + 1})`, values: r.values.slice(span[0], span[1] + 1) })) as Series[] }
})
</script>

<template>
  <DashCard :title="t(`outlet2.time.${mode}.title`)" :info="t(`outlet2.time.${mode}.info`)">
    <LinesChart v-if="lines.series.length" :key="`${mode}-${i0}-${i1}`" :dates="lines.dates" :series="lines.series" :sparse="mode === 'stories'" :sqrt="mode === 'stories'" :tall="tall" :caption="t(`outlet2.time.${mode}.title`)" :href-of="s => (mode === 'stories' ? storyHref(s.key) : topicHref(s.key))" />
    <p v-else class="dcard-empty">{{ t('outlet2.topics.empty') }}</p>
  </DashCard>
</template>
