<script setup lang="ts">
import { useResizeObserver } from '@vueuse/core'
import { dayChange } from '~/utils/home-days'

// Home.Calendar of assets/home.js, floating over the Plegma with no card and no title: a row of day tiles, as many as the width holds, with an arrow on the left of the first and one on the
// right of the last that move the row by a page of days. A tile has the day, the articles of all the outlets and the change against the day before, and picks the day. The name of a month
// is over the first tile of the row and over the first day of each month in it.
const props = defineProps<{ dates: string[], totals: (number | null)[] }>()
const selected = defineModel<number>({ required: true })
const { t } = useI18n()
const TILE = 62
const GAP = 6
const win = ref<HTMLElement>()
const count = ref(7)
const start = ref(0)
let placed = false
const last = computed(() => Math.max(0, props.dates.length - count.value))
const shown = computed(() => props.dates.slice(start.value, start.value + count.value).map((iso, k) => ({ iso, i: start.value + k })))
const weekend = (iso: string) => [0, 6].includes(new Date(`${iso}T00:00:00Z`).getUTCDay())
const monthOf = (iso: string, k: number) => (k === 0 || iso.endsWith('-01') ? fmtMonth(iso, { month: 'long', year: 'numeric' }) : null)
const change = (i: number) => {
  const v = dayChange(props.totals, i)
  if (v === null) return null
  const size = fmtDec(Math.abs(v))
  return { size: `${size}%`, dir: Number(size) === 0 ? null : v > 0 ? 'up' : 'down' }
}
const clampStart = (v: number) => Math.min(Math.max(0, v), last.value)
// A page is the tiles in view less two, so the row keeps two days it showed.
const page = (dir: number) => { start.value = clampStart(start.value + dir * Math.max(1, count.value - 2)) }
// The row starts with the picked day in the middle; a day that is out of view brings the row to it.
useResizeObserver(win, ([entry]) => {
  const w = entry?.contentRect.width ?? 0
  if (!w) return
  count.value = Math.max(3, Math.floor((w + GAP) / (TILE + GAP)))
  start.value = clampStart(placed ? start.value : selected.value - Math.floor(count.value / 2))
  placed = true
})
watch(selected, (i) => { if (i < start.value || i >= start.value + count.value) start.value = clampStart(i - Math.floor(count.value / 2)) })
</script>

<template>
  <div class="home-calendar" role="group" :aria-label="t('home.days.title')">
    <button type="button" class="icon-button home-days-step" :disabled="start <= 0" :aria-label="t('home.days.prev')" @click="page(-1)"><AppIcon name="chevron-left" class="icon" /></button>
    <div ref="win" class="home-days-window">
      <ul class="home-days">
        <li v-for="(d, k) in shown" :key="d.iso">
          <span v-if="monthOf(d.iso, k)" class="home-day-month">{{ monthOf(d.iso, k) }}</span>
          <button type="button" :class="weekend(d.iso) ? 'home-day-btn is-weekend' : 'home-day-btn'" :aria-pressed="d.i === selected"
                  :aria-label="t('home.days.aria', { date: fmtDate(d.iso), n: fmtInt(totals[d.i] ?? 0) })" @click="selected = d.i">
            <span class="home-day-dow">{{ fmtMonth(d.iso, { weekday: 'short' }) }}</span>
            <span class="home-day-num">{{ Number(d.iso.slice(8)) }}</span>
            <span class="home-day-n">{{ totals[d.i] === null ? '–' : fmtInt(totals[d.i]!) }}</span>
            <span class="home-day-delta">
              <template v-if="change(d.i)"><span v-if="change(d.i)!.dir" :class="`home-arrow is-${change(d.i)!.dir}`" aria-hidden="true">{{ change(d.i)!.dir === 'up' ? '▲' : '▼' }}</span> {{ change(d.i)!.size }}</template>
              <template v-else>–</template>
            </span>
          </button>
        </li>
      </ul>
    </div>
    <button type="button" class="icon-button home-days-step" :disabled="start >= last" :aria-label="t('home.days.next')" @click="page(1)"><AppIcon name="chevron-right" class="icon" /></button>
  </div>
</template>
