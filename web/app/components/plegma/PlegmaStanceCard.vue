<script setup lang="ts">
import type { StoryView } from '~/composables/useStoryView'

// The stance of the story against all articles.
const props = defineProps<{ view: StoryView }>()
const { t } = useI18n()
const m = computed(() => props.view.model.value!)
const total = computed(() => props.view.stance.value?.total ?? 0)
</script>

<template>
  <StanceCard
    :rows="[{ label: t('entity.stance.story'), color: 'var(--series-news)', counts: m.det.s!.slice(1) }, { label: t('entity.stance.all'), color: NO_GROUP, counts: m.dd.base.s.slice(1) }]"
    :foot="total ? t('story.how.stance.n', { n: fmtInt(total), total: fmtInt(m.articles) }) : null"
  />
</template>
