<script setup lang="ts">
import { useWindowSize } from '@vueuse/core'
import type { StoriesData } from '~/types/stories'
import type { Series } from '~/types/topics'
import type { OutletStory } from '~/utils/outlet-detail'

// The outlet over time as lines: the articles of its largest topics or of its largest stories each day (the tab of the page picks which).
const props = defineProps<{ dates: string[], topicDays: Map<number, number[]>, mine: OutletStory[], issues: StoriesData['issues'], mode: 'topics' | 'stories' }>()
const { t } = useI18n()
const { height } = useWindowSize()
const tall = computed(() => Math.round(Math.min(300, Math.max(110, height.value * 0.2))))
const cut = (values: number[]) => values.slice(0, props.dates.length)

const topics = computed<Series[]>(() => [...props.topicDays].filter(([issue]) => !props.issues[issue]!.catchAll)
  .map(([issue, values]) => ({ issue, values: cut(values), total: values.reduce((a, v) => a + v, 0) }))
  .sort((a, b) => b.total - a.total).slice(0, OUTLET_LINES)
  .map((r, i) => ({ key: String(r.issue), name: topicName(props.issues[r.issue]!), color: `var(--cat-${i + 1})`, values: r.values })))
const stories = computed<Series[]>(() => props.mine.filter(r => r.story).slice(0, OUTLET_LINES)
  .map((r, i) => ({ key: String(r.story!.id), name: storyName(r.story!), color: `var(--cat-${i + 1})`, values: cut(r.days) })))
const series = computed(() => (props.mode === 'topics' ? topics.value : stories.value))
</script>

<template>
  <DashCard :title="t(`outlet2.time.${mode}.title`)" :info="t(`outlet2.time.${mode}.info`)">
    <LinesChart v-if="series.length" :key="mode" :dates="dates" :series="series" :sparse="mode === 'stories'" :sqrt="mode === 'stories'" :tall="tall" :caption="t(`outlet2.time.${mode}.title`)" :href-of="s => (mode === 'stories' ? storyHref(s.key) : topicHref(s.key))" />
    <p v-else class="dcard-empty">{{ t('outlet2.topics.empty') }}</p>
  </DashCard>
</template>
