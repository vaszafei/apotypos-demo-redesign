<script setup lang="ts">
import type { RelatedOutlet } from '~/utils/outlet-detail'

// The card of the related outlets (relatedCard in outlet-v2.html): a rose of the 12 most similar outlets and a list under it that is the text of the chart:
// the outlet, its group, the shared stories and the similarity. The outlets with fewer than 10 shared stories have no slice and are named under the list.
const props = defineProps<{ slices: RelatedOutlet[], unscored: RelatedOutlet[], empty: boolean, colorOf: (group: string | null) => string, groupSlugs: Map<string, string> }>()
const { t } = useI18n()
const rose = computed(() => props.slices.map(r => ({ name: r.name, score: r.score!, color: props.colorOf(r.group), tip: `${r.name}: ${fmtPct(r.score!)} · ${t('outlet2.related.row', { shared: fmtInt(r.shared) })}` })))
</script>

<template>
  <DashCard class="c-12" :title="t('outlet2.related.title')" :info="t('outlet2.related.info')">
    <template v-if="!empty">
      <div v-if="slices.length" class="rose-body">
        <RoseChart :rows="rose" />
        <ul class="rose-legend">
          <li v-for="r in slices" :key="r.slug" :title="t('outlet2.related.row', { shared: fmtInt(r.shared) })">
            <span class="rose-swatch" :style="`background:${colorOf(r.group)}`" aria-hidden="true" />
            <span class="rose-name">
              <EntityLink type="outlet" :to="outletHref(r.slug)">{{ r.name }}</EntityLink>
              <span class="rose-group" :title="r.group || t('story.nogroup')">/ <EntityLink v-if="r.group && groupSlugs.has(r.group)" type="group" :to="groupPageHref(groupSlugs.get(r.group)!)">{{ r.group }}</EntityLink><template v-else>{{ r.group || t('story.nogroup') }}</template></span>
            </span>
            <span class="row-value">{{ fmtPct(r.score!) }}</span>
          </li>
        </ul>
      </div>
      <p v-if="unscored.length" class="dcard-sub">{{ t('outlet2.related.few') }} <template v-for="(r, i) in unscored" :key="r.slug"><template v-if="i">, </template><EntityLink type="outlet" :to="outletHref(r.slug)">{{ r.name }}</EntityLink></template></p>
    </template>
    <p v-else class="dcard-empty">{{ t('outlet2.related.empty') }}</p>
  </DashCard>
</template>
