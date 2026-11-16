<script setup lang="ts">
import { useElementSize } from '@vueuse/core'
import { fmt2, nameSpot, netText, type NameBox, type PersonStance } from '~/utils/people'

// SpreadScatter of fingerprints-v2.html: one circle for each person, the mean stance across, how much the outlets disagree up, the mentions are the size.
const props = defineProps<{ people: PersonStance[] }>()
const { t } = useI18n()
const tooltip = useTooltipStore()

const holder = ref<HTMLElement | null>(null)
const { width: measured } = useElementSize(holder)
const width = computed(() => Math.floor(measured.value) || 640)
const height = 400
const pad = { l: 44, r: 16, t: 26, b: 44 }
const nmax = computed(() => Math.max(...props.people.map(p => p.mentions), 1))
const xmax = computed(() => Math.max(0.5, Math.ceil(Math.max(...props.people.map(p => Math.abs(p.mean))) * 4) / 4))
const ymax = computed(() => Math.max(0.2, Math.ceil(Math.max(...props.people.map(p => p.spread)) * 20) / 20))
const sx = (v: number) => pad.l + ((v + xmax.value) / (2 * xmax.value)) * (width.value - pad.l - pad.r)
const sy = (v: number) => height - pad.b - (v / ymax.value) * (height - pad.t - pad.b)
const radius = (p: PersonStance) => 5 + 9 * Math.sqrt(p.mentions / nmax.value)
const xTicks = computed(() => { const out: number[] = []; for (let v = -xmax.value; v <= xmax.value + 1e-9; v += 0.25) out.push(v); return out })
const yTicks = computed(() => { const out: number[] = []; for (let v = 0; v <= ymax.value + 1e-9; v += 0.05) out.push(v); return out })
const tip = (p: PersonStance) => t('fps.scatter.tip', { person: p.name, mean: netText(p.mean), spread: fmt2(p.spread), n: fmtInt(p.mentions) })

const dots = computed(() => props.people.slice().sort((a, b) => b.mentions - a.mentions))
const names = computed(() => {
  const placed: NameBox[] = props.people.map(p => ({ x0: sx(p.mean) - radius(p), x1: sx(p.mean) + radius(p), y0: sy(p.spread) - radius(p), y1: sy(p.spread) + radius(p) }))
  const free = (b: NameBox) => b.x0 >= 0 && b.x1 <= width.value && b.y0 >= 0 && !placed.some(q => b.x0 < q.x1 && b.x1 > q.x0 && b.y0 < q.y1 && b.y1 > q.y0)
  return dots.value.map((p) => {
    const spot = nameSpot(sx(p.mean), sy(p.spread), radius(p), p.short.length * 6.4, free)
    placed.push(spot.b)
    return { name: p.name, text: p.short, x: spot.x, y: spot.y, anchor: spot.anchor }
  })
})
</script>

<template>
  <div ref="holder" class="fit">
    <svg class="chart" :width="width" :height="height" :viewBox="`0 0 ${width} ${height}`" aria-hidden="true">
      <template v-for="v in xTicks" :key="`x${v}`">
        <line :class="Math.abs(v) < 1e-9 ? 'zero-line' : 'grid-line'" :x1="sx(v)" :x2="sx(v)" :y1="pad.t" :y2="height - pad.b" />
        <text :x="sx(v)" :y="height - pad.b + 16" text-anchor="middle">{{ netText(v) }}</text>
      </template>
      <template v-for="v in yTicks" :key="`y${v}`">
        <line class="grid-line" :x1="pad.l" :x2="width - pad.r" :y1="sy(v)" :y2="sy(v)" />
        <text :x="pad.l - 6" :y="sy(v) + 4" text-anchor="end">{{ fmt2(v) }}</text>
      </template>
      <text class="pt-label" :x="(pad.l + width - pad.r) / 2" :y="height - 6" text-anchor="middle">{{ t('fps.axis.mean') }}</text>
      <text class="q-label" :x="pad.l" y="14">{{ t('fps.axis.spread') }}</text>
      <circle
        v-for="p in dots" :key="p.name" class="pt" :cx="sx(p.mean)" :cy="sy(p.spread)" :r="radius(p)" :fill="p.mean < 0 ? 'var(--stance-critical)' : 'var(--stance-supportive)'" fill-opacity="0.55"
        style="stroke: var(--text-secondary); stroke-opacity: 0.55; stroke-width: 1"
        @pointerenter="tooltip.show({ title: tip(p) }, $event)" @pointermove="tooltip.show({ title: tip(p) }, $event)" @pointerleave="tooltip.hide()"
      />
      <text v-for="l in names" :key="l.name" class="pt-label" :x="l.x" :y="l.y" :text-anchor="l.anchor">{{ l.text }}</text>
    </svg>
    <div class="visually-hidden">
      <table>
        <caption>{{ t('fps.scatter.title') }}</caption>
        <tbody><tr v-for="p in people" :key="p.name"><td>{{ tip(p) }}</td></tr></tbody>
      </table>
    </div>
  </div>
</template>
