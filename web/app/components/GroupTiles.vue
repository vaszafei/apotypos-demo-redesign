<script setup lang="ts">
import { useElementSize } from '@vueuse/core'
import type { TileGroup } from '~/types/mme'

// GroupTiles of media-v2.html: the groups are on the x axis, each is a block that stands on the axis with its name under it. The outlets are the tiles of the block,
// so the area of a tile is the articles of its outlet and the area of a block is the articles of its group, on one scale. The width of a block follows the root
// of its articles, with a floor so that its name fits. A tile is the link of its outlet and has its name when it is large enough (the tooltip has it in every case).
const props = defineProps<{ groups: TileGroup[], total: number }>()
const tooltip = useTooltipStore()
const { t } = useI18n()
const ink = useInk()

const HEIGHT = 380
const GAP = 8
const FLOOR = 104
const holder = ref<HTMLElement | null>(null)
const { width: measured } = useElementSize(holder)
const width = computed(() => Math.floor(measured.value) || 640)

// Widths: the root of the articles, scaled to the width of the chart. A block under the floor gets the floor and the others share the rest.
const widths = computed(() => {
  const rows = props.groups
  const usable = width.value - GAP * (rows.length - 1)
  const fixed = new Set<number>()
  let w = rows.map(r => Math.sqrt(r.n))
  for (let pass = 0; pass < rows.length; pass++) {
    const free = rows.map((_, k) => k).filter(k => !fixed.has(k))
    const rest = usable - fixed.size * FLOOR
    const sum = free.reduce((a, k) => a + Math.sqrt(rows[k]!.n), 0)
    w = rows.map((r, k) => (fixed.has(k) ? FLOOR : (Math.sqrt(r.n) / sum) * rest))
    const small = free.filter(k => w[k]! < FLOOR)
    if (!small.length) break
    small.forEach(k => fixed.add(k))
  }
  return w
})
// One scale for the area: the tallest block is HEIGHT high.
const per = computed(() => Math.max(...props.groups.map((r, k) => r.n / widths.value[k]!)) / HEIGHT)
const blocks = computed(() => props.groups.map((g, k) => {
  const w = widths.value[k]!
  const h = g.n / w / per.value
  const tiles = squarify(g.outlets.map(o => ({ o, v: o.n })), 0, 0, w, h).map(({ item: { o }, x, y, w: ow, h: oh }, m) => {
    const full = m % 2 ? tintOf(g.color, 0.35) : g.color
    const [w0, h0] = [ow - 1, oh - 1]
    return { o, m, full, tw: Math.max(0, w0), th: Math.max(0, h0), x, y, rest: `color-mix(in srgb, ${full} 80%, var(--surface-page))`, name: w0 >= 30 && h0 >= 14, count: w0 >= 58 && h0 >= 34, k: m % 2 ? 0.35 : 0 }
  })
  return { g, w, h, tiles, label: g.name ?? t('media2.groups.none') }
}))
const tipOf = (b: (typeof blocks.value)[number], o: TileGroup['outlets'][number]) => t('g2.tree.tip', { outlet: o.name, group: b.label, n: fmtInt(o.n), share: fmtPct(o.n / props.total) })
</script>

<template>
  <div class="gt-scroll">
    <div ref="holder" class="fit">
      <div class="gt-row" :style="{ height: `${HEIGHT}px` }">
        <div v-for="b in blocks" :key="b.g.name ?? 'none'" class="gt-box" :style="{ width: `${b.w}px`, height: `${b.h}px` }">
          <EntityLink
            v-for="tile in b.tiles" :key="tile.o.slug" class="gt-tile" type="outlet" :to="outletHref(tile.o.slug)"
            :style="`left:${tile.x}px;top:${tile.y}px;width:${tile.tw}px;height:${tile.th}px;--tile-rest:${tile.rest};--tile-full:${tile.full};--ink-rest:${ink(b.g.color, tile.k, 0.8)};--ink-full:${ink(b.g.color, tile.k)}`"
            @pointerenter="tooltip.show({ title: tipOf(b, tile.o) }, $event)" @pointermove="tooltip.show({ title: tipOf(b, tile.o) }, $event)" @pointerleave="tooltip.hide()"
          >
            <span v-if="tile.name" class="gt-name">{{ tile.o.name }}</span>
            <span v-if="tile.count" class="gt-n">{{ fmtInt(tile.o.n) }}</span>
          </EntityLink>
        </div>
      </div>
      <div class="gt-row gt-labels">
        <div v-for="b in blocks" :key="b.g.name ?? 'none'" class="gt-axis" :style="{ width: `${b.w}px`, borderColor: b.g.color }">
          <span class="gt-gname"><EntityLink v-if="b.g.slug" type="group" :to="groupPageHref(b.g.slug)">{{ b.label }}</EntityLink><template v-else>{{ b.label }}</template></span>
          <span class="gt-gval">{{ fmtInt(b.g.n) }} · {{ fmtPct(b.g.n / total) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
