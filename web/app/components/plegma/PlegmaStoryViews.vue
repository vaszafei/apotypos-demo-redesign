<script setup lang="ts">
import type { StoryView } from '~/composables/useStoryView'
import type { PlegmaHighlight } from '~/utils/plegma/plegma-articles'
import PlegmaRing from './PlegmaRing.vue'
import type { RingMiddle, RingPart } from './PlegmaRing.vue'
import PlegmaSpeedChart from './PlegmaSpeedChart.vue'

// The views of a story above the other stories (a story with no profile), not in a card, one at a time under a switch: the ring of its outlets, the ring of its groups, the ring of all
// outlets with those that did not write it (Σιωπή), the ring of the outlets that copied an earlier article of the story (Αντίγραφα, with the copies as lines on the map) and how fast it
// spread (Ταχύτητα). What the pointer is on lights its articles on the map.
const props = defineProps<{ view: StoryView }>()
const { t } = useI18n()
const plegma = usePlegmaStore()
const m = computed(() => props.view.model.value!)
const which = ref<'outlets' | 'groups' | 'silence' | 'copies' | 'speed'>('outlets')
const whichModel = computed({ get: () => which.value, set: (v: string) => { which.value = v as typeof which.value } })
const options = computed(() => [
  { value: 'outlets', label: t('story.ring.outlets') },
  { value: 'groups', label: t('story.groups.title') },
  { value: 'silence', label: t('story.views.silence') },
  { value: 'copies', label: t('story.views.copies') },
  { value: 'speed', label: t('story.views.speed') }
])
const short = (g: string | null) => (g ?? t('story.nogroup')).replace(/^(Συμφέροντα|Όμιλος)\s+/, '')

let lit: PlegmaHighlight | null = null
const light = (h: PlegmaHighlight | null) => {
  if (h) { lit = h; plegma.setHighlight(h) }
  else if (lit && toRaw(plegma.highlight) === lit) { lit = null; plegma.setHighlight(null) }
}
watch(which, () => light(null))

const articlesFact = computed(() => fmtInt(m.value.articles))
const outletParts = computed<RingPart[]>(() => props.view.outletParts.value.map(p => ({ key: p.name, name: p.name, group: p.group, n: p.n, color: p.color })))
const outlets = {
  middle: computed<RingMiddle>(() => ({ big: articlesFact.value, bigCap: t('entity.fact.articles'), line: fmtInt(outletParts.value.length), cap: t('entity.fact.outlets') })),
  pointed: (p: RingPart): RingMiddle => ({ big: fmtInt(p.n), bigCap: t('entity.fact.articles'), line: p.name, cap: short(p.group) }),
  hover: (p: RingPart | null) => light(p ? { group: p.group, outlet: p.name } : null)
}
const groupParts = computed<RingPart[]>(() => props.view.groupParts.value.map(p => ({ key: p.name, name: p.name, group: p.group, n: p.n, color: p.color })))
const groups = {
  middle: computed<RingMiddle>(() => ({ big: articlesFact.value, bigCap: t('entity.fact.articles'), line: fmtInt(groupParts.value.length), cap: t('story.groups.title') })),
  pointed: (p: RingPart): RingMiddle => ({ big: fmtInt(p.n), bigCap: t('entity.fact.articles'), line: short(p.name), cap: fmtPct(p.n / m.value.articles) }),
  hover: (p: RingPart | null) => light(p ? { group: p.group } : null),
  label: (p: RingPart, total: number) => `${short(p.name)} · ${fmtPct(p.n / total)}`
}
// Σιωπή: every outlet, as equal arcs, by group; those that wrote the story in the color of their group, the others dashed and named.
const silenceParts = computed<RingPart[]>(() => {
  const wrote = new Map(outletParts.value.map(p => [p.name, p]))
  return [...m.value.dd.outlets].sort((a, b) => (a.group ?? '￿').localeCompare(b.group ?? '￿') || Number(wrote.has(b.name)) - Number(wrote.has(a.name)) || a.name.localeCompare(b.name))
    .map(o => ({ key: o.name, name: o.name, group: o.group, n: wrote.get(o.name)?.n ?? 0, color: wrote.get(o.name)?.color ?? 'var(--text-secondary)', w: 1, silent: !wrote.has(o.name) }))
})
const silence = {
  middle: computed<RingMiddle>(() => ({ big: fmtInt(silenceParts.value.filter(p => p.silent).length), bigCap: t('story.silence.big'), line: t('story.silence.line', { n: fmtInt(outletParts.value.length), total: fmtInt(m.value.dd.outlets.length) }), cap: t('story.silence.wrote') })),
  pointed: (p: RingPart): RingMiddle => ({ big: fmtInt(p.n), bigCap: t('entity.fact.articles'), line: p.name, cap: short(p.group) }),
  hover: (p: RingPart | null) => light(p && !p.silent ? { group: p.group, outlet: p.name } : null),
  named: (p: RingPart) => !!p.silent,
  label: (p: RingPart) => p.name
}
// Αντίγραφα: the outlets that published a copy of an earlier article of another outlet, by their copies; under the pointer, their copies and the articles they copy are lit, with the lines between them.
let seq = 0
const copyPairs = computed(() => props.view.copies.value ?? [])
const copyParts = computed<RingPart[]>(() => {
  const list = props.view.articles.value
  const colors = new Map(outletParts.value.map(p => [p.name, p.color]))
  const by = new Map<string, RingPart>()
  for (const [c] of copyPairs.value) {
    const a = list[c]
    if (!a) continue
    const part = by.get(a.outlet) ?? { key: a.outlet, name: a.outlet, group: a.group, n: 0, color: colors.get(a.outlet) ?? 'var(--cat-0)' }
    part.n++
    by.set(a.outlet, part)
  }
  return [...by.values()]
})
const copies = {
  middle: computed<RingMiddle>(() => ({ big: fmtInt(copyPairs.value.length), bigCap: t('story.copies.big'), line: fmtPct(copyPairs.value.length / m.value.articles), cap: t('story.copies.share') })),
  pointed: (p: RingPart): RingMiddle => ({ big: fmtInt(p.n), bigCap: t('story.copies.big'), line: p.name, cap: short(p.group) }),
  label: (p: RingPart) => `${p.name} · ${fmtInt(p.n)}`,
  hover: (p: RingPart | null) => {
    const list = props.view.articles.value
    const hot = new Set<number>()
    const picks = new Set<number>()
    if (p) copyPairs.value.forEach(([c, s], k) => { if (list[c]?.outlet === p.name) { hot.add(k); picks.add(c); picks.add(s) } })
    plegma.setArticleLinks({ pairs: copyPairs.value, hot: p ? hot : null })
    // Each outlet's picks are a highlight of their own (the map keys its lit nodes by `story`).
    light(p ? { story: -(++seq), picks } : null)
  }
}
watch([which, copyPairs], ([v]) => plegma.setArticleLinks(v === 'copies' && copyPairs.value.length ? { pairs: copyPairs.value, hot: null } : null), { immediate: true })
onBeforeUnmount(() => { plegma.setArticleLinks(null); light(null) })
const colorOf = (outlet: string) => outletParts.value.find(p => p.name === outlet)?.color ?? 'var(--cat-0)'
</script>

<template>
  <div class="plegma-views">
    <SegmentedControl v-model="whichModel" class="orbit-ring-tabs is-chart plegma-views-switch" :label="t('story.views.label')" :options="options" />
    <PlegmaRing v-if="which === 'outlets'" :parts="outletParts" :middle="outlets.middle.value" :pointed="outlets.pointed" @hover="outlets.hover" />
    <PlegmaRing v-else-if="which === 'groups'" :parts="groupParts" :middle="groups.middle.value" :pointed="groups.pointed" :label="groups.label" @hover="groups.hover" />
    <PlegmaRing v-else-if="which === 'silence'" :parts="silenceParts" :sorted="false" :middle="silence.middle.value" :pointed="silence.pointed" :named="silence.named" :label="silence.label" @hover="silence.hover" />
    <template v-else-if="which === 'copies'">
      <PlegmaRing v-if="copyParts.length" :parts="copyParts" :middle="copies.middle.value" :pointed="copies.pointed" :label="copies.label" @hover="copies.hover" />
      <p v-else class="plegma-views-empty">{{ t('story.copies.none') }}</p>
    </template>
    <PlegmaSpeedChart v-else :articles="view.articles.value" :color-of="colorOf" @hover="s => light(s)" />
  </div>
</template>
