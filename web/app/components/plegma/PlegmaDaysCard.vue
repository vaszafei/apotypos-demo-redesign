<script setup lang="ts">
import type { StoryView } from '~/composables/useStoryView'

// Articles per day of the story, by group (the old story page's first card).
const props = defineProps<{ view: StoryView }>()
const { t } = useI18n()
const v = props.view
</script>

<template>
  <DashCard :title="t('story.daily.title')" :info="t('story.daily.info')">
    <DayBars :dates="v.shown.value" :series="v.series.value" :height="130" :caption="t('outlet2.daily.aria')" :tip-of="v.dailyTip" :selectable="false" />
    <ChartLegend :items="v.series.value.map(x => ({ label: x.name, color: x.color }))" />
  </DashCard>
</template>
