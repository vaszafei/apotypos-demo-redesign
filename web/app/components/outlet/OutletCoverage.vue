<script setup lang="ts">
import type { MmeProfile } from '~/types/mme'

// CoverageCard of assets/mme.js: the stories the outlet pushes (twice the average share of the others) and the big stories it did not run, two lists of 5.
const props = defineProps<{ P: MmeProfile, k: number }>()
const { t } = useI18n()
const cover = computed(() => coverageOf(props.P, props.k))
const nameOf = (s: { el: string, en: string }) => s[useNuxtApp().$i18n.locale.value as 'el' | 'en'] || s.el
</script>

<template>
  <DashCard class="c-12" :title="t('mme.o.cover.title')" :info="t('mme.o.cover.info')">
    <h3 class="rows-caption">{{ t('mme.o.push.title') }}</h3>
    <ul v-if="cover.push.length" class="rows-related mme-related">
      <li v-for="(r, i) in cover.push" :key="i"><span class="related-main"><span>{{ nameOf(r.s) }}</span><span class="muted-text">{{ t('mme.o.push.row', { n: fmtInt(r.s.per[k]!), ratio: fmtDec(r.ratio) }) }}</span></span></li>
    </ul>
    <p v-else class="dcard-empty">{{ t('mme.o.push.empty') }}</p>
    <h3 class="rows-caption mme-gap">{{ t('mme.o.skip.title') }}</h3>
    <ul v-if="cover.skip.length" class="rows-related mme-related">
      <li v-for="(r, i) in cover.skip" :key="i"><span class="related-main"><span>{{ nameOf(r.s) }}</span><span class="muted-text">{{ t('mme.o.skip.row', { reach: r.s.reach, n: fmtInt(r.s.n), expected: fmtDec(r.expected) }) }}</span></span></li>
    </ul>
    <p v-else class="dcard-empty">{{ t('mme.o.skip.empty') }}</p>
  </DashCard>
</template>
