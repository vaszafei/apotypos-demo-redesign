<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue'
import type { StoryView } from '~/composables/useStoryView'
import type { PlegmaArticle, PlegmaHighlight } from '~/utils/plegma/plegma-articles'
import PlegmaRing from './PlegmaRing.vue'
import type { RingMiddle, RingPart } from './PlegmaRing.vue'

// The views of a story (a story with no profile), above the other stories, each under its name, not in a card: the ring of its outlets alone on the first row, with their names, then the ring of its groups and the ring of the
// outlets that copied an earlier article of the story (Αντίγραφα, with the copies as lines on the map while one is pointed at). What the pointer is on lights its articles on the map.
const props = defineProps<{ view: StoryView }>()
const { t } = useI18n()
const plegma = usePlegmaStore()
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

// The outlets picked at the top right (PlegmaStoryPick.vue): the rings show only them, and their articles; none picked, all.
const inPick = (name: string | undefined) => !plegma.outletPick.size || (name !== undefined && plegma.outletPick.has(name))
// An outlet of no group picked with others of no group has a color of its own (stores/plegma.ts pickSlots).
const inkOf = (name: string, color: string) => { const slot = plegma.pickSlots.get(name); return slot ? `var(--cat-${slot})` : color }
// While the web is zoomed, only the articles in view (stores/plegma.ts viewSpan) count.
const inSpan = (time: number | undefined) => !plegma.viewSpan || (time !== undefined && time >= plegma.viewSpan.from && time <= plegma.viewSpan.to)
const spanCounts = computed(() => {
  if (!plegma.viewSpan) return null
  const by = new Map<string, number>()
  for (const a of props.view.articles.value) if (inSpan(a.time)) by.set(a.outlet, (by.get(a.outlet) ?? 0) + 1)
  return by
})
const outletParts = computed<RingPart[]>(() => props.view.outletParts.value.filter(p => inPick(p.name))
  .map(p => ({ key: p.name, name: p.name, group: p.group, n: spanCounts.value ? spanCounts.value.get(p.name) ?? 0 : p.n, color: inkOf(p.name, p.color) })).filter(p => p.n > 0))
const total = computed(() => outletParts.value.reduce((s, p) => s + p.n, 0))
const storyTotal = computed(() => props.view.outletParts.value.reduce((s, p) => s + p.n, 0))
const articlesFact = computed(() => fmtInt(total.value))
const outlets = {
  middle: computed<RingMiddle>(() => ({ big: articlesFact.value, bigCap: t('entity.fact.articles'), line: fmtInt(outletParts.value.length), cap: t('entity.fact.outlets') })),
  pointed: (p: RingPart): RingMiddle => ({ big: fmtInt(p.n), bigCap: t('entity.fact.articles'), line: p.name, cap: short(p.group) }),
  hover: (p: RingPart | null) => light(p ? { group: p.group, outlet: p.name } : null)
}
const groupParts = computed<RingPart[]>(() => {
  const by = new Map<string | null, number>()
  for (const p of outletParts.value) by.set(p.group, (by.get(p.group) ?? 0) + p.n)
  return props.view.groupParts.value.filter(p => by.has(p.group)).map(p => ({ key: p.name, name: p.name, group: p.group, n: by.get(p.group)!, color: p.color }))
})
const groups = {
  // No count of articles here (the ring of the outlets has it): the number of groups, or the share of the one group of the pick or of the group pointed at, with its name.
  middle: computed<RingMiddle>(() => (plegma.outletPick.size && groupParts.value.length === 1
    ? { big: fmtPct(total.value / Math.max(1, storyTotal.value)), bigCap: t('story.copies.share'), line: short(groupParts.value[0]!.group), cap: '' }
    : { big: fmtInt(groupParts.value.length), bigCap: t('story.groups.title'), line: '', cap: '' })),
  pointed: (p: RingPart): RingMiddle => ({ big: fmtPct(p.n / Math.max(1, total.value)), bigCap: t('story.copies.share'), line: short(p.name), cap: '' }),
  hover: (p: RingPart | null) => light(p ? { group: p.group } : null)
}
// Αντίγραφα: the outlets that published a copy of an earlier article of another outlet, by their copies; under the pointer, their copies and the articles they copy are lit, with the lines between them.
let seq = 0
const copyPairs = computed(() => (props.view.copies.value ?? []).filter(([c]) => inPick(props.view.articles.value[c]?.outlet) && inSpan(props.view.articles.value[c]?.time)))
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
// The outlet of Αντίγραφα pointed at stays while the pointer goes from the ring to the list of its copies beside it (and while it is on the list).
const copyOn = ref<RingPart | null>(null)
const focus = ref<number | null>(null)
let overList = false
let copyTimer: ReturnType<typeof setTimeout> | undefined
// Its copies, in the order of the badges on the map (stage-articles.ts drawCopyMarks): each with the article it copies.
const copyRows = computed(() => {
  const p = copyOn.value
  if (!p) return []
  const list = props.view.articles.value
  return copyPairs.value.map(([c, s], k) => ({ k, c, s, copy: list[c]!, source: list[s]! }))
    .filter(r => r.copy?.outlet === p.name && r.source && r.copy.time !== undefined).sort((u, v) => u.c - v.c)
})
const when = (m: number | undefined) => (m === undefined ? '' : `${fmtDay(athensDate(m))}, ${athensClock(m)}`)
const ink = (a: PlegmaArticle) => `var(--cat-${plegma.inkSlot(a)})`
const copies = {
  middle: computed<RingMiddle>(() => ({ big: fmtInt(copyPairs.value.length), bigCap: t('story.copies.big'), line: fmtPct(copyPairs.value.length / Math.max(1, total.value)), cap: t('story.copies.share') })),
  pointed: (p: RingPart): RingMiddle => ({ big: fmtInt(p.n), bigCap: t('story.copies.big'), line: p.name, cap: '' }),
  hover: (p: RingPart | null) => {
    clearTimeout(copyTimer)
    if (p) { copyOn.value = p; return }
    copyTimer = setTimeout(() => { if (!overList) copyOn.value = null }, 300)
  }
}
const enterList = () => { overList = true; clearTimeout(copyTimer) }
const leaveList = () => { overList = false; focus.value = null; copyOn.value = null }
watch([copyOn, focus], ([p, f]) => {
  const list = props.view.articles.value
  const hot = new Set<number>()
  const picks = new Set<number>()
  // All its copies stay hot (the badges keep their numbers); the one pointed at in the list alone is lit.
  if (p) copyPairs.value.forEach(([c, s], k) => { if (list[c]?.outlet !== p.name) return; hot.add(k); if (f === null || f === k) { picks.add(c); picks.add(s) } })
  plegma.setArticleLinks(p ? { pairs: copyPairs.value, hot, focus: f } : null)
  // Each outlet's picks are a highlight of their own (the map keys its lit nodes by `story`).
  light(p ? { story: -(++seq), picks } : null)
})
watch(copyParts, () => { copyOn.value = null; focus.value = null })
const open = (c: number) => { leaveList(); plegma.read(c) }
// The list goes up from the ring as far as the top bar.
const fitList = (el: Element | ComponentPublicInstance | null) => {
  if (!(el instanceof HTMLElement)) return
  const top = el.parentElement!.getBoundingClientRect().top + 18
  const bar = document.querySelector('.header-bar')?.getBoundingClientRect().bottom ?? 0
  el.style.setProperty('--room', `${Math.max(160, top - bar - 8)}px`)
}
onBeforeUnmount(() => { clearTimeout(copyTimer); plegma.setArticleLinks(null); light(null) })
</script>

<template>
  <div class="plegma-views">
    <section v-for="o in options" :key="o.value" class="plegma-view" :class="`is-${o.value}`">
      <h3 class="plegma-view-title">{{ o.label }}</h3>
      <PlegmaRing v-if="o.value === 'outlets'" labels :parts="outletParts" :middle="outlets.middle.value" :pointed="outlets.pointed" @hover="outlets.hover" />
      <PlegmaRing v-else-if="o.value === 'groups'" :parts="groupParts" :middle="groups.middle.value" :pointed="groups.pointed" @hover="groups.hover" />
      <template v-else>
        <PlegmaRing v-if="copyParts.length" :parts="copyParts" :middle="copies.middle.value" :pointed="copies.pointed" @hover="copies.hover" />
        <p v-else class="plegma-views-empty">{{ t('story.copies.none') }}</p>
        <div v-if="copyOn && copyRows.length" :ref="fitList" class="tooltip is-rich is-field copy-list" @pointerenter="enterList" @pointerleave="leaveList">
          <div class="tooltip-title">{{ copyOn.name }} · {{ fmtInt(copyRows.length) }} {{ t('story.copies.big') }}</div>
          <ol class="copy-list-rows">
            <li v-for="(r, n) in copyRows" :key="r.k">
              <button type="button" class="copy-list-row" :class="{ 'is-on': focus === r.k }" :title="t('story.article.open')" @pointerenter="focus = r.k" @pointerleave="focus = null" @click="open(r.c)">
                <span class="copy-list-n" :style="{ background: ink(r.copy) }">{{ n + 1 }}</span>
                <span class="copy-list-body">
                  <span class="copy-list-title">{{ r.copy.title || r.copy.outlet }}</span>
                  <span class="copy-list-meta">{{ when(r.copy.time) }}</span>
                  <span class="copy-list-source"><span class="swatch" :style="{ background: ink(r.source) }" />{{ t('story.copies.of', { outlet: r.source.outlet }) }}, {{ when(r.source.time) }}</span>
                  <span v-if="r.source.title" class="copy-list-meta copy-list-clip">{{ r.source.title }}</span>
                </span>
              </button>
            </li>
          </ol>
        </div>
      </template>
    </section>
  </div>
</template>
