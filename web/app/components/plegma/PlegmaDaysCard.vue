<script setup lang="ts">
import { useWindowSize } from '@vueuse/core'
import type { StoryView } from '~/composables/useStoryView'
import { storySteps } from '~/utils/plegma/story-steps'
import type { PlegmaHighlight } from '~/utils/plegma/plegma-articles'

// Articles per day of the story, as one line (the lines of Ιστορίες στο χρόνο, for this story alone).
// A story with article times is counted per step of time that fits it (#219), as a line or as columns by group or by outlet (#220); a click on a step lights its articles on the map.
const props = defineProps<{ view: StoryView }>()
const { t } = useI18n()
const plegma = usePlegmaStore()
const v = props.view
const m = computed(() => v.model.value!)
// The chart is wide, so it needs little height: the cards under it have to show all their data.
const { height } = useWindowSize()
const tall = computed(() => Math.round(Math.min(300, Math.max(110, height.value * 0.12))))
const series = computed(() => [{ key: String(m.value.story.id), name: storyName(m.value.story), color: 'var(--cat-1)', values: m.value.perDay.slice(m.value.lo, m.value.hi + 1) }])

const steps = computed(() => (v.timed.value ? storySteps(v.articles.value) : null))
const mode = ref<'line' | 'groups' | 'outlets'>('line')
const modeModel = computed({ get: () => mode.value, set: (x: string) => { mode.value = x === 'groups' || x === 'outlets' ? x : 'line' } })
const picked = ref<number | null>(null)
let lit: PlegmaHighlight | null = null
const pick = (k: number | null) => {
  const s = k === null ? null : steps.value?.steps[k]
  picked.value = s ? k : null
  lit = s ? { from: s.from, to: s.to } : null
  plegma.setHighlight(lit)
}
// Another card or the map lighting something else lets the pick go; so does another story.
watch(() => plegma.highlight, h => { if (toRaw(h) !== lit) { picked.value = null; lit = null } })
watch(steps, () => { if (picked.value !== null) pick(null) })
</script>

<template>
  <DashCard :title="t('story.time.title')" :info="steps ? t('story.time.info') : t('story.daily.info')">
    <template v-if="steps" #tools>
      <SegmentedControl v-model="modeModel" class="orbit-ring-tabs is-chart" :label="t('story.time.mode')" :options="[{ value: 'line', label: t('story.time.line') }, { value: 'groups', label: t('story.time.groups') }, { value: 'outlets', label: t('story.time.outlets') }]" />
    </template>
    <StepsChart v-if="steps" :steps="steps.steps" :step="steps.step" :mode="mode" :picked="picked" :tall="tall" :caption="t('story.time.title')" :group-name="g => g || t('story.nogroup')" @pick="pick" />
    <LinesChart v-else :dates="v.shown.value" :series="series" plain :tall="tall" :caption="t('story.time.title')" :href-of="s => storyHref(s.key)" />
  </DashCard>
</template>
