<script setup lang="ts">
import { useElementSize } from '@vueuse/core'
import type { NetGroup, NetOutlet } from '~/utils/groups'
import { round, type OutletNode } from '~/utils/net-layout'

// OwnerBubbles of groups-v2.html: a network of owners and outlets. Nothing moves and nothing opens: a hover on a group or an outlet fades the other groups and its numbers are in the tooltip.
// A click on a group opens its page and a click on an outlet opens its page. An outlet has its name inside its circle when it fits and beside it when there is room.
// `fill`: the network fills the height of its box (a screen of the Plegma, Μέσα › Ιδιοκτησία) instead of a height from its width, and with `stance` the groups stand from left to right by their stance (critical to supportive).
const props = defineProps<{ groups: NetGroup[], total: number, fill?: boolean, stance?: boolean }>()
const { t } = useI18n()
const tooltip = useTooltipStore()
const inkOf = useInk()

const holder = ref<HTMLElement | null>(null)
const { width: measured, height: measuredH } = useElementSize(holder)
const width = computed(() => Math.floor(measured.value) || 640)
const height = computed(() => (props.fill && measuredH.value > 200 ? Math.floor(measuredH.value) : Math.max(300, Math.min(440, Math.round(width.value * 0.56)))))
// The place of a group, or of an outlet without a group, on the axis: the supportive share minus the critical one of its analysed articles (none under 30 of them).
const stanceAxis = (outlets: NetOutlet[]) => {
  const [critical, neutral, supportive] = stanceTotals(outlets)
  const n = critical + neutral + supportive
  return n >= 30 ? (supportive - critical) / n : null
}
const layout = computed(() => netLayout(props.groups, width.value, height.value, !!props.fill, props.fill && props.stance ? stanceAxis : undefined))

const hover = ref<NetGroup | null>(null)
const tint = (g: NetGroup) => tintOf(g.color, g.key === null ? 0.5 : 0.35)

const stanceRows = (stance: [number, number, number]) => {
  const n = stance[0] + stance[1] + stance[2]
  return n >= 30
    ? [{ label: t('stance.critical'), value: fmtPct(stance[0] / n), color: 'var(--stance-critical)' }, { label: t('stance.supportive'), value: fmtPct(stance[2] / n), color: 'var(--stance-supportive)' }]
    : [{ label: t('group.col.stance'), value: t('stance.few', { n: 30 }) }]
}
const groupTip = (g: NetGroup) => {
  const stance = stanceTotals(g.outlets)
  const news = g.outlets.reduce((a, o) => a + o.news, 0) / (g.outlets.reduce((a, o) => a + o.analysed, 0) || 1)
  return {
    title: g.label,
    rows: [
      ...(g.key === null ? [] : [{ label: t('groups.col.owner'), value: g.owner ?? '' }, { label: t('groups.col.lean'), value: g.lean || t('groups.lean.none') }]),
      { label: t('groups.col.articles'), value: `${fmtInt(g.value)} · ${fmtPct(g.value / props.total)}` },
      { label: t('groups.col.outlets'), value: fmtInt(g.outlets.length) },
      { label: t('media.col.news'), value: fmtPct(news) },
      ...stanceRows(stance)
    ]
  }
}
const outletTip = (o: NetOutlet, g: NetGroup) => ({
  title: `${o.name} · ${g.label}`,
  rows: [
    { label: t('groups.col.articles'), value: `${fmtInt(o.value)} · ${fmtPct(o.value / props.total)}` },
    { label: t('g2.bubble.ofgroup', { share: '' }).trim(), value: fmtPct(o.value / g.value) },
    { label: t('media.col.news'), value: fmtPct(o.news / (o.analysed || 1)) },
    ...stanceRows(o.stance)
  ]
})
const plain = (tip: { title: string, rows: { label: string, value: string }[] }) => `${tip.title}: ${tip.rows.map(r => `${r.label} ${r.value}`).join(', ')}`

const groupHref = (g: NetGroup) => groupPageHref(g.slug!)
// A page that is ported is a route of the app, the others are static files.
const open = (href: string) => navigateTo(href, { external: !portedPath(href) })

interface Label { key: string, g: NetGroup, text: string, x: number, y: number, anchor: 'start' | 'middle' | 'end', kind: 'group' | 'outlet' | 'inner' | 'share', ink?: string }
// The names. A name in a circle needs the circle to be wide enough; a name beside a circle goes away from its group and is left out where it would touch another name or a circle.
const labels = computed<Label[]>(() => {
  const { nodes, clusters } = layout.value
  const [w0, h0] = [width.value, height.value]
  const out: Label[] = []
  const boxes: { x0: number, x1: number, y0: number, y1: number }[] = []
  const hit = (x0: number, x1: number, y0: number, y1: number) => boxes.some(b => x0 < b.x1 && b.x0 < x1 && y0 < b.y1 && b.y0 < y1)
    || nodes.some((o) => { const nx = Math.max(x0, Math.min(o.x, x1)); const ny = Math.max(y0, Math.min(o.y, y1)); return Math.hypot(o.x - nx, o.y - ny) < o.r })
  // The name of a group stands next to its node, where the box is free of circles and names, and at the edge of its cluster if there is no such place.
  for (const c of clusters) {
    if (c.solo) continue
    const name = shortName(c.g.label)
    const w = name.length * 6.9
    const hub = nodes.find(n => n.kind === 'hub' && n.g === c.g)!
    const ang = Math.atan2(c.y - h0 / 2, c.x - w0 / 2)
    const near = [[0, 1], [0, -1], [1, 0], [-1, 0], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]].map(([ux, uy]) => [ux!, uy!, hub.x, hub.y, hub.r + 5] as const)
    const far = [[Math.cos(ang), Math.sin(ang)], [0, -1], [0, 1], [-1, 0], [1, 0]].map(([ux, uy]) => [ux!, uy!, c.x, c.y, c.R + 8] as const)
    for (const [ux, uy, ox, oy, gap] of [...near, ...far]) {
      const anchor = Math.abs(ux) < 0.4 ? 'middle' : ux > 0 ? 'start' : 'end'
      const x = ox + ux * gap
      const y = oy + uy * gap + (uy > 0.4 ? 11 : uy < -0.4 ? -3 : 4)
      const x0 = anchor === 'middle' ? x - w / 2 : anchor === 'start' ? x : x - w
      if (x0 < 2 || x0 + w > w0 - 2 || y - 12 < 0 || y + 3 > h0 || hit(x0, x0 + w, y - 12, y + 3)) continue
      boxes.push({ x0, x1: x0 + w, y0: y - 12, y1: y + 3 })
      out.push({ key: `g-${c.g.key ?? 'none'}`, g: c.g, text: name, x: round(x), y: round(y), anchor, kind: 'group' })
      break
    }
  }
  const outlets = nodes.filter((n): n is OutletNode => n.kind === 'outlet').sort((a, b) => b.r - a.r)
  for (const n of outlets) {
    const name = n.o.name
    const w = name.length * 6.3
    if (n.r * 2 >= w + 8 && n.r >= 13) {
      const two = n.r >= 24
      const ink = inkOf(n.g.color, n.g.key === null ? 0.5 : 0.35)
      out.push({ key: `i-${n.o.slug}`, g: n.g, text: name, x: n.x, y: n.y + (two ? -2 : 4), anchor: 'middle', kind: 'inner', ink })
      if (two) out.push({ key: `s-${n.o.slug}`, g: n.g, text: fmtPct(n.o.value / props.total), x: n.x, y: n.y + 13, anchor: 'middle', kind: 'share', ink })
      boxes.push({ x0: n.x - w / 2, x1: n.x + w / 2, y0: n.y - 10, y1: n.y + 16 })
      continue
    }
    const hub = nodes.find(o => o.kind === 'hub' && o.g === n.g)
    const ang = Math.atan2(n.y - (hub?.y ?? h0 / 2), n.x - (hub?.x ?? w0 / 2))
    // The name goes away from the group first, then to the other sides, and is left out only when every side is taken (more names are shown, never a name over a circle or another name).
    const sides = [Math.cos(ang) >= 0 ? 1 : -1, Math.cos(ang) >= 0 ? -1 : 1] as const
    let placed = false
    for (const side of sides) {
      const x = n.x + side * (n.r + 4)
      const y = n.y + 4
      const x0 = side > 0 ? x : x - w
      const x1 = side > 0 ? x + w : x
      if (x0 < 2 || x1 > w0 - 2 || hit(x0, x1, y - 12, y + 4)) continue
      boxes.push({ x0, x1, y0: y - 12, y1: y + 4 })
      out.push({ key: `o-${n.o.slug}`, g: n.g, text: name, x: round(x), y: round(y), anchor: side > 0 ? 'start' : 'end', kind: 'outlet' })
      placed = true
      break
    }
    if (placed) continue
    for (const dy of [-1, 1]) {
      const y = n.y + dy * (n.r + 4) + (dy > 0 ? 11 : -3)
      const x0 = n.x - w / 2
      if (x0 < 2 || x0 + w > w0 - 2 || y - 12 < 0 || y + 3 > h0 || hit(x0, x0 + w, y - 12, y + 3)) continue
      boxes.push({ x0, x1: x0 + w, y0: y - 12, y1: y + 3 })
      out.push({ key: `o-${n.o.slug}`, g: n.g, text: name, x: round(n.x), y: round(y), anchor: 'middle', kind: 'outlet' })
      break
    }
  }
  return out
})

// The order of a group, for the arrival of its nodes one group after the other (assets/css/plegma.css .net-fill).
const orderOf = (g: NetGroup) => props.groups.indexOf(g)
const cls = (g: NetGroup) => ['net-el', { 'is-dim': hover.value !== null && g !== hover.value, 'is-active': g === hover.value }]
const enter = (g: NetGroup) => { hover.value = g }
const leave = () => { hover.value = null }
const showTip = (tip: { title: string, rows: { label: string, value: string, color?: string }[] }, e: PointerEvent) => tooltip.show(tip, e)
</script>

<template>
  <div ref="holder" :class="fill ? 'fit net-fill' : 'fit'">
    <svg class="chart net" :width="width" :height="height" :viewBox="`0 0 ${width} ${height}`" role="group" :aria-label="t('g2.tree.title')">
      <g>
        <line v-for="l in layout.links" :key="l.b.o.slug" :class="['net-edge', cls(l.b.g)]" :style="{ '--g': orderOf(l.b.g) }" :x1="l.a.x" :y1="l.a.y" :x2="l.b.x" :y2="l.b.y" :stroke="l.b.g.color" />
      </g>
      <g>
        <template v-for="n in layout.nodes" :key="n.kind === 'hub' ? `h-${n.g.key ?? 'none'}` : `o-${n.o.slug}`">
          <circle
            v-if="n.kind === 'hub'" :class="['net-hub', cls(n.g)]" :cx="n.x" :cy="n.y" :r="n.r" :fill="n.g.color" stroke="var(--surface-page)" stroke-width="2"
            :tabindex="n.g.slug ? 0 : undefined" :role="n.g.slug ? 'link' : undefined" :aria-label="plain(groupTip(n.g))" :style="n.g.slug ? { '--g': orderOf(n.g) } : { '--g': orderOf(n.g), cursor: 'default' }"
            @pointerenter="enter(n.g); showTip(groupTip(n.g), $event)" @pointermove="showTip(groupTip(n.g), $event)" @pointerleave="leave(); tooltip.hide()"
            @click="n.g.slug && open(groupHref(n.g))" @keydown.enter="n.g.slug && open(groupHref(n.g))"
            @focus="n.g.slug && enter(n.g)" @blur="n.g.slug && leave()"
          />
          <circle
            v-else :class="['net-outlet', cls(n.g)]" :cx="n.x" :cy="n.y" :r="n.r" :fill="tint(n.g)" :stroke="n.g.color" stroke-width="1.2" :style="{ '--g': orderOf(n.g) }"
            @pointerenter="enter(n.g); showTip(outletTip(n.o, n.g), $event)" @pointermove="showTip(outletTip(n.o, n.g), $event)" @pointerleave="leave(); tooltip.hide()"
            @click="n.o.slug && open(outletHref(n.o.slug))"
          />
        </template>
      </g>
      <g v-if="fill && stance" class="net-axis" aria-hidden="true">
        <line x1="2" :x2="width - 2" :y1="height - 8" :y2="height - 8" />
        <text x="2" :y="height - 13" text-anchor="start">← {{ t('stance.critical') }}</text>
        <text :x="width - 2" :y="height - 13" text-anchor="end">{{ t('stance.supportive') }} →</text>
      </g>
      <g class="bubble-labels">
        <text
          v-for="l in labels" :key="l.key"
          :class="[l.kind === 'group' ? 'bubble-name' : l.kind === 'outlet' ? 'net-name' : l.kind === 'inner' ? 'tile-label' : 'tile-share', cls(l.g)]"
          :x="l.x" :y="l.y" :text-anchor="l.anchor" :style="l.ink ? { fill: l.ink, ...(l.kind === 'inner' ? { fontWeight: 500 } : {}) } : undefined"
        >{{ l.text }}</text>
      </g>
    </svg>
    <div class="visually-hidden">
      <table>
        <caption>{{ t('g2.tree.title') }}</caption>
        <tbody>
          <template v-for="g in groups" :key="g.key ?? 'none'">
            <tr v-for="o in g.outlets" :key="o.slug"><th scope="row">{{ o.name }}</th><td>{{ plain(outletTip(o, g)) }}</td></tr>
          </template>
        </tbody>
      </table>
    </div>
  </div>
</template>
