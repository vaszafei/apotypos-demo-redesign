<script setup lang="ts">
import type { StoriesData } from '~/types/stories'

// The topics the outlet wrote in the last days of the period, with the articles of those days and the last day it wrote on each.
const props = defineProps<{ rows: { issue: number, n: number, last: number }[], issues: StoriesData['issues'], dates: string[] }>()
const { t } = useI18n()
</script>

<template>
  <DashCard :title="t('outlet2.topics.title')" :info="t('outlet2.topics.info')">
    <div v-if="rows.length" class="latest-scroll">
      <ul class="rows-related latest-stories">
        <li v-for="r in rows" :key="r.issue">
          <span class="related-main"><span class="story-line" :title="topicName(issues[r.issue]!)"><EntityLink type="topic" :to="topicHref(r.issue)">{{ topicName(issues[r.issue]!) }}</EntityLink></span></span>
          <span class="row-value" :title="t('outlet2.topics.last', { date: fmtDay(props.dates[r.last]!) })">{{ fmtInt(r.n) }} · {{ fmtDay(props.dates[r.last]!) }}</span>
        </li>
      </ul>
    </div>
    <p v-else class="dcard-empty">{{ t('outlet2.topics.empty') }}</p>
  </DashCard>
</template>
