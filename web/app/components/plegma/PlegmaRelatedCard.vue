<script setup lang="ts">
import type { StoryView } from '~/composables/useStoryView'
import type { PlegmaHighlight } from '~/utils/plegma/plegma-articles'

// The stories about the same thing. For a story of the database they come from the vectors of the articles, and a row pointed at lights the articles of this story
// about it on the map; for the others they are the stories of the same theme with title words or days in common (in the catch-all theme only title words count).
const props = defineProps<{ view: StoryView }>()
const { t } = useI18n()
const m = computed(() => props.view.model.value!)
const related = props.view.related
const plegma = usePlegmaStore()
const rows = computed(() => related.value.map(r => ({ id: r.s.id, name: storyName(r.s), value: fmtInt(r.articles), issue: r.s.issue, theme: topicName(m.value.d.issues[r.s.issue]!) })))
const picks = computed(() => new Map(related.value.filter(r => r.picks).map(r => [r.s.id, new Set(r.picks)])))
let lit: PlegmaHighlight | null = null
const hover = (id: number | null) => {
  plegma.setHoverStory(id)
  const set = id === null ? undefined : picks.value.get(id)
  if (set) { lit = { story: id!, picks: set }; plegma.setHighlight(lit) }
  else if (lit && toRaw(plegma.highlight) === lit) { lit = null; plegma.setHighlight(null) }
}
onBeforeUnmount(() => { if (lit && toRaw(plegma.highlight) === lit) plegma.setHighlight(null) })
</script>

<template>
  <DashCard :title="t('story.related.title')" :info="view.relatedByVectors.value ? t('story.related.infoVectors') : t('story.related.info')">
    <StoryRows v-if="related.length" :rows="rows" @hover="hover" />
    <p v-else class="dcard-empty">{{ t('story.related.empty') }}</p>
  </DashCard>
</template>
