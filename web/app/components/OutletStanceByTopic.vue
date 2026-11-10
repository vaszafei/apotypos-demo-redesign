<script setup lang="ts">
import type { MmeProfile } from '~/types/mme'

// StanceByTopic of assets/mme.js: critical articles to the left and supportive to the right, for each topic. The thin gray bar is all the other articles.
// limit: the topics with the most articles (one column); without it the list is two columns.
const props = defineProps<{ P: MmeProfile, k: number, limit?: number }>()
const { t } = useI18n()
const rows = computed(() => stanceByTopic(props.P, props.k, props.limit).map((r) => {
  const crit = r.mine[0]! / r.n
  const sup = r.mine[2]! / r.n
  return { key: r.issue.el, label: topicName(r.issue), text: fmtInt(r.n), value: 0, color: '', crit, sup, allCrit: r.allCrit, allSup: r.allSup, n: r.n }
}))
const key = computed(() => [
  { label: t('stance.critical'), color: 'var(--stance-critical)' }, { label: t('stance.supportive'), color: 'var(--stance-supportive)' }, { label: t('mme.o.stance.all'), color: 'var(--cat-0)' }
])
</script>

<template>
  <DashCard class="c-12" :title="t('mme.o.stance.title')" :info="limit ? `${t('mme.o.stance.info')} ${t('mme.o.stance.limit', { n: limit })}` : t('mme.o.stance.info')">
    <template #tools><ChartLegend :items="key" /></template>
    <BarList v-if="rows.length" :rows="rows" :columns="limit ? 1 : 2">
      <template #bar="{ row }">
        <PairBars
          :here="{ left: row.crit, right: row.sup }" :others="{ left: row.allCrit, right: row.allSup }" :scale="1"
          :label="t('mme.o.stance.row', { topic: row.label, crit: fmtPct(row.crit), sup: fmtPct(row.sup), n: row.n, all: fmtPct(row.allCrit) })"
        />
      </template>
    </BarList>
    <p v-else class="dcard-empty">{{ t('media2.empty.list') }}</p>
  </DashCard>
</template>
