<script setup lang="ts">
import type { StoryView } from '~/composables/useStoryView'
import type { PlegmaHighlight } from '~/utils/plegma/plegma-articles'
import PlegmaRing from './PlegmaRing.vue'
import type { RingMiddle, RingPart } from './PlegmaRing.vue'

// The views of a story (a story with no profile), above the other stories, each under its name, not in a card: the ring of its outlets, the ring of its groups and the ring of the
// outlets that copied an earlier article of the story (Αντίγραφα, with the copies as lines on the map while one is pointed at). What the pointer is on lights its articles on the map.
const props = defineProps<{ view: StoryView }>()
const { t } = useI18n()
const plegma = usePlegmaStore()
const m = computed(() => props.view.model.value!)
const options = computed(() => [
  { value: 'outlets', label: t('story.ring.outlets') },
  { value: 'groups', label: t('story.groups.title') },
  { value: 'copies', label: t('story.views.copies') }
])
const short = (g: string | null) => (g ?? t('story.nogroup')).replace(/^(Συμφέροντα|Όμιλος)\s+/, '')

let lit: PlegmaHighlight | null = null
const light = (h: PlegmaHighlight | null) => {
  if (h) { lit = h; plegma.setHighlight(h) }
  else if (lit && toRaw(plegma.highlight) === lit) { lit = null; plegma.setHighlight(null) }
}

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
  hover: (p: RingPart | null) => light(p ? { group: p.group } : null)
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
  hover: (p: RingPart | null) => {
    const list = props.view.articles.value
    const hot = new Set<number>()
    const picks = new Set<number>()
    if (p) copyPairs.value.forEach(([c, s], k) => { if (list[c]?.outlet === p.name) { hot.add(k); picks.add(c); picks.add(s) } })
    plegma.setArticleLinks(p ? { pairs: copyPairs.value, hot } : null)
    // Each outlet's picks are a highlight of their own (the map keys its lit nodes by `story`).
    light(p ? { story: -(++seq), picks } : null)
  }
}
onBeforeUnmount(() => { plegma.setArticleLinks(null); light(null) })
</script>

<template>
  <div class="plegma-views">
    <section v-for="o in options" :key="o.value" class="plegma-view" :class="`is-${o.value}`">
      <h3 class="plegma-view-title">{{ o.label }}</h3>
      <PlegmaRing v-if="o.value === 'outlets'" :parts="outletParts" :middle="outlets.middle.value" :pointed="outlets.pointed" @hover="outlets.hover" />
      <PlegmaRing v-else-if="o.value === 'groups'" :parts="groupParts" :middle="groups.middle.value" :pointed="groups.pointed" @hover="groups.hover" />
      <template v-else>
        <PlegmaRing v-if="copyParts.length" :parts="copyParts" :middle="copies.middle.value" :pointed="copies.pointed" @hover="copies.hover" />
        <p v-else class="plegma-views-empty">{{ t('story.copies.none') }}</p>
      </template>
    </section>
  </div>
</template>
