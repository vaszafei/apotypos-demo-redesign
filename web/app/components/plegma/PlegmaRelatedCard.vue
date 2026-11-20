<script setup lang="ts">
import type { StoryView } from '~/composables/useStoryView'

// The stories of the same theme with title words or days in common; for a story in the catch-all theme only title words count.
const props = defineProps<{ view: StoryView }>()
const { t } = useI18n()
const m = computed(() => props.view.model.value!)
const related = props.view.related
const plegma = usePlegmaStore()
const rows = computed(() => related.value.map(r => ({ id: r.s.id, name: storyName(r.s), value: fmtInt(r.articles), issue: r.s.issue, theme: topicName(m.value.d.issues[r.s.issue]!) })))
</script>

<template>
  <DashCard :title="t('story.related.title')" :info="t('story.related.info')">
    <StoryRows v-if="related.length" :rows="rows" @hover="plegma.setHoverStory($event)" />
    <p v-else class="dcard-empty">{{ t('story.related.empty') }}</p>
  </DashCard>
</template>
