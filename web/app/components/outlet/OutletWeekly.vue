<script setup lang="ts">
import type { MmeSet } from '~/types/mme'

// WeeklyAgenda of assets/mme.js: the share of each topic in the news of the outlet, week by week, one line for each of its 7 largest topics.
const props = defineProps<{ set: MmeSet, k: number }>()
const { t } = useI18n()
const SLOTS = [1, 2, 3, 4, 5, 7, 6].map(i => `var(--cat-${i})`)
const agenda = computed(() => weeklyAgenda(props.set, props.k))
const series = computed(() => agenda.value.series.map((s, j) => ({ label: topicName(props.set.issues[s.issue]!), color: SLOTS[j]!, values: s.values })))
const weeks = computed(() => agenda.value.weeks)
</script>

<template>
  <DashCard class="c-12" :title="t('mme.o.weekly.title')" :info="t('mme.o.weekly.info')">
    <ChartLegend :items="series.map(s => ({ label: s.label, color: s.color }))" />
    <WeekLines
      :labels="weeks.map(w => fmtDay(set.dates[w.i0]!))" :tips="weeks.map(w => `${fmtDay(set.dates[w.i0]!)} – ${fmtDay(set.dates[w.i1]!)} (n=${fmtInt(w.n)})`)"
      :series="series" :height="260" zero :y-format="fmtPct0" :aria="t('mme.o.weekly.title')"
    />
  </DashCard>
</template>
