<script setup lang="ts">
import type { StoryView } from '~/composables/useStoryView'

// How the story was written against all articles: framing, section and clickbait, on one scale.
const props = defineProps<{ view: StoryView }>()
const { t } = useI18n()
const how = computed(() => props.view.how.value!)
</script>

<template>
  <DashCard :title="t('story.how.title')" :info="t('story.how.info')">
    <div class="how-grid how-grid-2">
      <div v-for="(column, c) in how.columns" :key="c" class="how-panel">
        <template v-for="p in column" :key="p.title">
          <h3 class="rows-caption">{{ p.title }}</h3>
          <BarList v-if="p.rows.length" :rows="p.rows">
            <template #bar="{ row }"><DivergingBar :left="-row.diff" :right="row.diff" :scale="how.scale" :colors="['var(--emph-less)', null, 'var(--emph-more)']" :label="row.tipText" /></template>
          </BarList>
          <p v-if="p.note" class="dcard-sub">{{ p.note }}</p>
        </template>
      </div>
    </div>
    <ChartLegend :items="[{ label: t('story.how.more'), color: 'var(--emph-more)' }, { label: t('story.how.less'), color: 'var(--emph-less)' }]" />
  </DashCard>
</template>
