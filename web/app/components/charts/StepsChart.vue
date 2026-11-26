<script setup lang="ts">
import { useElementSize } from '@vueuse/core'
import { stepParts, type StoryStep } from '~/utils/plegma/story-steps'

// The articles of a story per step of time (utils/plegma/story-steps.ts): one line, with stacked columns by group or by outlet in the group colours under it.
// A click on a step picks it (a second click lets it go): the step is tinted and gets a dot, and its column stays in full colour while the others fade.
const props = defineProps<{ steps: StoryStep[], step: number, mode: 'line' | 'groups' | 'outlets', picked: number | null, tall: number, caption: string, groupName: (g: string | null) => string }>()
const emit = defineEmits<{ pick: [k: number | null] }>()
const { t } = useI18n()
const tooltip = useTooltipStore()

const holder = ref<HTMLElement | null>(null)
const { width: measured } = useElementSize(holder)
const width = computed(() => Math.floor(measured.value) || 640)
const height = computed(() => props.tall)
const pad = { top: 10, right: 12, bottom: 24, left: 44 }
const n = computed(() => props.steps.length)
const plotW = computed(() => width.value - pad.left - pad.right)
const plotH = computed(() => height.value - pad.top - pad.bottom)
const bars = computed(() => props.mode !== 'line')

const peak = computed(() => Math.max(...props.steps.map(s => s.n), 1))
const tickStep = computed(() => niceStep(peak.value / 4))
const yMax = computed(() => Math.ceil(peak.value / tickStep.value) * tickStep.value)
const ticks = computed(() => { const out: number[] = []; for (let v = 0; v <= yMax.value; v += tickStep.value) out.push(v); return out })
// Each step has a slot; the line passes through the middle of each slot, over the top of its column.
const slotW = computed(() => plotW.value / Math.max(n.value, 1))
const X = (k: number) => pad.left + (k + 0.5) * slotW.value
const Y = (v: number) => pad.top + plotH.value - (v / yMax.value) * plotH.value

const day = computed(() => props.step >= 1440)
const when = (s: StoryStep) => (day.value ? fmtDay(s.date) : `${fmtDay(s.date)}, ${s.clock}`)
// The labels are at least 72 px apart; a new day writes its date and the clock, the same day only the clock. A label that would touch the one before it, or the edge, is left out.
const xTicks = computed(() => {
  const every = Math.max(1, Math.ceil(72 / Math.max(slotW.value, 1)))
  const out: { k: number, text: string }[] = []
  let last = ''
  let right = -Infinity
  for (let k = 0; k < n.value; k += every) {
    const s = props.steps[k]!
    const text = day.value || s.date === last ? (day.value ? fmtDay(s.date) : s.clock) : when(s)
    const half = text.length * 3.3
    if (X(k) - half < right + 10 || X(k) + half > width.value) continue
    out.push({ k, text })
    last = s.date
    right = X(k) + half
  }
  return out
})

const linePath = computed(() => smoothPath(props.steps.map(s => [X(s.k), Y(s.n)] as [number, number])))
const colourOf = (slot: number) => `var(--cat-${slot})`
const colW = computed(() => Math.min(18, Math.max(2, slotW.value * 0.72)))
const columns = computed(() => {
  if (!bars.value) return []
  const by = props.mode === 'groups' ? 'groups' : 'outlets'
  return props.steps.filter(s => s.n).map((s) => {
    let acc = 0
    const list = stepParts(s, by)
    return { k: s.k, rects: list.map((p) => {
      const y1 = Y(acc)
      acc += p.n
      const y0 = Y(acc)
      return { key: p.key, y: y0, h: Math.max(0.5, y1 - y0 - (list.length > 1 ? 1 : 0)), fill: colourOf(p.slot) }
    }) }
  })
})
const band = computed(() => {
  if (props.picked === null || !props.steps[props.picked]) return null
  const w = Math.max(3, slotW.value)
  return { x: Math.max(pad.left, X(props.picked) - w / 2), width: w }
})

const stepAt = (e: PointerEvent | MouseEvent) => {
  const box = (e.currentTarget as SVGElement).ownerSVGElement!.getBoundingClientRect()
  const x = e.clientX - box.left - pad.left
  const k = Math.floor(x / slotW.value)
  return Math.max(0, Math.min(n.value - 1, k))
}
const hover = ref<number | null>(null)
const read = (e: PointerEvent) => {
  const k = stepAt(e)
  hover.value = k
  const s = props.steps[k]!
  const rows = stepParts(s, props.mode === 'outlets' ? 'outlets' : 'groups').sort((a, b) => b.n - a.n)
  tooltip.show({
    title: t('story.daily.tip', { date: day.value ? fmtDate(s.date) : `${fmtDate(s.date)}, ${s.clock}`, n: fmtInt(s.n) }),
    rows: rows.map(p => ({ label: props.mode === 'outlets' ? p.name : props.groupName(p.group), value: fmtInt(p.n), color: colourOf(p.slot) }))
  }, e)
}
const leave = () => { hover.value = null; tooltip.hide() }
const click = (e: MouseEvent) => { const k = stepAt(e); emit('pick', props.steps[k]!.n && k !== props.picked ? k : null) }
</script>

<template>
  <div ref="holder" class="fit">
    <svg class="chart line-draw" :width="width" :height="height" :viewBox="`0 0 ${width} ${height}`" role="img" :aria-label="caption">
      <template v-for="v in ticks" :key="v">
        <line class="grid-line" :x1="pad.left" :x2="width - pad.right" :y1="Y(v)" :y2="Y(v)" />
        <text :x="pad.left - 6" :y="Y(v) + 4" text-anchor="end">{{ fmtInt(v) }}</text>
      </template>
      <text v-for="x in xTicks" :key="x.k" :x="X(x.k)" :y="height - 6" text-anchor="middle">{{ x.text }}</text>
      <rect v-if="band" class="line-band" :x="band.x" :y="pad.top" :width="band.width" :height="plotH" />
      <g v-if="bars">
        <g v-for="c in columns" :key="c.k" :opacity="picked !== null && picked !== c.k ? 0.3 : 0.75">
          <rect v-for="r in c.rects" :key="r.key" :x="X(c.k) - colW / 2" :y="r.y" :width="colW" :height="r.h" :fill="r.fill" />
        </g>
      </g>
      <path class="line-series" :d="linePath" stroke="var(--cat-1)" stroke-width="1.5" fill="none" pathLength="1" />
      <circle v-if="band" :cx="X(picked!)" :cy="Y(steps[picked!]!.n)" r="4" fill="var(--cat-1)" stroke="var(--surface-page)" stroke-width="1.5" />
      <line class="hover-rule" :y1="pad.top" :y2="pad.top + plotH" stroke="var(--rule)" stroke-width="1" :x1="hover !== null ? X(hover) : 0" :x2="hover !== null ? X(hover) : 0" :visibility="hover !== null ? 'visible' : 'hidden'" />
      <circle r="3.5" fill="var(--cat-1)" stroke="var(--surface-page)" stroke-width="1.5" :cx="hover !== null ? X(hover) : 0" :cy="hover !== null ? Y(steps[hover]!.n) : 0" :visibility="hover !== null ? 'visible' : 'hidden'" />
      <rect :x="pad.left" :y="pad.top" :width="plotW" :height="plotH" fill="transparent" style="cursor: pointer" @pointermove="read" @pointerenter="read" @pointerleave="leave" @click="click" />
    </svg>
    <div class="visually-hidden">
      <table>
        <caption>{{ caption }}</caption>
        <tbody><tr v-for="s in steps.filter(x => x.n)" :key="s.k"><th scope="row">{{ when(s) }}</th><td>{{ fmtInt(s.n) }}</td></tr></tbody>
      </table>
    </div>
  </div>
</template>
