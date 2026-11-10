<script setup lang="ts">
import type { StoriesData } from '~/types/stories'
import type { TopicsData } from '~/types/topics'

// The hero of Αρχική (Home.Hero of assets/home.js): the masthead, the large search, the topics of the last day to search for and the size of the data.
// The Plegma is behind it (PlegmaStage.vue) where the static page drew its own field.
const { t } = useI18n()
type HomeData = TopicsData & { outlets: { name: string, daily: (number | null)[] }[] }
const { data: home } = await useFixture<HomeData>('home', { required: ['dates', 'issues', 'issueDaily'], isEmpty: b => b.dates.length === 0 })
const stories = useFixtureLazy<StoriesData>('stories', { required: ['dates', 'issues', 'stories'], isEmpty: b => b.stories.length === 0 })
const search = ref<{ open: (query?: string) => void }>()

// The topics have no count after the coded days, so the last day is the last one that has a count (as Θέματα does).
const last = computed(() => (home.value ? home.value.issueDaily.reduce((m, row) => Math.max(m, row.findLastIndex(v => v !== null)), 0) : 0))
// The news topics with the most articles on the last day. The catch-all topics ("Άλλα", "Άλλα διεθνή") are not something to search for.
const chips = computed(() => {
  const d = home.value
  if (!d) return []
  return d.issues.map((x, k) => ({ x, n: d.issueDaily[k]![last.value] ?? 0 }))
    .filter(r => !r.x.soft && !r.x.catchAll && !/^Άλλα(\s|$)/.test(r.x.el) && r.n > 0)
    .sort((a, b) => b.n - a.n).slice(0, 4)
})
const collected = computed(() => home.value?.outlets.reduce((sum, o) => sum + o.daily.reduce<number>((s, v) => s + (v ?? 0), 0), 0) ?? 0)
const storyCount = computed(() => {
  const d = stories.data.value
  return d ? d.stories.filter(s => !s.generic).length : null
})
const period = computed(() => {
  const d = home.value
  if (!d) return ''
  return t('home.hero.period', { from: fmtMonth(d.dates[0]!, { day: 'numeric', month: 'long' }), to: fmtMonth(d.dates[d.dates.length - 1]!, { day: 'numeric', month: 'long', year: 'numeric' }) })
})
const brand = computed(() => t('site.name').toLocaleUpperCase('el'))
const tail = computed(() => t('home.hero.eyebrow').toLocaleUpperCase(useNuxtApp().$i18n.locale.value))
</script>

<template>
  <section class="home-hero" aria-labelledby="home-hero-title">
    <div class="home-hero-inner">
      <h1 id="home-hero-title" class="home-mast" :aria-label="`${t('site.name')} / ${t('home.hero.eyebrow')}`">
        <span class="mast-part mast-name" aria-hidden="true">{{ brand }}</span><span class="mast-slash" aria-hidden="true">/</span><span class="mast-part mast-tail" aria-hidden="true">{{ tail }}</span>
      </h1>
      <div class="home-hero-search"><GlobalSearch ref="search" hero /></div>
      <div v-if="chips.length" class="home-hero-try">
        <span class="home-hero-try-label">{{ t('home.hero.try') }}</span>
        <button v-for="r in chips" :key="r.x.el" type="button" class="home-chip" @click="search?.open(topicName(r.x))">{{ topicName(r.x) }}</button>
      </div>
      <div v-if="home" class="kpi-tile home-hero-stats">
        <dl :aria-label="period">
          <div class="home-hero-stat"><dt>{{ t('home.hero.articles') }}</dt><dd class="kpi-value">{{ fmtInt(collected) }}</dd></div>
          <div class="home-hero-stat"><dt>{{ t('home.hero.outlets') }}</dt><dd class="kpi-value">{{ fmtInt(home.outlets.length) }}</dd></div>
          <div class="home-hero-stat"><dt>{{ t('home.hero.stories') }}</dt><dd class="kpi-value">{{ storyCount === null ? '–' : fmtInt(storyCount) }}</dd></div>
          <div class="home-hero-stat"><dt>{{ t('home.hero.days') }}</dt><dd class="kpi-value">{{ fmtInt(home.dates.length) }}</dd></div>
        </dl>
        <p class="home-hero-period">{{ period }}</p>
      </div>
    </div>
  </section>
</template>
