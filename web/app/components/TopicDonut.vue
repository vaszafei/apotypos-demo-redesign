<script setup lang="ts">
import type { TopicRow } from '~/types/topics'

// TopicDonut of topics-v2.html: one ring, a slice for each topic from the top, clockwise, the largest first; the list on its side has every topic and scrolls.
const props = defineProps<{ rows: TopicRow[], total: number, colorOf: Map<number, string> }>()
const tooltip = useTooltipStore()

const size = 176
const c = size / 2
const [r0, r1] = [57, 87]
const pad = 0.008
const point = (a: number, r: number) => `${(c + r * Math.sin(a)).toFixed(2)} ${(c - r * Math.cos(a)).toFixed(2)}`
const arc = (a0: number, a1: number) => {
  a0 += pad / 2
  a1 = Math.max(a0 + 0.002, a1 - pad / 2)
  const large = a1 - a0 > Math.PI ? 1 : 0
  return `M${point(a0, r1)}A${r1} ${r1} 0 ${large} 1 ${point(a1, r1)}L${point(a1, r0)}A${r0} ${r0} 0 ${large} 0 ${point(a0, r0)}Z`
}
const slices = computed(() => {
  let a = 0
  return props.rows.map((r, i) => {
    const span = (r.count / props.total) * 2 * Math.PI
    const d = arc(a, a + span)
    a += span
    return { r, i, d, color: props.colorOf.get(r.k) ?? 'var(--bar-muted)', ranked: props.colorOf.has(r.k) }
  })
})
const { t } = useI18n()
const tip = (r: TopicRow) => t('media2.topic.tip', { topic: topicName(r.issue), n: fmtInt(r.count), share: fmtPct(r.count / props.total) })
const show = (r: TopicRow, e: PointerEvent) => tooltip.show({ title: tip(r) }, e)
</script>

<template>
  <div class="donut-wrap sun-wrap mme-topic-wrap">
    <div class="mme-topic-box">
      <ul class="rows rows-groups rows-owners mme-topic-list">
        <li v-for="s in slices" :key="s.r.k" :title="tip(s.r)">
          <span class="dot" :style="`--dot:${s.color}`" aria-hidden="true" />
          <span class="row-name"><a class="entity-link" :href="topicHref(s.r.k)">{{ topicName(s.r.issue) }}</a></span>
          <span class="row-value">{{ fmtPct(s.r.count / total) }}</span>
        </li>
      </ul>
    </div>
    <svg class="chart donut topic-donut" :width="size" :height="size" :viewBox="`0 0 ${size} ${size}`" role="img" :aria-label="t('topics2.all.title')">
      <path
        v-for="s in slices" :key="s.r.k" :class="s.ranked ? 'slice' : 'slice slice-rest'" :d="s.d" :fill="s.color" :style="`--m-i: ${s.i};`"
        @pointerenter="show(s.r, $event)" @pointermove="show(s.r, $event)" @pointerleave="tooltip.hide()"
      />
      <text class="donut-num" :x="c" :y="c + 3" text-anchor="middle">{{ fmtInt(total) }}</text>
      <text :x="c" :y="c + 19" text-anchor="middle">{{ t('topics2.all.center') }}</text>
    </svg>
  </div>
</template>
