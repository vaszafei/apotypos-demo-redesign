<script setup lang="ts">
import { CalendarDate, parseDate } from '@internationalized/date'
import type { DateValue } from '@internationalized/date'

const props = defineProps<{ dates: string[] }>()
const period = usePeriodStore()

const first = computed(() => props.dates[0] ?? '')
const last = computed(() => props.dates[props.dates.length - 1] ?? '')
const from = computed(() => period.from ?? first.value)
const to = computed(() => period.to ?? last.value)

const model = computed({
  get: () => (from.value && to.value ? { start: parseDate(from.value), end: parseDate(to.value) } : { start: undefined, end: undefined }),
  set: (v: { start?: DateValue, end?: DateValue }) => {
    if (v.start && v.end) period.set(v.start.toString(), v.end.toString())
  }
})
const bounds = computed(() => (first.value ? { min: parseDate(first.value), max: parseDate(last.value) } : {}))

// Presets: the last 7 and 30 days of the data, and all of it.
const preset = (days: number | null) => {
  const ds = props.dates
  period.set(days ? ds[Math.max(0, ds.length - days)]! : ds[0]!, ds[ds.length - 1]!)
}
const label = computed(() => (from.value ? `${fmtDay(from.value)} – ${fmtDay(to.value)}` : '…'))
</script>

<template>
  <UPopover :content="{ align: 'end' }">
    <UButton color="neutral" variant="outline" icon="i-lucide-calendar" :label="label" class="rounded-lg" />
    <template #content>
      <div class="flex flex-col gap-2 p-2">
        <div class="flex gap-1">
          <UButton size="xs" color="neutral" variant="soft" label="7 ημέρες" @click="preset(7)" />
          <UButton size="xs" color="neutral" variant="soft" label="30 ημέρες" @click="preset(30)" />
          <UButton size="xs" color="neutral" variant="soft" label="Όλα" @click="preset(null)" />
        </div>
        <UCalendar v-model="model" range :min-value="bounds.min" :max-value="bounds.max" :number-of-months="1" />
      </div>
    </template>
  </UPopover>
</template>
