<script setup lang="ts">
import type { MmeProfile } from '~/types/mme'

// VoicesCard of assets/mme.js: whom the outlet quotes, its parties against all outlets (the tick), and who attacks whom (the 6 pairs with the most statements).
const props = defineProps<{ P: MmeProfile, k: number }>()
const { t } = useI18n()
const voices = computed(() => voicesOf(props.P, props.k))
const people = computed(() => voices.value.people.map(r => ({ key: r.p.name, label: r.p.name, text: fmtInt(r.n), value: r.n, color: '' })))
const parties = computed(() => voices.value.parties.map(r => ({ key: r.p, label: r.p, text: `${fmtPct0(r.v)} / ${fmtPct0(r.usual)}`, value: r.v, color: '', marker: r.usual })))
const attacks = computed(() => voices.value.attacks.map(([a, b, n]) => ({ key: `${a}>${b}`, label: '', short: `${a.split(' ').pop()} → ${b.split(' ').pop()}`, title: `${a} → ${b}`, text: fmtInt(n), value: n, color: '' })))
</script>

<template>
  <DashCard class="c-12" :title="t('mme.o.voices.title')" :info="t('mme.o.voices.info')">
    <BarList v-if="people.length" :rows="people" :max="Math.max(...people.map(r => r.value), 1)" />
    <p v-else class="dcard-empty">{{ t('media2.empty.list') }}</p>
    <template v-if="parties.length">
      <h3 class="rows-caption mme-gap">{{ t('mme.o.parties') }}</h3>
      <p class="dcard-sub">{{ t('mme.o.parties.n', { n: fmtInt(voices.partiesN) }) }}</p>
      <BarList :rows="parties" :max="1" cls="mme-share" />
    </template>
    <template v-if="attacks.length">
      <h3 class="rows-caption mme-gap">{{ t('mme.o.attacks') }}</h3>
      <BarList :rows="attacks" :max="Math.max(...attacks.map(r => r.value), 1)" cls="mme-attacks">
        <template #label="{ row }"><span :title="row.title">{{ row.short }}</span></template>
      </BarList>
    </template>
  </DashCard>
</template>
