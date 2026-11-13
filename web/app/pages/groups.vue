<script setup lang="ts">
import { dayDots } from '~/utils/plegma-day'
import type { PlegmaDayTheme } from '~/utils/plegma-day'
import { compactName, slotOfColor } from '~/utils/groups'
// Ιδιοκτησία (groups-v2.html): a screen of the Plegma (components/MediaPlegma.vue) whose web is the groups with their outlets (in place of the network of owners and outlets), and beside it
// the articles of each group by day and the stance of each group; under it the share of each group.
// The group, the owner and the articles come from the static files, so the table and the shares cover the window of the groups file and there is no period control.
definePageMeta({ backdrop: true })
const { t } = useI18n()
useHead({ title: () => `${t('groups.title')} · ${t('site.name')}` })
const { status, refresh, data, empty, groups, total, grouped, treeGroups, top3, media, stacks, volumeTotal, stanceRows, colorOf } = await useGroups()

// The web: each group is a node with its outlets around it, each outlet a small web of dots as many as the root of its articles, in the color of the group; the ring is the share of
// each group. The outlets with no group are the last, gray. A click opens the page of the outlet or of the group.
const outletList = computed(() => treeGroups.value.flatMap(g => g.outlets))
const webGroups = computed<PlegmaDayTheme[]>(() => {
  let k = 0
  return treeGroups.value.map((g, gi) => ({
    issue: gi, name: compactName(g.label, g.key === null, t('media2.groups.none.short')), slot: slotOfColor(g.color), n: g.value, rest: 0,
    stories: g.outlets.map(o => ({ id: k++, name: o.name, n: o.value, media: 0, dots: dayDots(Math.sqrt(o.value) / 6, [{ slot: slotOfColor(g.color), n: 1 }]) }))
  })).sort((a, b) => b.n - a.n)
})
const webRing = computed(() => webGroups.value.map(g => ({ issue: g.issue, name: g.name, slot: g.slot, n: g.n })))
const lit = ref<number | null>(null)
const openGroup = (gi: number) => {
  const g = treeGroups.value[gi]
  if (g?.slug) navigateTo(groupPageHref(g.slug))
}
const period = computed(() => (data.value ? t('period.text', { from: fmtDate(data.value.window[0]), to: fmtDate(data.value.window[1]) }) : ''))
const hasData = computed(() => !!total.value)

const volumeInfo = computed(() => t('g2.volume.info', { min: fmtInt(GAP), n: fmtInt(volumeTotal.value) }))
const legend = computed(() => treeGroups.value.map(g => ({ key: g.key ?? 'none', label: compactName(g.label, g.key === null, t('media2.groups.none.short')), color: g.color })))
const shareInfo = computed(() => (hasData.value ? [t('g2.share.finding', { share: fmtPct(top3.value / total.value) }), t('media2.groups.known', { share: fmtPct(grouped.value / total.value) })].join('. ') : undefined))

const scale = computed(() => Math.max(...stanceRows.value.map(r => Math.max(r.crit + r.neu / 2, r.sup + r.neu / 2)), 0.01))
const critical = computed(() => stanceRows.value.slice().sort((a, b) => b.crit - a.crit))
const stanceInfo = computed(() => {
  const c = critical.value
  const finding = c.length > 1 ? `${t('g2.stance.finding', { most: c[0]!.g.name, a: fmtPct(c[0]!.crit), least: c[c.length - 1]!.g.name, b: fmtPct(c[c.length - 1]!.crit) })}. ` : ''
  return `${finding}${t('g2.stance.sub')}`
})
const stanceLegend = [['critical', 'var(--stance-critical)'], ['neutral', 'var(--stance-neutral)'], ['supportive', 'var(--stance-supportive)']] as const
const stanceLabel = (r: (typeof stanceRows.value)[number]) => t('g2.stance.row', { group: r.g.name, critical: fmtPct(r.crit), neutral: fmtPct(r.neu), supportive: fmtPct(r.sup), n: fmtInt(r.n) })
</script>

<template>
  <template v-if="status === 'error'">
    <div class="error-state" role="alert" data-state="error">
      <AppIcon name="exclamation-triangle" />
      <p style="margin: 0">{{ t('state.failed') }}</p>
      <button type="button" class="button" @click="refresh()"><AppIcon name="arrow-path" class="icon icon-sm" />{{ t('state.retry') }}</button>
    </div>
  </template>
  <MediaPlegma v-else>
    <template #map="{ active }">
      <ClientOnly>
        <PlegmaDayWeb
          v-if="hasData" v-model:lit="lit" :themes="webGroups" :ring="webRing" :outlets="[]" mode="themes" :date="fmtInt(total)" :sub="t('home.field.articles')"
          :picked="null" :active="active" grow :theme-label="t('g2.web.group')" :label="t('g2.tree.title')"
          @pick="id => navigateTo(outletHref(outletList[id]!.slug))" @pick-theme="openGroup"
        />
      </ClientOnly>
    </template>
    <template #side>
      <DashCard :title="t('g2.volume.title')" :info="volumeInfo">
        <template v-if="volumeTotal && media">
          <ul class="legend legend-line"><li v-for="l in legend" :key="l.key"><span class="swatch" :style="{ background: l.color }" />{{ l.label }}</li></ul>
          <GroupLines :dates="media.dates" :stacks="stacks" />
        </template>
        <p v-else class="dcard-empty">{{ t('groups.empty') }}</p>
      </DashCard>

      <DashCard :title="t('g2.stance.title')" :info="stanceInfo">
        <template v-if="stanceRows.length">
          <ul class="legend"><li v-for="[name, color] in stanceLegend" :key="name"><span class="swatch" :style="{ background: color }" />{{ t(`stance.${name}`) }}</li></ul>
          <div class="bar-box">
            <ul class="bar-list">
              <li v-for="r in stanceRows" :key="r.g.name">
                <span class="row-name"><span class="dot" :style="`--dot:${colorOf.get(r.g.name)}`" aria-hidden="true" />{{ r.g.name }}</span>
                <span class="row-value">{{ fmtPct(r.crit) }} · {{ fmtPct(r.sup) }}</span>
                <DivergingBar :left="r.crit" :middle="r.neu" :right="r.sup" :scale="scale" :label="stanceLabel(r)" />
              </li>
            </ul>
          </div>
        </template>
        <p v-else class="dcard-empty">{{ t('groups.empty') }}</p>
      </DashCard>
    </template>
    <div class="dash-grid">
      <DashCard class="c-6" :title="t('media2.groups.title')" :info="shareInfo">
        <GroupSunburst v-if="hasData" :groups="treeGroups" :total="total" />
        <p v-else class="dcard-empty">{{ t('groups.empty') }}</p>
      </DashCard>
    </div>
  </MediaPlegma>
  <p class="proto-note">{{ t('proto.states') }}</p>
</template>
