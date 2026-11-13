<script setup lang="ts">
import type { StanceNode } from '~/components/StanceWeb.vue'

// Μέσα › Στάση (media-v2.html?tab=writing): the stance of all the outlets to the government as a web of the Plegma over the whole screen (components/StanceWeb.vue), with its key as a
// glass card in the empty top right corner of the plot.
definePageMeta({ backdrop: true })
const { t } = useI18n()
useHead({ title: () => `${t('nav.media')} · ${t('site.name')}` })
const period = usePeriodStore()
const { status, refresh, data, dates, view, summary: S, colorOf, set } = await useMme()

const title = computed(() => (set.value?.country === 'IL' ? t('mme.gov.title.il') : t('mme.gov.title')))
const all = computed(() => (S.value?.active ?? []).filter(o => o.stance[0] + o.stance[1] + o.stance[2] > 0))
// An outlet needs 30 articles with a stance to be a dot.
const points = computed<StanceNode[]>(() => all.value.filter(o => o.stance[0] + o.stance[1] + o.stance[2] >= 30).map((o) => {
  const n = o.stance[0] + o.stance[1] + o.stance[2]
  return { name: o.name, slug: o.slug, group: o.group, c: o.stance[0] / n, u: o.stance[1] / n, s: o.stance[2] / n, n, color: o.group ? colorOf.value.get(o.group) ?? NO_GROUP : NO_GROUP }
}))
const avg = computed(() => {
  const tot = all.value.reduce((a, o) => [a[0]! + o.stance[0], a[1]! + o.stance[1], a[2]! + o.stance[2]], [0, 0, 0])
  const total = tot[0]! + tot[1]! + tot[2]!
  return { c: tot[0]! / total, s: tot[2]! / total }
})
</script>

<template>
  <Teleport v-if="dates.length" defer to="#page-actions">
    <DateRange :dates="dates" :from="view.from" :to="view.to" @change="r => period.set(r.from, r.to)" />
  </Teleport>

  <template v-if="status === 'error'">
    <div class="error-state" role="alert" data-state="error">
      <AppIcon name="exclamation-triangle" />
      <p style="margin: 0">{{ t('state.failed') }}</p>
      <button type="button" class="button" @click="refresh()"><AppIcon name="arrow-path" class="icon icon-sm" />{{ t('state.retry') }}</button>
    </div>
  </template>
  <div v-else-if="!S" class="dash-grid">
    <div class="card-col c-12"><section class="dcard"><div class="empty-state" data-state="empty"><p>{{ t('media2.empty.list') }}</p></div></section></div>
  </div>
  <template v-else>
    <MediaPlegma full>
      <template #map="{ active }">
        <ClientOnly><StanceWeb v-if="points.length > 1" :points="points" :avg="avg" :active="active" :caption="title" /></ClientOnly>
      </template>
      <template #side>
        <DashCard :title="title" :info="t('mme.map.info')">
          <template v-if="points.length > 1">
            <p class="dcard-sub">{{ t('mme.map.sub', { n: fmtInt(points.length), total: fmtInt(all.length) }) }}</p>
          </template>
          <p v-else class="dcard-empty">{{ t('media2.empty.list') }}</p>
        </DashCard>
      </template>
    </MediaPlegma>
    <p class="proto-note">{{ t('mme.method', { from: fmtDate(view.from), to: fmtDate(view.to), n: fmtInt(S.total), date: fmtDate(data!.updatedAt) }) }}</p>
  </template>
  <p class="proto-note">{{ t('proto.states') }}</p>
</template>
