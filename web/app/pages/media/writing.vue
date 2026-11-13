<script setup lang="ts">
import { useIntervalFn } from '@vueuse/core'
import type { StanceSeries } from '~/components/StanceWeb.vue'

// Μέσα › Στάση (media-v2.html?tab=writing): the stance of all the outlets to the government as a web of the Plegma over the whole screen (components/StanceWeb.vue), with its key as a
// glass card in the empty top right corner of the plot. Under the web a player plays the stance over time: each step is the last WINDOW days up to one day of the data, and the outlets move
// to where they stood then. There is no date picker here: the player is the date control of the screen.
definePageMeta({ backdrop: true })
const { t } = useI18n()
useHead({ title: () => `${t('nav.media')} · ${t('site.name')}` })
const { status, refresh, data, dates, set, colorOf } = await useMme()

// An outlet needs 30 articles with a stance in a step to be a dot.
const MIN_ARTICLES = 30
const WINDOW = 30
const STEP_MS = 450
const steps = computed(() => {
  if (!set.value || !dates.value.length) return []
  const last = dates.value.length - 1
  const out: number[] = []
  for (let e = Math.min(WINDOW - 1, last); e <= last; e++) out.push(e)
  return out
})
const frames = computed(() => steps.value.map((e) => {
  const S = mmeSummary(set.value!, Math.max(0, e - WINDOW + 1), e)
  const active = S.active.filter(o => o.stance[0] + o.stance[1] + o.stance[2] > 0)
  const tot = active.reduce((a, o) => [a[0]! + o.stance[0], a[1]! + o.stance[1], a[2]! + o.stance[2]], [0, 0, 0])
  const sum = tot[0]! + tot[1]! + tot[2]!
  return { S, active, from: dates.value[Math.max(0, e - WINDOW + 1)]!, to: dates.value[e]!, avg: { c: sum ? tot[0]! / sum : 0, s: sum ? tot[2]! / sum : 0 } }
}))
const series = computed<StanceSeries[]>(() => {
  const by = new Map<string, StanceSeries>()
  frames.value.forEach((fr, f) => {
    for (const o of fr.active) {
      const n = o.stance[0] + o.stance[1] + o.stance[2]
      let row = by.get(o.slug)
      if (!row) {
        const len = frames.value.length
        row = { name: o.name, slug: o.slug, group: o.group, color: o.group ? colorOf.value.get(o.group) ?? NO_GROUP : NO_GROUP, c: Array(len).fill(0), u: Array(len).fill(0), s: Array(len).fill(0), n: Array(len).fill(0) }
        by.set(o.slug, row)
      }
      if (n >= MIN_ARTICLES) { row.c[f] = o.stance[0] / n; row.u[f] = o.stance[1] / n; row.s[f] = o.stance[2] / n; row.n[f] = n }
    }
  })
  return [...by.values()].filter(r => r.n.some(n => n > 0))
})
const avgs = computed(() => frames.value.map(f => f.avg))

// The player: the step shown, from the first to the last. At the last step (the latest days) it stands still; playing starts from the first and stops at the last.
const at = ref<number | null>(null)
const step = computed(() => at.value ?? Math.max(0, frames.value.length - 1))
const playing = ref(false)
const { pause: stop, resume: go } = useIntervalFn(() => {
  if (step.value >= frames.value.length - 1) { playing.value = false; stop(); return }
  at.value = step.value + 1
}, STEP_MS, { immediate: false })
const toggle = () => {
  if (playing.value) { playing.value = false; stop(); return }
  if (step.value >= frames.value.length - 1) at.value = 0
  playing.value = true
  go()
}
const scrub = (v: number) => { playing.value = false; stop(); at.value = v }
onBeforeUnmount(stop)

const frame = computed(() => frames.value[step.value] ?? null)
const title = computed(() => (set.value?.country === 'IL' ? t('mme.gov.title.il') : t('mme.gov.title')))
const shownCount = computed(() => series.value.filter(o => o.n[step.value]! > 0).length)
</script>

<template>
  <template v-if="status === 'error'">
    <div class="error-state" role="alert" data-state="error">
      <AppIcon name="exclamation-triangle" />
      <p style="margin: 0">{{ t('state.failed') }}</p>
      <button type="button" class="button" @click="refresh()"><AppIcon name="arrow-path" class="icon icon-sm" />{{ t('state.retry') }}</button>
    </div>
  </template>
  <div v-else-if="!frame" class="dash-grid">
    <div class="card-col c-12"><section class="dcard"><div class="empty-state" data-state="empty"><p>{{ t('media2.empty.list') }}</p></div></section></div>
  </div>
  <template v-else>
    <MediaPlegma full>
      <template #map="{ active }">
        <div class="stance-stage">
          <div class="stance-web">
            <ClientOnly><StanceWeb v-if="series.length > 1" :series="series" :avgs="avgs" :at="step" :active="active" :caption="title" /></ClientOnly>
          </div>
          <div class="stance-player">
            <button type="button" class="stance-play" :aria-pressed="playing" @click="toggle">{{ playing ? t('mme.time.pause') : t('mme.time.play') }}</button>
            <input
              class="stance-range" type="range" min="0" :max="frames.length - 1" step="1" :value="step" :aria-label="t('mme.time.slider')"
              :aria-valuetext="t('mme.time.window', { from: fmtDate(frame.from), to: fmtDate(frame.to) })" @input="scrub(Number(($event.target as HTMLInputElement).value))"
            >
            <span class="stance-window">{{ t('mme.time.window', { from: fmtDate(frame.from), to: fmtDate(frame.to) }) }}</span>
          </div>
        </div>
      </template>
      <template #side>
        <DashCard :title="title" :info="t('mme.map.info')">
          <template v-if="series.length > 1">
            <p class="dcard-sub">{{ t('mme.map.sub', { n: fmtInt(shownCount), total: fmtInt(frame.active.length) }) }}</p>
            <p class="dcard-sub">{{ t('mme.time.sub', { n: WINDOW }) }}</p>
          </template>
          <p v-else class="dcard-empty">{{ t('media2.empty.list') }}</p>
        </DashCard>
      </template>
    </MediaPlegma>
    <p class="proto-note">{{ t('mme.method', { from: fmtDate(frame.from), to: fmtDate(frame.to), n: fmtInt(frame.S.total), date: fmtDate(data!.updatedAt) }) }}</p>
  </template>
  <p class="proto-note">{{ t('proto.states') }}</p>
</template>
