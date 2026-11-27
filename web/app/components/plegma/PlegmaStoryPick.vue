<script setup lang="ts">
import type { StoryView } from '~/composables/useStoryView'
import type { PlegmaHighlight } from '~/utils/plegma/plegma-articles'

// The outlets picked to follow on the Plegma: one, a few from anywhere, or all those of a group (a group on the left picks or drops its outlets at once).
// Their articles stay lit on the map while they are picked; what the pointer lights for a moment (a ring, a related story) comes back to them when it leaves.
// It opens as the date picker does (assets/date-range.css), from the top right of the story.
const props = defineProps<{ view: StoryView }>()
const { t } = useI18n()
const plegma = usePlegmaStore()
const open = ref(false)
const picked = ref(new Set<string>())
const short = (g: string | null) => (g ?? t('story.nogroup')).replace(/^(Συμφέροντα|Όμιλος)\s+/, '')

const outlets = computed(() => props.view.outletParts.value)
const groups = computed(() => props.view.groupParts.value.map(g => ({ ...g, outlets: outlets.value.filter(o => o.group === g.group).map(o => o.name) })).filter(g => g.outlets.length))
const has = (name: string) => picked.value.has(name)
const allOf = (names: string[]) => names.every(has)
const set = (next: Set<string>) => { picked.value = next }
const toggleOutlet = (name: string) => { const next = new Set(picked.value); if (!next.delete(name)) next.add(name); set(next) }
const toggleGroup = (names: string[]) => { const next = new Set(picked.value); const all = allOf(names); for (const n of names) if (all) next.delete(n); else next.add(n); set(next) }
const clear = () => set(new Set())

const chosen = computed(() => outlets.value.filter(o => has(o.name)))
const label = computed(() => (chosen.value.length === 0 ? t('story.pick.button') : chosen.value.length === 1 ? chosen.value[0]!.name : t('story.pick.count', { n: fmtInt(chosen.value.length) })))

// The pick as a highlight of its own (the map keys its lit nodes by `story`), set again whenever the highlight is let go.
let seq = 0
const lit = computed<PlegmaHighlight | null>(() => {
  if (!picked.value.size) return null
  const picks = new Set<number>()
  props.view.articles.value.forEach((a, k) => { if (picked.value.has(a.outlet)) picks.add(k) })
  return { story: -1_000_000 - (++seq), picks }
})
let last: PlegmaHighlight | null = null
const apply = (h: PlegmaHighlight | null) => {
  const mine = !plegma.highlight || toRaw(plegma.highlight) === last
  last = h
  if (mine) plegma.setHighlight(h)
}
watch(lit, apply)
watch(() => plegma.highlight, (h) => { if (!h && last) plegma.setHighlight(last) })
onBeforeUnmount(() => { if (last && toRaw(plegma.highlight) === last) plegma.setHighlight(null) })

const root = ref<HTMLElement | null>(null)
onMounted(() => {
  const away = (e: PointerEvent) => { if (open.value && root.value && !root.value.contains(e.target as Node)) open.value = false }
  const key = (e: KeyboardEvent) => { if (open.value && e.key === 'Escape') open.value = false }
  document.addEventListener('pointerdown', away)
  document.addEventListener('keydown', key)
  onBeforeUnmount(() => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', key) })
})
</script>

<template>
  <div ref="root" class="story-pick">
    <button type="button" class="dr-trigger story-pick-trigger" :class="{ 'is-picked': chosen.length }" aria-haspopup="dialog" :aria-expanded="tf(open)" @click="open = !open">
      <AppIcon name="arrows-right-left" class="icon dr-icon" />
      <span v-if="chosen.length" class="story-pick-dots" aria-hidden="true"><i v-for="o in chosen.slice(0, 6)" :key="o.name" :style="{ background: o.color }" /></span>
      <span class="dr-text">{{ label }}</span>
      <AppIcon name="chevron-down" class="icon icon-sm dr-chev" />
    </button>
    <div class="dr-pop story-pick-pop" role="dialog" :aria-label="t('story.pick.button')" :hidden="!open">
      <template v-if="open">
        <div class="dr-presets story-pick-groups">
          <p class="story-pick-head">{{ t('story.groups.title') }}</p>
          <button v-for="g in groups" :key="g.name" type="button" class="dr-preset story-pick-group" :aria-pressed="tf(allOf(g.outlets))" @click="toggleGroup(g.outlets)">
            <i class="story-pick-swatch" :style="{ background: g.color }" /><span class="story-pick-name">{{ short(g.group) }}</span><span class="story-pick-n">{{ fmtInt(g.outlets.length) }}</span>
          </button>
        </div>
        <div class="story-pick-main">
          <p class="story-pick-head">{{ t('story.ring.outlets') }}</p>
          <ul class="story-pick-outlets">
            <li v-for="o in outlets" :key="o.name">
              <button type="button" class="story-pick-outlet" :aria-pressed="tf(has(o.name))" @click="toggleOutlet(o.name)">
                <i class="story-pick-check" :style="{ '--c': o.color }" />
                <span class="story-pick-name">{{ o.name }}</span><span class="story-pick-n">{{ fmtInt(o.n) }}</span>
              </button>
            </li>
          </ul>
          <div class="story-pick-foot">
            <span>{{ t('story.pick.hint') }}</span>
            <button type="button" class="button story-pick-clear" :disabled="!chosen.length" @click="clear">{{ t('story.pick.clear') }}</button>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
