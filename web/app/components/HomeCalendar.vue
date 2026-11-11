<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core'
import { dayChange, monthsOf } from '~/utils/home-days'

// Home.Calendar of assets/home.js: a strip of tiles, one for each day of a month, that scrolls sideways. A tile has the day, the articles of all the outlets and the change against
// the day before, and picks the day. It floats over the Plegma with no card and no title: only the month with its arrows and the tiles.
const props = defineProps<{ dates: string[], totals: (number | null)[] }>()
const selected = defineModel<number>({ required: true })
const { t } = useI18n()
const months = computed(() => monthsOf(props.dates))
const month = ref(props.dates[selected.value]!.slice(0, 7))
const monthAt = computed(() => months.value.indexOf(month.value))
const tiles = computed(() => props.dates.map((iso, i) => ({ iso, i })).filter(d => d.iso.startsWith(month.value)))
const weekend = (iso: string) => [0, 6].includes(new Date(`${iso}T00:00:00Z`).getUTCDay())
const change = (i: number) => {
  const v = dayChange(props.totals, i)
  if (v === null) return null
  const size = fmtDec(Math.abs(v))
  return { size: `${size}%`, dir: Number(size) === 0 ? null : v > 0 ? 'up' : 'down' }
}

// The scroll position that puts the picked tile in the middle of the strip.
const list = ref<HTMLElement>()
const calm = useMediaQuery('(prefers-reduced-motion: reduce)')
const center = async (smooth: boolean) => {
  await nextTick()
  const strip = list.value
  const tile = strip?.querySelector<HTMLElement>('[aria-pressed="true"]')
  if (!strip) return
  const left = tile ? tile.getBoundingClientRect().left - strip.getBoundingClientRect().left + strip.scrollLeft - (strip.clientWidth - tile.offsetWidth) / 2 : 0
  strip.scrollTo({ left, behavior: smooth && !calm.value ? 'smooth' : 'auto' })
}
watch(month, () => center(false))
watch(selected, (i) => { month.value = props.dates[i]!.slice(0, 7); center(true) })
onMounted(() => center(false))
</script>

<template>
  <div class="home-calendar" role="group" :aria-label="t('home.days.title')">
    <div class="home-month-nav">
      <button type="button" class="icon-button" :disabled="monthAt <= 0" :aria-label="t('home.month.prev')" @click="month = months[monthAt - 1]!"><AppIcon name="chevron-left" class="icon" /></button>
      <span class="home-month-name" aria-live="polite">{{ fmtMonth(`${month}-01`, { month: 'long', year: 'numeric' }) }}</span>
      <button type="button" class="icon-button" :disabled="monthAt >= months.length - 1" :aria-label="t('home.month.next')" @click="month = months[monthAt + 1]!"><AppIcon name="chevron-right" class="icon" /></button>
    </div>
    <ul ref="list" :key="month" class="home-days is-swap">
      <li v-for="d in tiles" :key="d.iso">
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
</template>
