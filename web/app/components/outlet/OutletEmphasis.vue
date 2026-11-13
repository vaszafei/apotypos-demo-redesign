<script setup lang="ts">
import type { MmeProfile } from '~/types/mme'

// EmphasisCard of assets/mme.js: what the outlet stresses more or less than all outlets, topics, frames and sections in one list, by how many times its share is the share of all outlets.
// P is null for an outlet that is not in ΜΜΕ & πρόσωπα: it has no frames and no sections.
const props = defineProps<{ P: MmeProfile | null, k: number, topics: { label: string, value: number, usual: number }[], topicN: number }>()
const { t } = useI18n()
const result = computed(() => emphasisOf(props.P, props.k, props.topics, { frame: code => t(`frame.${code}`), section: code => t(`section.${code}`) }))
const panels = computed(() => [
  { key: 'more', color: 'var(--emph-more)', list: result.value.more },
  { key: 'less', color: 'var(--emph-less)', list: result.value.less }
].map(p => ({ ...p, rows: p.list.map(r => ({ key: `${r.kind}:${r.label}`, label: r.label, sub: t('mme.o.emph.row', { kind: t(`mme.o.kind.${r.kind}`), value: fmtPct(r.value), usual: fmtPct(r.usual) }), value: Math.abs(r.ratio - 1), text: `×${fmtDec(r.ratio)}`, color: p.color })) })))
</script>

<template>
  <DashCard class="c-12" :title="t('mme.o.emph.title')" :info="t('mme.o.emph.info')">
    <template v-if="topics.length || P">
      <div class="how-grid how-grid-2">
        <div v-for="p in panels" :key="p.key" class="how-panel">
          <h3 class="rows-caption">{{ t(`mme.o.emph.${p.key}`) }}</h3>
          <BarList v-if="p.rows.length" :rows="p.rows" :max="result.top" />
          <p v-else class="dcard-empty">{{ t('media2.empty.list') }}</p>
        </div>
      </div>
      <p class="dcard-sub">{{ t('mme.o.emph.sub', { n: fmtInt(topicN) }) }}</p>
    </template>
    <p v-else class="dcard-empty">{{ t('outlet2.topics.empty') }}</p>
  </DashCard>
</template>
