<script setup lang="ts">
import type { StoryView } from '~/composables/useStoryView'

// The stories with title words or days in common; it exists for every story, also one with no theme.
const props = defineProps<{ view: StoryView }>()
const { t } = useI18n()
const m = computed(() => props.view.model.value!)
const related = props.view.related
</script>

<template>
  <DashCard :title="t('story.related.title')" :info="t('story.related.info')">
    <ul v-if="related.length" class="rows-related">
      <li v-for="r in related" :key="r.s.id">
        <span class="related-main">
          <EntityLink type="story" :to="storyHref(r.s.id)">{{ storyName(r.s) }}</EntityLink>
          <span class="muted-text">{{ r.shared.length ? t('story.related.shared', { words: r.shared.slice(0, 2).join(', ') }) : t('story.related.days') }}</span>
        </span>
        <SparkLine :values="r.values" :from="0" :to="m.last" :label="t('media2.spark.articles')" :width="84" :height="20" />
        <span class="row-value">{{ fmtInt(r.articles) }}</span>
      </li>
    </ul>
    <p v-else class="dcard-empty">{{ t('story.related.empty') }}</p>
  </DashCard>
</template>
