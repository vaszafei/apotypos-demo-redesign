<script setup lang="ts">
import { useWindowSize } from '@vueuse/core'
import type { StoryView } from '~/composables/useStoryView'

// Articles per day of the story, as one line (the lines of Ιστορίες στο χρόνο, for this story alone).
const props = defineProps<{ view: StoryView }>()
const { t } = useI18n()
const v = props.view
const m = computed(() => v.model.value!)
// The chart takes about a quarter of the height of the screen: the card of the groups under it has to show every group.
const { height } = useWindowSize()
const tall = computed(() => Math.round(Math.min(300, Math.max(180, height.value * 0.24))))
const series = computed(() => [{ key: String(m.value.story.id), name: storyName(m.value.story), color: 'var(--cat-1)', values: m.value.perDay.slice(m.value.lo, m.value.hi + 1) }])
</script>

<template>
  <DashCard :title="t('story.daily.title')" :info="t('story.daily.info')">
    <LinesChart :dates="v.shown.value" :series="series" plain :tall="tall" :caption="t('story.daily.title')" :href-of="s => storyHref(s.key)" />
  </DashCard>
</template>
