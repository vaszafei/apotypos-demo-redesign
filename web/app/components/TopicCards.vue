<script setup lang="ts">
import type { BarRow } from '~/components/BarList.vue'
import type { TopicRow } from '~/types/topics'
import { TOPIC_TREND_MIN, topicOutletTrends } from '~/composables/useTopicDetail'

// The cards of the topic picked on Μέσα › Θέματα, beside its web: its name and numbers, the trends of the outlets in the period (which outlets write it more or less than in the period before),
// the stance toward the government, the outlets and groups that write it more or less than usual, and how it is written (the cards of the topic page). A scroll of glass cards.
const props = defineProps<{ row: TopicRow, total: number, from: string, to: string }>()
const emit = defineEmits<{ back: [] }>()
const { t } = useI18n()
const index = computed(() => props.row.k)
const { list, detail, loading, problem, retry, colorOfGroup, model } = useTopicDetail(index)

const diffKey = computed(() => [{ label: t('story.how.more'), color: 'var(--emph-more)' }, { label: t('story.how.less'), color: 'var(--emph-less)' }])
const trends = computed(() => (detail.data.value && list.data.value ? topicOutletTrends(detail.data.value, list.data.value, index.value, props.from, props.to) : null))
const rowOf = (r: NonNullable<typeof trends.value>['up'][number]): BarRow => ({
  key: r.slug, label: r.name, to: outletHref(r.slug), value: Math.abs(r.change), color: r.change > 0 ? 'var(--emph-more)' : 'var(--emph-less)',
  arrow: r.change > 0 ? 'up' : 'down', text: `${fmtSigned(r.change * 100)}%`, tip: t('stories.trend.tip', { before: fmtInt(r.before), now: fmtInt(r.now) })
})
</script>

<template>
  <div class="topic-cards">
    <header class="topic-cards-head dcard">
      <button type="button" class="button topic-back" @click="emit('back')"><AppIcon name="chevron-left" class="icon icon-sm" />{{ t('topics2.pick.back') }}</button>
      <p class="topic-cards-kind">{{ t('hero.kind.topic') }}</p>
      <h2 class="topic-cards-title"><EntityLink type="topic" :to="topicHref(row.k)">{{ topicName(row.issue) }}</EntityLink></h2>
      <p class="topic-cards-facts">
        <span><b>{{ fmtInt(row.count) }}</b> {{ t('entity.fact.articles') }}</span>
        <span><b>{{ fmtPct(row.count / total) }}</b> {{ t('entity.fact.share') }}</span>
        <span v-if="model"><b>{{ fmtInt(model.mine.length) }}</b> {{ t('entity.fact.stories') }}</span>
      </p>
    </header>

    <div v-if="loading" class="topic-cards-wait" aria-busy="true" />
    <div v-else-if="problem" class="empty-state" :data-state="problem === 'error' ? 'error' : 'empty'">
      <p>{{ problem === 'error' ? t('state.failed') : t('topics2.empty') }}</p>
      <button v-if="problem === 'error'" type="button" class="button" @click="retry()">{{ t('state.retry') }}</button>
    </div>
    <template v-else-if="model">
      <DashCard :title="t('topics2.trend.title')" :info="t('topics2.trend.info', { n: TOPIC_TREND_MIN })">
        <p v-if="!trends" class="dcard-empty">{{ t('stories.trend.empty') }}</p>
        <template v-else>
          <p class="dcard-sub">{{ t('topics2.trend.total', { now: fmtInt(trends.totalNow), before: fmtInt(trends.totalBefore) }) }}</p>
          <div class="story-trend">
            <div class="story-trend-col">
              <p class="dcard-sub">{{ t('stories.trend.up') }}</p>
              <BarList v-if="trends.up.length" :rows="trends.up.map(rowOf)" :max="trends.widest" />
              <p v-else class="dcard-empty">{{ t('stories.trend.none') }}</p>
            </div>
            <div class="story-trend-col">
              <p class="dcard-sub">{{ t('stories.trend.down') }}</p>
              <BarList v-if="trends.down.length" :rows="trends.down.map(rowOf)" :max="trends.widest" />
              <p v-else class="dcard-empty">{{ t('stories.trend.none') }}</p>
            </div>
          </div>
        </template>
      </DashCard>
      <StanceCard
        :rows="[{ label: t('entity.stance.topic'), color: 'var(--series-news)', counts: model.det.s.slice(1) }, { label: t('entity.stance.all'), color: NO_GROUP, counts: model.dd.base.s.slice(1) }]"
        :foot="model.stanceN ? t('topic2.how.stance.n', { n: fmtInt(model.stanceN) }) : null"
      />
      <DashCard :title="t('topic2.outlets.title')" :info="t('topic2.outlets.info')">
        <template v-if="model.outlets.rows.length">
          <div class="how-grid how-grid-2">
            <div v-for="side in ['more', 'less'] as const" :key="side" class="how-panel">
              <h3 class="rows-caption">{{ t(`topic2.outlets.${side}`) }}</h3>
              <DiffList :rows="model.outlets[side]" :scale="model.outletScale" tip-key="topic2.how.tip">
                <template #label="{ row: r }"><EntityLink type="outlet" :to="outletHref(r.o.slug)">{{ r.label }}</EntityLink></template>
              </DiffList>
            </div>
          </div>
          <div class="theme-foot"><p class="dcard-sub">{{ t('topic2.outlets.n', { n: fmtInt(model.rowsTopic), total: fmtInt(model.rowsAll) }) }}</p><ChartLegend :items="diffKey" /></div>
        </template>
        <p v-else class="dcard-empty">{{ t('topic2.empty') }}</p>
      </DashCard>
      <DashCard :title="t('topic2.groups.title')" :info="t('topic2.groups.info')">
        <div class="how-panel">
          <DiffList :rows="model.groups" :scale="model.outletScale" tip-key="topic2.how.tip">
            <template #label="{ row: r }"><span class="group-cell"><span class="dot" :style="`--dot:${colorOfGroup.get(r.label)}`" /><span class="group-name">{{ r.label }}</span></span></template>
          </DiffList>
        </div>
        <ChartLegend :items="diffKey" />
      </DashCard>
      <DashCard :title="t('topic2.how.title')" :info="t('topic2.how.info')">
        <div class="how-grid how-grid-2">
          <div class="how-panel">
            <h3 class="rows-caption">{{ t('story.how.frame') }}</h3>
            <DiffList v-if="model.frames.length" :rows="model.frames" :scale="model.howScale" tip-key="topic2.how.tip" />
          </div>
          <div>
            <div class="how-panel">
              <h3 class="rows-caption">{{ t('story.how.section') }}</h3>
              <DiffList v-if="model.sections.length" :rows="model.sections" :scale="model.howScale" tip-key="topic2.how.tip" />
            </div>
            <div class="how-panel">
              <h3 class="rows-caption">{{ t('story.how.clickbait') }}</h3>
              <DiffList v-if="model.click.length" :rows="model.click" :scale="model.howScale" tip-key="topic2.how.tip" />
              <p class="dcard-sub">{{ model.scored ? t('story.how.clickbait.n', { n: fmtInt(model.baited), total: fmtInt(model.scored) }) : t('story.how.clickbait.none') }}</p>
            </div>
          </div>
        </div>
      </DashCard>
      <p class="dcard-sub topic-cards-scope">{{ t('topics2.pick.scope') }}</p>
    </template>
  </div>
</template>
