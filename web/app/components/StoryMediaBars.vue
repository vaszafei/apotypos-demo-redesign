<script setup lang="ts">
import { shortName } from '~/utils/groups'
import type { StoryChange } from '~/utils/stories'
// The largest stories of the period, each a bar split by the groups of the outlets that ran it, in the colors of the web; the bars are on one scale (the largest story is the full width).
// Beside the articles of a story is its change against the period of the same length before (`changes`, by the id of the story), with the articles before and now in its tooltip.
type Media = NonNullable<ReturnType<ReturnType<typeof usePeriodWeb>['storyMedia']>>
const props = defineProps<{ data: Media, changes: Map<number, StoryChange> | null }>()
const { t } = useI18n()
const colour = (slot: number) => `var(--cat-${slot})`
const changeOf = (id: number) => props.changes?.get(id) ?? null
const widest = computed(() => Math.max(1, ...props.data.stories.map(r => r.n)))
const groupsOf = (outlets: Media['stories'][number]['outlets']) => {
  const m = new Map<number, { slot: number, n: number, name: string }>()
  for (const o of outlets) {
    const g = m.get(o.slot)
    if (g) g.n += o.n
    else m.set(o.slot, { slot: o.slot, n: o.n, name: o.group ?? t('story.nogroup') })
  }
  return [...m.values()].sort((a, b) => b.n - a.n)
}
</script>

<template>
  <div class="smb">
    <p class="smb-legend"><span v-for="g in data.groups" :key="g.slot"><i :style="{ background: colour(g.slot) }" />{{ shortName(g.name) }}</span></p>
    <ul class="smb-list">
      <li v-for="r in data.stories" :key="r.id">
        <div class="smb-head">
          <NuxtLink :to="storyHref(r.id)" class="smb-name">{{ r.name }}</NuxtLink>
          <span class="smb-n">
            {{ fmtInt(r.n) }} · {{ t('stories.media.outlets', { n: fmtInt(r.outlets.length) }) }}
            <b class="smb-trend" :class="changeOf(r.id)?.change == null ? '' : changeOf(r.id)!.change! >= 0 ? 'is-up' : 'is-down'" :title="changeOf(r.id)?.change == null ? undefined : t('stories.trend.tip', { before: fmtInt(changeOf(r.id)!.before), now: fmtInt(changeOf(r.id)!.now) })">
              <template v-if="changeOf(r.id)?.change != null"><span aria-hidden="true">{{ changeOf(r.id)!.change! >= 0 ? '▲' : '▼' }}</span> {{ fmtSigned(changeOf(r.id)!.change! * 100) }}%</template>
            </b>
          </span>
        </div>
        <div class="smb-bar" :style="{ width: `${Math.max(2, (r.n / widest) * 100)}%` }">
          <i v-for="g in groupsOf(r.outlets)" :key="g.slot" :style="{ flexGrow: g.n, background: colour(g.slot) }" :title="`${shortName(g.name)}: ${fmtInt(g.n)}`" />
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.smb-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
.smb-head { display: flex; justify-content: space-between; gap: 12px; font-size: var(--text-caption); line-height: 1.3; margin-bottom: 3px; }
.smb-name { color: var(--text-primary); text-decoration: none; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.smb-name:hover { text-decoration: underline; }
.smb-n { flex: none; color: var(--text-secondary); white-space: nowrap; }
.smb-trend { display: inline-block; min-width: 68px; margin-left: 8px; font-weight: 600; text-align: right; }
.smb-trend span { font-size: 9px; }
.smb-trend.is-up { color: var(--emph-more); }
.smb-trend.is-down { color: var(--emph-less); }
.smb-bar { display: flex; height: 10px; gap: 1px; border-radius: 3px; overflow: hidden; }
.smb-bar i { display: block; min-width: 2px; }
.smb-legend { display: flex; flex-wrap: wrap; gap: 4px 12px; margin: 0 0 12px; font-size: 11px; color: var(--text-secondary); }
.smb-legend span { display: inline-flex; align-items: center; gap: 5px; }
.smb-legend i { width: 8px; height: 8px; border-radius: 2px; display: inline-block; }
</style>
