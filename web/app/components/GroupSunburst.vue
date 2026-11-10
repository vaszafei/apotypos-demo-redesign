<script setup lang="ts" generic="G extends SunGroup">
import type { NetGroup } from '~/utils/groups'

// Sunburst of groups-v2.html: the inner ring is the groups, the outer ring their outlets. The rings are in the order of the legend, from the top, clockwise.
// The list on its side has the group, its share and the owner in the title of its row. The story page (Entity.GroupsCard) has no title on the row and gives
// the name of the group (slot name) and a line of its outlets (slot sub) of its own.
export type SunGroup = Pick<NetGroup, 'key' | 'label' | 'color' | 'value'> & Partial<Pick<NetGroup, 'owner' | 'slug'>> & { outlets: { name: string, slug: string, value: number }[] }
const props = defineProps<{ groups: G[], total: number }>()
defineSlots<{ name?: (p: { group: G }) => unknown, sub?: (p: { group: G }) => unknown }>()
const { t } = useI18n()
const tooltip = useTooltipStore()

const size = 176
const c = size / 2
const rings = [[44, 65], [67, 87]] as const
const pad = 0.008
const point = (a: number, r: number) => `${(c + r * Math.sin(a)).toFixed(2)} ${(c - r * Math.cos(a)).toFixed(2)}`
const arc = (a0: number, a1: number, r0: number, r1: number) => {
  a0 += pad / 2
  a1 = Math.max(a0 + 0.002, a1 - pad / 2)
  const large = a1 - a0 > Math.PI ? 1 : 0
  return `M${point(a0, r1)}A${r1} ${r1} 0 ${large} 1 ${point(a1, r1)}L${point(a1, r0)}A${r0} ${r0} 0 ${large} 0 ${point(a0, r0)}Z`
}
const slices = computed(() => {
  const out: { key: string, d: string, fill: string, tip: string }[] = []
  let a = 0
  for (const g of props.groups) {
    const span = (g.value / props.total) * 2 * Math.PI
    out.push({ key: `g-${g.key ?? 'none'}`, d: arc(a, a + span, ...rings[0]), fill: g.color, tip: t('g2.donut.tip', { group: g.label, n: fmtInt(g.value), share: fmtPct(g.value / props.total) }) })
    let b = a
    for (const o of g.outlets) {
      const s = (o.value / props.total) * 2 * Math.PI
      out.push({ key: `o-${o.slug}`, d: arc(b, b + s, ...rings[1]), fill: tintOf(g.color, g.key === null ? 0.45 : 0.4), tip: t('g2.tree.tip', { outlet: o.name, group: g.label, n: fmtInt(o.value), share: fmtPct(o.value / props.total) }) })
      b += s
    }
    a += span
  }
  return out
})
const label = computed(() => props.groups.map(g => `${g.label} ${fmtPct(g.value / props.total)}`).join(', '))
const rowTitle = (g: SunGroup) => (g.key === null ? t('g2.bubble.none', { n: fmtInt(g.outlets.length) }) : `${g.owner} · ${t('g2.bubble.outlets', { n: fmtInt(g.outlets.length) })}`)
const show = (tip: string, e: PointerEvent) => tooltip.show({ title: tip }, e)
</script>

<template>
  <div class="donut-wrap sun-wrap">
    <ul class="rows rows-groups rows-owners">
      <li v-for="g in groups" :key="g.key ?? 'none'" :title="$slots.name ? undefined : rowTitle(g)">
        <span :class="g.key === null ? 'dot dot-none' : 'dot'" :style="`--dot:${g.color}`" aria-hidden="true" />
        <span class="row-name" :title="$slots.name ? undefined : g.label">
          <slot name="name" :group="g">
            <template v-if="g.key === null">{{ g.label }}</template>
            <NuxtLink v-else class="quiet-link" :to="groupPageHref(g.slug!)">{{ g.label }}</NuxtLink>
          </slot>
        </span>
        <span class="row-value">{{ fmtPct(g.value / total) }}</span>
        <span v-if="$slots.sub" class="row-sub"><slot name="sub" :group="g" /></span>
      </li>
    </ul>
    <svg class="chart donut sunburst" :width="size" :height="size" :viewBox="`0 0 ${size} ${size}`" role="img" :aria-label="label">
      <path v-for="s in slices" :key="s.key" class="slice" :d="s.d" :fill="s.fill" @pointerenter="show(s.tip, $event)" @pointermove="show(s.tip, $event)" @pointerleave="tooltip.hide()" />
      <text class="donut-num" :x="c" :y="c + 3" text-anchor="middle">{{ fmtInt(total) }}</text>
      <text :x="c" :y="c + 19" text-anchor="middle">{{ t('g2.donut.center') }}</text>
    </svg>
  </div>
</template>
